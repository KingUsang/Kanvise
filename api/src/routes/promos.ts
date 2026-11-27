import { Hono } from "hono";
import { z } from "zod";
import { jwtVerificationMiddleware, profileResolutionMiddleware, accountContextMiddleware, requireRole } from "../middleware/auth"
import { accountUserProjection } from '../middleware/account-projection';
import { supabase } from "../lib/supabase";
import { uuidSchema } from "../lib/api-contract";
import { deleteStoredObject, StorageError, verifyPublicUpload } from "../storage/r2";
import { consumeUploadIntent, releaseUploadIntent } from "../storage/upload-intents";
import type { TablesUpdate } from '../lib/database.types'

export const promosRouter = new Hono<{ Variables: { user: any; jwt_payload?: any } }>();

// Require tenant auth and admin role for all promo routes
promosRouter.use("*", jwtVerificationMiddleware, profileResolutionMiddleware);
promosRouter.use("*", accountContextMiddleware, accountUserProjection);
promosRouter.use("*", requireRole("admin"));

const MAX_PROMOS = 100;
const LINK_TABLES = { programme: "programmes", sub_programme: "sub_programmes", course: "courses" } as const;

const uploadFields = {
  content_type: z.string().trim().min(1).max(100),
  file_size_bytes: z.coerce.number().int().positive().max(50 * 1024 * 1024),
};
const titleSchema = z.string().trim().min(1).max(120);
const imageKeySchema = z.string().trim().min(1).max(512);
const linkTypeSchema = z.enum(["programme", "sub_programme", "course"]);
const orderIndexSchema = z.number().int().min(0).max(10_000);

const createSchema = z.object({
  title: titleSchema,
  image_key: imageKeySchema,
  link_type: linkTypeSchema,
  link_id: uuidSchema,
  order_index: orderIndexSchema.optional(),
  ...uploadFields,
}).strict();

const updateSchema = z.object({
  title: titleSchema.optional(),
  image_key: imageKeySchema.optional(),
  link_type: linkTypeSchema.optional(),
  link_id: uuidSchema.optional(),
  order_index: orderIndexSchema.optional(),
  is_active: z.boolean().optional(),
  content_type: uploadFields.content_type.optional(),
  file_size_bytes: uploadFields.file_size_bytes.optional(),
}).strict();

const reorderSchema = z.object({ order: z.array(uuidSchema).min(1).max(MAX_PROMOS) }).strict();

function validationError(c: any, issues?: z.ZodIssue[]) {
  return c.json({
    error: "Invalid promo request",
    code: "VALIDATION_ERROR",
    details: (issues || []).slice(0, 10).map(issue => ({ path: issue.path.join("."), message: issue.message })),
  }, 400);
}

async function readBody(c: any) {
  return c.req.json().catch(() => null);
}

function dbFailure(c: any, operation: string, error: unknown) {
  console.error(`promos.${operation}_failed`, error);
  return c.json({ error: "Promo request could not be completed. Please try again.", code: "PROMO_REQUEST_FAILED" }, 500);
}

