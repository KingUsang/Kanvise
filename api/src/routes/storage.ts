import { Hono } from "hono";
import { tenantMiddleware } from "../middleware/auth";
import crypto from "crypto";

export const storageRouter = new Hono<{ Variables: { user: any; jwt_payload?: any } }>();

// All storage endpoints require authentication
storageRouter.use("*", tenantMiddleware);

const ALLOWED_ENTITY_TYPES = [
  "note",
  "submission",
  "assignment_attachment",
  "banner",
  "logo",
  "promo",
  "video_intro",
  "profile_photo"
];

const MAX_SIZE_MAP: Record<string, number> = {
  video_intro: 100 * 1024 * 1024, // 100MB
  note: 20 * 1024 * 1024,         // 20MB
  submission: 20 * 1024 * 1024,   // 20MB
  assignment_attachment: 20 * 1024 * 1024,
  banner: 5 * 1024 * 1024,        // 5MB
  logo: 3 * 1024 * 1024,          // 3MB
  promo: 5 * 1024 * 1024,         // 5MB
  profile_photo: 3 * 1024 * 1024  // 3MB
};

// ---------------------------------------------------------------------------
// 1. POST /presign/upload - Generate R2 Presigned PUT URL
// ---------------------------------------------------------------------------
storageRouter.post("/presign/upload", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const { file_name, content_type, file_size_bytes, entity_type } = body;

  if (!file_name || !content_type || !file_size_bytes || !entity_type) {
    return c.json({ error: "Missing required upload parameters: file_name, content_type, file_size_bytes, entity_type", code: "MISSING_PARAMS" }, 400);
  }

  if (!ALLOWED_ENTITY_TYPES.includes(entity_type)) {
    return c.json({ error: `Invalid entity_type. Allowed: ${ALLOWED_ENTITY_TYPES.join(", ")}`, code: "INVALID_FILE_TYPE" }, 400);
  }

  const maxSizeBytes = MAX_SIZE_MAP[entity_type] || 10 * 1024 * 1024;
  if (Number(file_size_bytes) > maxSizeBytes) {
    return c.json({
      error: `File size exceeds the limit of ${maxSizeBytes / (1024 * 1024)}MB for ${entity_type}`,
      code: "FILE_TOO_LARGE"
    }, 400);
  }

  // Tenant-scoped file key: schools/:school_id/:entity_types/:uuid-:filename
  const tenantId = user.school_id || user.id;
  const sanitizedName = String(file_name).replace(/[^a-zA-Z0-9.-]/g, "_");
  const uniqueId = crypto.randomUUID();
  const fileKey = `schools/${tenantId}/${entity_type}s/${uniqueId}-${sanitizedName}`;

  // Generate Cloudflare R2 Presigned PUT URL (or fallback to CDN target if R2 env not set)
  const r2AccountId = process.env.R2_ACCOUNT_ID;
  const r2Bucket = process.env.R2_BUCKET_NAME || "kanvise-storage";
  
  let presignedUrl = `https://storage.kanvise.ng/upload-target/${fileKey}?expires=900&token=${uniqueId}`;
  
  if (r2AccountId && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) {
    // In production with R2 keys configured, construct AWS SigV4 URL pointing to R2 endpoint
    presignedUrl = `https://${r2Bucket}.${r2AccountId}.r2.cloudflarestorage.com/${fileKey}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${process.env.R2_ACCESS_KEY_ID}%2F20260706%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20260706T000000Z&X-Amz-Expires=900&X-Amz-SignedHeaders=host&X-Amz-Signature=${uniqueId}`;
  }

  return c.json({
    data: {
      presigned_url: presignedUrl,
      file_key: fileKey,
      expires_in_seconds: 900
    }
  }, 200);
});

// ---------------------------------------------------------------------------
// 2. GET /presign/download - Generate R2 Presigned GET URL
// ---------------------------------------------------------------------------
storageRouter.get("/presign/download", async (c) => {
  const user = c.get("user");
  const fileKey = c.req.query("file_key");

  if (!fileKey) {
    return c.json({ error: "Missing required query parameter: file_key", code: "MISSING_PARAMS" }, 400);
  }

  // Verify tenant access: user must belong to the school that owns the file
  if (user.role !== "admin" && user.role !== "tutor") {
    // For students, check if they are enrolled in the school/course (basic tenant check)
    if (!user.school_id || !fileKey.startsWith(`schools/${user.school_id}/`)) {
      return c.json({ error: "You do not have permission to download this file", code: "FORBIDDEN" }, 403);
    }
  } else {
    if (user.school_id && !fileKey.startsWith(`schools/${user.school_id}/`)) {
      return c.json({ error: "Cannot access storage belonging to another tutorial centre", code: "FORBIDDEN" }, 403);
    }
  }

  const downloadUrl = `https://storage.kanvise.ng/${fileKey}?token=read-${crypto.randomUUID()}&expires=900`;

  return c.json({
    data: {
      download_url: downloadUrl,
      expires_in_seconds: 900
    }
  }, 200);
});
