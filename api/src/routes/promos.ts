import { Hono } from "hono";
import { jwtVerificationMiddleware, profileResolutionMiddleware, tenantMiddleware, requireRole } from "../middleware/auth";
import { supabase } from "../lib/supabase";
import { deleteStoredObject, StorageError, verifyPublicUpload } from "../storage/r2";

export const promosRouter = new Hono<{ Variables: { user: any; jwt_payload?: any } }>();

// Require tenant auth and admin role for all promo routes
promosRouter.use("*", jwtVerificationMiddleware, profileResolutionMiddleware);
promosRouter.use("*", tenantMiddleware);
promosRouter.use("*", requireRole("admin"));

// ---------------------------------------------------------------------------
// 1. POST /schools/me/promos - Create a Promotional Banner
// ---------------------------------------------------------------------------
promosRouter.post("/schools/me/promos", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const { title, image_key, link_type, link_id, order_index, content_type, file_size_bytes } = body;

  if (!title || !image_key || !link_type || !link_id || !content_type || !file_size_bytes) {
    return c.json({ error: "title, image_key, link_type, link_id, content_type and file_size_bytes are required", code: "MISSING_PARAMS" }, 400);
  }

  try {
    await verifyPublicUpload({
      fileKey: image_key,
      schoolId: user.school_id,
      entityType: "promo",
      contextId: user.school_id,
      contentType: content_type,
      fileSizeBytes: Number(file_size_bytes),
    });
  } catch (error: any) {
    if (error instanceof StorageError) return c.json({ error: error.message, code: error.code }, error.status);
    throw error;
  }

  const { data: promo, error } = await supabase
    .from("school_promos")
    .insert({
      school_id: user.school_id,
      title,
      image_key,
      link_type,
      link_id,
      order_index: order_index !== undefined ? Number(order_index) : 0,
      is_active: true
    })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ data: promo }, 201);
});

// ---------------------------------------------------------------------------
// 2. GET /schools/me/promos - List all Promos for Admin's School
// ---------------------------------------------------------------------------
promosRouter.get("/schools/me/promos", async (c) => {
  const user = c.get("user");
  const { data: promos, error } = await supabase
    .from("school_promos")
    .select("*")
    .eq("school_id", user.school_id)
    .order("order_index", { ascending: true });

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ data: promos || [] }, 200);
});

// ---------------------------------------------------------------------------
// 3. PATCH /schools/me/promos/reorder - Reorder Promos Carousel
// ---------------------------------------------------------------------------
promosRouter.patch("/schools/me/promos/reorder", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const { order } = body;

  if (!Array.isArray(order)) {
    return c.json({ error: "order must be an array of promo UUIDs", code: "INVALID_PARAMS" }, 400);
  }

  // Update order_index for each promo item sequentially
  await Promise.all(
    order.map(async (id: string, index: number) => {
      await supabase
        .from("school_promos")
        .update({ order_index: index })
        .eq("id", id)
        .eq("school_id", user.school_id);
    })
  );

  return c.json({ message: "Promos reordered successfully" }, 200);
});

// ---------------------------------------------------------------------------
// 4. PATCH /:id - Update an Existing Promo
// ---------------------------------------------------------------------------
promosRouter.patch("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json();

  // Tenant check: ensure promo belongs to school
  const { data: existing, error: findErr } = await supabase
    .from("school_promos")
    .select("id, image_key")
    .eq("id", id)
    .eq("school_id", user.school_id)
    .single();

  if (findErr || !existing) {
    return c.json({ error: "Promo banner not found in this tutorial centre", code: "NOT_FOUND" }, 404);
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
        fileSizeBytes: Number(body.file_size_bytes),
      });
    } catch (error: any) {
      if (error instanceof StorageError) return c.json({ error: error.message, code: error.code }, error.status);
      throw error;
    }
  }

  const allowed = ["title", "image_key", "link_type", "link_id", "order_index", "is_active"];
  const updates = Object.fromEntries(Object.entries(body).filter(([key]) => allowed.includes(key)));
  const { data: updated, error } = await supabase
    .from("school_promos")
    .update(updates)
    .eq("id", id)
    .eq("school_id", user.school_id)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
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
  const id = c.req.param("id");

  const { data: existing } = await supabase.from("school_promos").select("image_key")
    .eq("id", id).eq("school_id", user.school_id).maybeSingle();
  const { error } = await supabase
    .from("school_promos")
    .delete()
    .eq("id", id)
    .eq("school_id", user.school_id);

  if (error) return c.json({ error: error.message }, 500);
  if (existing?.image_key) {
    deleteStoredObject(existing.image_key).catch(error => console.error("promo.image_cleanup_failed", { id, error }));
  }
  return c.json({ message: "Promo banner deleted successfully" }, 200);
});