// Returns true when the linked record exists in this account.
async function linkTargetExists(schoolId: string, linkType: keyof typeof LINK_TABLES, linkId: string) {
  const { data, error } = await (supabase as any)
    .from(LINK_TABLES[linkType])
    .select("id")
    .eq("id", linkId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

// ---------------------------------------------------------------------------
// 1. POST /schools/me/promos - Create a Promotional Banner
// ---------------------------------------------------------------------------
promosRouter.post("/", async (c) => {
  const user = c.get("user");
  const parsed = createSchema.safeParse(await readBody(c));
  if (!parsed.success) return validationError(c, parsed.error.issues);
  const body = parsed.data;

  try {
    await verifyPublicUpload({
      fileKey: body.image_key,
      schoolId: user.school_id,
      entityType: "promo",
      contextId: user.school_id,
      contentType: body.content_type,
      fileSizeBytes: body.file_size_bytes,
    });
  } catch (error: any) {
    if (error instanceof StorageError) return c.json({ error: error.message, code: error.code }, error.status);
    return dbFailure(c, "upload_verify", error);
  }

  try {
    if (!(await linkTargetExists(user.school_id, body.link_type, body.link_id))) {
      return c.json({ error: "Promo link target was not found in this tutoring account", code: "INVALID_LINK_TARGET" }, 400);
    }
  } catch (error) {
    return dbFailure(c, "link_lookup", error);
  }

  const intent = { schoolId: user.school_id, requesterId: user.id, fileKey: body.image_key };
  try {
    await consumeUploadIntent(intent);
  } catch (error: any) {
    if (error instanceof StorageError) return c.json({ error: error.message, code: error.code }, error.status);
    return dbFailure(c, "upload_intent", error);
  }

  const { data: promo, error } = await supabase
    .from("school_promos")
    .insert({
      school_id: user.school_id,
      title: body.title,
      image_key: body.image_key,
      link_type: body.link_type,
      link_id: body.link_id,
      order_index: body.order_index ?? 0,
      is_active: true
    })
    .select()
    .single();

  if (error) {
    await releaseUploadIntent(intent);
    return dbFailure(c, "create", error);
  }
  return c.json({ data: promo }, 201);
});

// ---------------------------------------------------------------------------
// 2. GET /schools/me/promos - List all Promos for Admin's School
// ---------------------------------------------------------------------------
promosRouter.get("/", async (c) => {
  const user = c.get("user");
  const { data: promos, error } = await supabase
    .from("school_promos")
    .select("*")
    .eq("school_id", user.school_id)
    .order("order_index", { ascending: true })
    .order("id", { ascending: true })
    .limit(MAX_PROMOS);

  if (error) return dbFailure(c, "list", error);
  return c.json({ data: promos || [] }, 200);
});

// ---------------------------------------------------------------------------
// 3. PATCH /schools/me/promos/reorder - Reorder Promos Carousel
// ---------------------------------------------------------------------------
promosRouter.patch("/reorder", async (c) => {
  const user = c.get("user");
  const parsed = reorderSchema.safeParse(await readBody(c));
  if (!parsed.success) return validationError(c, parsed.error.issues);
  const { order } = parsed.data;
  if (new Set(order).size !== order.length) {
    return c.json({ error: "order must not contain duplicate promo IDs", code: "VALIDATION_ERROR" }, 400);
  }

  const { data: existing, error: listError } = await supabase
    .from("school_promos")
    .select("id")
    .eq("school_id", user.school_id)
    .limit(MAX_PROMOS + 1);
  if (listError) return dbFailure(c, "reorder_lookup", listError);

  const existingIds = new Set((existing || []).map(row => row.id));
  if (existingIds.size !== order.length || order.some(id => !existingIds.has(id))) {
    return c.json({ error: "order must list every promo in this account exactly once", code: "ORDER_MISMATCH" }, 409);
  }

  // Each update assigns an absolute index, so a retry after a partial failure converges.
  for (const [index, id] of order.entries()) {
    const { error } = await supabase
      .from("school_promos")
      .update({ order_index: index })
      .eq("id", id)
      .eq("school_id", user.school_id);
    if (error) return dbFailure(c, "reorder", error);
  }

  return c.json({ message: "Promos reordered successfully" }, 200);
});

// ---------------------------------------------------------------------------
// 4. PATCH /:id - Update an Existing Promo
// ---------------------------------------------------------------------------
promosRouter.patch("/:id", async (c) => {
  const user = c.get("user");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) return c.json({ error: "Invalid promo id", code: "VALIDATION_ERROR" }, 400);
  const id = idResult.data;
  const parsed = updateSchema.safeParse(await readBody(c));
  if (!parsed.success) return validationError(c, parsed.error.issues);
  const body = parsed.data;

  // Tenant check: ensure promo belongs to school
  const { data: existing, error: findErr } = await supabase
    .from("school_promos")
    .select("id, image_key, link_type, link_id")
    .eq("id", id)
    .eq("school_id", user.school_id)
    .maybeSingle();

  if (findErr) return dbFailure(c, "lookup", findErr);
  if (!existing) {
    return c.json({ error: "Promo banner not found in this tutoring agency", code: "NOT_FOUND" }, 404);
  }

  if (body.image_key !== undefined) {
    if (!body.content_type || !body.file_size_bytes) {
      return c.json({ error: "content_type and file_size_bytes are required when replacing an image", code: "MISSING_PARAMS" }, 400);
    }
    try {
      await verifyPublicUpload({
        fileKey: body.image_key,
        schoolId: user.school_id,
        entityType: "promo",
        contextId: user.school_id,
        contentType: body.content_type,
        fileSizeBytes: body.file_size_bytes,
      });
    } catch (error: any) {
      if (error instanceof StorageError) return c.json({ error: error.message, code: error.code }, error.status);
      return dbFailure(c, "upload_verify", error);
    }
  }

  if (body.link_type !== undefined || body.link_id !== undefined) {
    const linkType = (body.link_type ?? existing.link_type) as keyof typeof LINK_TABLES;
    const linkId = body.link_id ?? existing.link_id;
    try {
      if (!(await linkTargetExists(user.school_id, linkType, linkId))) {
        return c.json({ error: "Promo link target was not found in this tutoring account", code: "INVALID_LINK_TARGET" }, 400);
      }
    } catch (error) {
      return dbFailure(c, "link_lookup", error);
    }
  }

  const intent = body.image_key !== undefined
    ? { schoolId: user.school_id, requesterId: user.id, fileKey: body.image_key }
    : null;
  if (intent && existing.image_key !== body.image_key) {
    try {
      await consumeUploadIntent(intent);
    } catch (error: any) {
      if (error instanceof StorageError) return c.json({ error: error.message, code: error.code }, error.status);
      return dbFailure(c, "upload_intent", error);
    }
  }

  const { content_type: _contentType, file_size_bytes: _fileSize, ...fields } = body;
  if (Object.keys(fields).length === 0) {
    return c.json({ error: "No promo fields to update", code: "VALIDATION_ERROR" }, 400);
  }
  const { data: updated, error } = await supabase
    .from("school_promos")
    .update(fields as TablesUpdate<'school_promos'>)
    .eq("id", id)
    .eq("school_id", user.school_id)
    .select()
    .maybeSingle();

  const consumed = intent !== null && existing.image_key !== body.image_key;
  if (error) {
    if (consumed) await releaseUploadIntent(intent);
    return dbFailure(c, "update", error);
  }
  if (!updated) {
    if (consumed) await releaseUploadIntent(intent);
    return c.json({ error: "Promo banner not found in this tutoring agency", code: "NOT_FOUND" }, 404);
  }
  if (body.image_key && existing.image_key !== body.image_key) {
    deleteStoredObject(existing.image_key).catch(error => console.error("promo.old_image_cleanup_failed", { id, error }));
  }
  return c.json({ data: updated }, 200);
});

// ---------------------------------------------------------------------------
// 5. DELETE /:id - Delete a Promo
// ---------------------------------------------------------------------------
promosRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) return c.json({ error: "Invalid promo id", code: "VALIDATION_ERROR" }, 400);
  const id = idResult.data;

  const { data: deleted, error } = await supabase
    .from("school_promos")
    .delete()
    .eq("id", id)
    .eq("school_id", user.school_id)
    .select("image_key")
    .maybeSingle();

  if (error) return dbFailure(c, "delete", error);
  if (!deleted) return c.json({ error: "Promo banner not found in this tutoring agency", code: "NOT_FOUND" }, 404);
  if (deleted.image_key) {
    deleteStoredObject(deleted.image_key).catch(error => console.error("promo.image_cleanup_failed", { id, error }));
  }
  return c.json({ message: "Promo banner deleted successfully" }, 200);
});
