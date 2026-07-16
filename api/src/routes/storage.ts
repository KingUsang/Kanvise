import { Hono } from "hono";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { jwtVerificationMiddleware, profileResolutionMiddleware } from "../middleware/auth";
import crypto from "crypto";

type Variables = {
  user: any;
};

export const storageRouter = new Hono<{ Variables: Variables }>();

// Apply authentication middleware
storageRouter.use("*", jwtVerificationMiddleware, profileResolutionMiddleware);

const r2AccountId = process.env.R2_ACCOUNT_ID;
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const r2BucketName = process.env.R2_BUCKET_NAME || "kanvise";

const isR2Configured = r2AccountId && r2AccessKeyId && r2SecretAccessKey;

let s3Client: S3Client | null = null;

if (isR2Configured) {
  s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: r2AccessKeyId,
      secretAccessKey: r2SecretAccessKey,
    },
  });
}

export const generatePresignedGetUrl = async (fileKey: string, expiresIn = 900) => {
  if (!s3Client) return null;
  const command = new GetObjectCommand({
    Bucket: r2BucketName,
    Key: fileKey,
  });
  return await getSignedUrl(s3Client, command, { expiresIn });
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB for notes, etc.
const ALLOWED_TYPES = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "image/jpeg", "image/png"];

storageRouter.post("/presigned-url", async (c) => {
  try {
    const profile = c.get("user");
    if (!profile.school_id) {
      return c.json({ error: "User has no school setup", code: "NO_SCHOOL" }, 400);
    }

    if (!s3Client) {
      return c.json({ error: "Storage not configured on server.", code: "STORAGE_NOT_CONFIGURED" }, 500);
    }

    const body = await c.req.json();
    const { file_name, content_type, file_size_bytes, entity_type } = body;

    if (!file_name || !content_type || !file_size_bytes || !entity_type) {
      return c.json({ error: "Missing required fields", code: "BAD_REQUEST" }, 400);
    }

    if (file_size_bytes > MAX_FILE_SIZE) {
      return c.json({ error: "File exceeds 50MB limit", code: "FILE_TOO_LARGE" }, 400);
    }

    if (!ALLOWED_TYPES.includes(content_type)) {
      return c.json({ error: "Invalid file type", code: "INVALID_FILE_TYPE" }, 400);
    }

    // Generate a unique file key scoped to the school
    const uniqueId = crypto.randomUUID();
    const extension = file_name.split('.').pop() || "";
    const fileKey = `schools/${profile.school_id}/${entity_type}/${uniqueId}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: r2BucketName,
      Key: fileKey,
      ContentType: content_type,
      ContentLength: file_size_bytes,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 }); // 15 mins

    return c.json({
      data: {
        presigned_url: presignedUrl,
        file_key: fileKey,
        expires_in_seconds: 900
      }
    });

  } catch (error: any) {
    console.error("POST /storage/presigned-url error:", error);
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

storageRouter.get("/presigned-url", async (c) => {
  try {
    const profile = c.get("user");
    if (!profile.school_id) {
      return c.json({ error: "User has no school setup", code: "NO_SCHOOL" }, 400);
    }

    if (!s3Client) {
      return c.json({ error: "Storage not configured on server.", code: "STORAGE_NOT_CONFIGURED" }, 500);
    }

    const fileKey = c.req.query("file_key");
    if (!fileKey) {
      return c.json({ error: "Missing file_key", code: "BAD_REQUEST" }, 400);
    }

    // Ensure the user's school ID matches the path (tenant isolation)
    if (!fileKey.startsWith(`schools/${profile.school_id}/`)) {
      return c.json({ error: "Forbidden: Cannot access files outside your school", code: "FORBIDDEN" }, 403);
    }

    const command = new GetObjectCommand({
      Bucket: r2BucketName,
      Key: fileKey,
    });

    const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    return c.json({
      data: {
        download_url: downloadUrl,
        expires_in_seconds: 900
      }
    });

  } catch (error: any) {
    console.error("GET /storage/presigned-url error:", error);
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});
