import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import crypto from 'crypto'

export const PRIVATE_UPLOAD_TYPES = [
  'note',
  'assignment_attachment',
  'submission',
  'question_media',
  'live_class_presentation',
] as const

export type PrivateUploadType = typeof PRIVATE_UPLOAD_TYPES[number]

export const PUBLIC_UPLOAD_TYPES = [
  'logo',
  'banner',
  'video_intro',
  'programme_thumbnail',
  'promo',
  'profile_photo',
] as const

export type PublicUploadType = typeof PUBLIC_UPLOAD_TYPES[number]

const PUBLIC_CONTENT_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
} as const

const IMAGE_UPLOAD_TYPES = new Set<PublicUploadType>([
  'logo', 'banner', 'programme_thumbnail', 'promo', 'profile_photo',
])

export const MAX_PUBLIC_IMAGE_SIZE = 10 * 1024 * 1024
export const MAX_PUBLIC_VIDEO_SIZE = 500 * 1024 * 1024

export const DOCUMENT_CONTENT_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'image/jpeg': 'jpg',
  'image/png': 'png',
} as const

export type DocumentContentType = keyof typeof DOCUMENT_CONTENT_TYPES

export const MAX_DOCUMENT_SIZE = 50 * 1024 * 1024
export const MAX_QUESTION_IMAGE_SIZE = 10 * 1024 * 1024

const QUESTION_IMAGE_CONTENT_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const

export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: 400 | 403 | 404 | 409 | 500 = 400,
  ) {
    super(message)
    this.name = 'StorageError'
  }
}

type R2Config = {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
  publicBucketName?: string
}

// NOTE (2026-07-26): Production currently REUSES the dev R2 credentials and the
// shared private bucket `kanvise` (same Cloudflare account). Public bucket is
// `kanvise-public-dev` served via the rate-limited r2.dev URL. Before real
// launch, swap in prod-dedicated access keys/buckets and a custom CDN domain.
// Actual values live in each server's api/.env (not version-controlled).
function readConfig(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucketName = process.env.R2_BUCKET_NAME
  const publicBucketName = process.env.R2_PUBLIC_BUCKET_NAME

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) return null
  return { accountId, accessKeyId, secretAccessKey, bucketName, publicBucketName }
}

let cachedClient: S3Client | null = null
let cachedConfigKey = ''

function configuredClient() {
  const config = readConfig()
  if (!config) {
    throw new StorageError('Storage not configured on server.', 'STORAGE_NOT_CONFIGURED', 500)
  }

  const configKey = `${config.accountId}:${config.accessKeyId}:${config.bucketName}`
  if (!cachedClient || cachedConfigKey !== configKey) {
    cachedClient = new S3Client({
      region: 'auto',
      forcePathStyle: true,
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    })
    cachedConfigKey = configKey
  }

  return { client: cachedClient, bucketName: config.bucketName }
}

function configuredPublicClient() {
  const config = readConfig()
  if (!config?.publicBucketName || config.publicBucketName === config.bucketName) {
    throw new StorageError('A separate public storage bucket is not configured on server.', 'PUBLIC_STORAGE_NOT_CONFIGURED', 500)
  }
  const { client } = configuredClient()
  return { client, bucketName: config.publicBucketName }
}

export function isR2Configured() {
  return readConfig() !== null
}

export function isPublicR2Configured() {
  const config = readConfig()
  return Boolean(
    config?.publicBucketName
    && config.publicBucketName !== config.bucketName
    && process.env.R2_PUBLIC_BASE_URL,
  )
}

export function isPrivateUploadType(value: string): value is PrivateUploadType {
  return PRIVATE_UPLOAD_TYPES.includes(value as PrivateUploadType)
}

export function isPublicUploadType(value: string): value is PublicUploadType {
  return PUBLIC_UPLOAD_TYPES.includes(value as PublicUploadType)
}

export function validatePublicMediaMetadata(input: {
  entityType: PublicUploadType
  fileName: string
  contentType: string
  fileSizeBytes: number
}) {
  const fileSizeBytes = Number(input.fileSizeBytes)
  if (!Number.isInteger(fileSizeBytes) || fileSizeBytes <= 0) {
    throw new StorageError('File size must be a positive integer', 'INVALID_FILE_SIZE')
  }

  const extension = PUBLIC_CONTENT_TYPES[input.contentType as keyof typeof PUBLIC_CONTENT_TYPES]
  const isImage = IMAGE_UPLOAD_TYPES.has(input.entityType)
  if (!extension || (isImage ? !input.contentType.startsWith('image/') : !input.contentType.startsWith('video/'))) {
    throw new StorageError('Invalid file type for this media field', 'INVALID_FILE_TYPE')
  }

  const limit = isImage ? MAX_PUBLIC_IMAGE_SIZE : MAX_PUBLIC_VIDEO_SIZE
  if (fileSizeBytes > limit) {
    throw new StorageError(`File exceeds ${isImage ? '10MB' : '500MB'} limit`, 'FILE_TOO_LARGE')
  }

  const suppliedExtension = input.fileName.split('.').pop()?.toLowerCase()
  const validExtensions = extension === 'jpg' ? ['jpg', 'jpeg'] : [extension]
  if (!suppliedExtension || !validExtensions.includes(suppliedExtension)) {
    throw new StorageError('Filename extension does not match content type', 'FILE_TYPE_MISMATCH')
  }
  return { extension, fileSizeBytes }
}

export function validateDocumentMetadata(input: {
  fileName: string
  contentType: string
  fileSizeBytes: number
}) {
  const fileSizeBytes = Number(input.fileSizeBytes)
  if (!Number.isInteger(fileSizeBytes) || fileSizeBytes <= 0) {
    throw new StorageError('File size must be a positive integer', 'INVALID_FILE_SIZE')
  }
  if (fileSizeBytes > MAX_DOCUMENT_SIZE) {
    throw new StorageError('File exceeds 50MB limit', 'FILE_TOO_LARGE')
  }

  const expectedExtension = DOCUMENT_CONTENT_TYPES[input.contentType as DocumentContentType]
  if (!expectedExtension) {
    throw new StorageError('Invalid file type', 'INVALID_FILE_TYPE')
  }

  const suppliedExtension = input.fileName.split('.').pop()?.toLowerCase()
  const validExtensions = expectedExtension === 'jpg' ? ['jpg', 'jpeg'] : [expectedExtension]
  if (!suppliedExtension || !validExtensions.includes(suppliedExtension)) {
    throw new StorageError('Filename extension does not match content type', 'FILE_TYPE_MISMATCH')
  }

  return { extension: expectedExtension, fileSizeBytes }
}

export function validatePrivateUploadMetadata(input: {
  entityType: PrivateUploadType
  fileName: string
  contentType: string
  fileSizeBytes: number
}) {
  if (input.entityType !== 'question_media') return validateDocumentMetadata(input)
  const fileSizeBytes = Number(input.fileSizeBytes)
  if (!Number.isInteger(fileSizeBytes) || fileSizeBytes <= 0) {
    throw new StorageError('File size must be a positive integer', 'INVALID_FILE_SIZE')
  }
  if (fileSizeBytes > MAX_QUESTION_IMAGE_SIZE) {
    throw new StorageError('Question image exceeds 10MB limit', 'FILE_TOO_LARGE')
  }
  const extension = QUESTION_IMAGE_CONTENT_TYPES[input.contentType as keyof typeof QUESTION_IMAGE_CONTENT_TYPES]
  if (!extension) throw new StorageError('Question media must be a JPG, PNG, or WebP image', 'INVALID_FILE_TYPE')
  const suppliedExtension = input.fileName.split('.').pop()?.toLowerCase()
  const validExtensions = extension === 'jpg' ? ['jpg', 'jpeg'] : [extension]
  if (!suppliedExtension || !validExtensions.includes(suppliedExtension)) {
    throw new StorageError('Filename extension does not match content type', 'FILE_TYPE_MISMATCH')
  }
  return { extension, fileSizeBytes }
}

export function buildPrivateFileKey(
  schoolId: string,
  entityType: PrivateUploadType,
  contextId: string,
  extension: string,
  id = crypto.randomUUID(),
) {
  if (!contextId || contextId.includes('/') || contextId.includes('..')) {
    throw new StorageError('Invalid upload context', 'INVALID_UPLOAD_CONTEXT')
  }
  return `schools/${schoolId}/private/${entityType}/${contextId}/${id}.${extension}`
}

export function assertPrivateFileKey(
  fileKey: string,
  schoolId: string,
  entityType?: PrivateUploadType,
  contextId?: string,
) {
  const prefix = entityType && contextId
    ? `schools/${schoolId}/private/${entityType}/${contextId}/`
    : entityType
      ? `schools/${schoolId}/private/${entityType}/`
    : `schools/${schoolId}/private/`
  if (!fileKey.startsWith(prefix) || fileKey.includes('..') || fileKey.includes('\\')) {
    throw new StorageError('File key is outside the permitted school storage path', 'FORBIDDEN', 403)
  }
}

export function buildPublicFileKey(
  schoolId: string,
  entityType: PublicUploadType,
  contextId: string,
  extension: string,
  id = crypto.randomUUID(),
) {
  if (!contextId || contextId.includes('/') || contextId.includes('..')) {
    throw new StorageError('Invalid upload context', 'INVALID_UPLOAD_CONTEXT')
  }
  return `schools/${schoolId}/public/${entityType}/${contextId}/${id}.${extension}`
}

export function assertPublicFileKey(fileKey: string, schoolId: string, entityType: PublicUploadType, contextId: string) {
  const prefix = `schools/${schoolId}/public/${entityType}/${contextId}/`
  if (!fileKey.startsWith(prefix) || fileKey.includes('..') || fileKey.includes('\\')) {
    throw new StorageError('File key is outside the permitted public media path', 'FORBIDDEN', 403)
  }
}

export function publicFileUrl(fileKey: string) {
  const baseUrl = process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, '')
  if (!baseUrl) throw new StorageError('Public storage URL is not configured on server.', 'PUBLIC_STORAGE_NOT_CONFIGURED', 500)
  const safePath = fileKey.split('/').map(encodeURIComponent).join('/')
  return `${baseUrl}/${safePath}`
}

export function publicFileKeyFromUrl(url: string | null | undefined) {
  if (!url) return null
  const baseUrl = process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, '')
  if (!baseUrl || !url.startsWith(`${baseUrl}/`)) return null
  try {
    return url.slice(baseUrl.length + 1).split('/').map(decodeURIComponent).join('/')
  } catch {
    return null
  }
}

export async function createPresignedPublicUpload(input: {
  schoolId: string
  entityType: PublicUploadType
  contextId: string
  fileName: string
  contentType: string
  fileSizeBytes: number
}) {
  const { extension, fileSizeBytes } = validatePublicMediaMetadata(input)
  const fileKey = buildPublicFileKey(input.schoolId, input.entityType, input.contextId, extension)
  const { client, bucketName } = configuredPublicClient()
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: fileKey,
    ContentType: input.contentType,
    ContentLength: fileSizeBytes,
  })
  const presignedUrl = await getSignedUrl(client, command, { expiresIn: 900 })
  return { presignedUrl, fileKey, publicUrl: publicFileUrl(fileKey), expiresInSeconds: 900 }
}

export async function createPresignedUpload(input: {
  schoolId: string
  entityType: PrivateUploadType
  contextId: string
  fileName: string
  contentType: string
  fileSizeBytes: number
}) {
  const { extension, fileSizeBytes } = validatePrivateUploadMetadata(input)
  const fileKey = buildPrivateFileKey(input.schoolId, input.entityType, input.contextId, extension)
  const { client, bucketName } = configuredClient()
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: fileKey,
    ContentType: input.contentType,
    ContentLength: fileSizeBytes,
  })
  const presignedUrl = await getSignedUrl(client, command, { expiresIn: 900 })
  return { presignedUrl, fileKey, expiresInSeconds: 900 }
}

export async function createPresignedDownload(
  fileKey: string,
  schoolId: string,
  expiresIn = 900,
) {
  assertPrivateFileKey(fileKey, schoolId)
  const { client, bucketName } = configuredClient()
  const command = new GetObjectCommand({ Bucket: bucketName, Key: fileKey })
  return getSignedUrl(client, command, { expiresIn })
}

function signatureMatches(contentType: string, bytes: Uint8Array) {
  if (contentType === 'application/pdf') {
    return Buffer.from(bytes).subarray(0, 5).toString() === '%PDF-'
  }
  if (contentType === 'image/png') {
    return Buffer.from(bytes).subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  }
  if (contentType === 'image/jpeg') {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  if (contentType === 'image/webp') {
    return Buffer.from(bytes).subarray(0, 4).toString() === 'RIFF'
      && Buffer.from(bytes).subarray(8, 12).toString() === 'WEBP'
  }
  if (contentType === 'video/mp4' || contentType === 'video/quicktime') {
    return Buffer.from(bytes).subarray(4, 8).toString() === 'ftyp'
  }
  if (contentType === 'video/webm') {
    return Buffer.from(bytes).subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
  }
  // DOCX and PPTX are ZIP-based Open XML documents. This rejects renamed
  // executables; deeper package validation can be added if document processing is introduced.
  if (contentType.includes('openxmlformats-officedocument')) {
    return bytes[0] === 0x50 && bytes[1] === 0x4b && [0x03, 0x05, 0x07].includes(bytes[2])
  }
  return false
}

async function verifyStoredObject(input: { fileKey: string; contentType: string; fileSizeBytes: number }, visibility: 'private' | 'public') {
  const { client, bucketName } = visibility === 'public' ? configuredPublicClient() : configuredClient()
  let head
  try {
    head = await client.send(new HeadObjectCommand({ Bucket: bucketName, Key: input.fileKey }))
  } catch (error: any) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound') {
      throw new StorageError('Uploaded object was not found', 'FILE_NOT_FOUND', 404)
    }
    throw error
  }
  if (head.ContentLength !== input.fileSizeBytes || head.ContentType !== input.contentType) {
    throw new StorageError('Uploaded object metadata does not match the upload request', 'FILE_METADATA_MISMATCH', 409)
  }
  const object = await client.send(new GetObjectCommand({ Bucket: bucketName, Key: input.fileKey, Range: 'bytes=0-15' }))
  const bytes = object.Body ? await object.Body.transformToByteArray() : new Uint8Array()
  if (!signatureMatches(input.contentType, bytes)) {
    throw new StorageError('Uploaded file contents do not match the declared file type', 'INVALID_FILE_CONTENT', 409)
  }
  return {
    checksum: head.ChecksumSHA256 || head.ETag?.replaceAll('"', '')
      || crypto.createHash('sha256').update(`${input.fileKey}:${input.fileSizeBytes}`).digest('hex'),
  }
}

export async function verifyPrivateUpload(input: {
  fileKey: string
  schoolId: string
  entityType: PrivateUploadType
  contextId: string
  contentType: string
  fileSizeBytes: number
}) {
  assertPrivateFileKey(input.fileKey, input.schoolId, input.entityType, input.contextId)
  validatePrivateUploadMetadata({
    entityType: input.entityType,
    fileName: input.fileKey,
    contentType: input.contentType,
    fileSizeBytes: input.fileSizeBytes,
  })

  return verifyStoredObject(input, 'private')
}

export async function verifyPublicUpload(input: {
  fileKey: string
  schoolId: string
  entityType: PublicUploadType
  contextId: string
  contentType: string
  fileSizeBytes: number
}) {
  assertPublicFileKey(input.fileKey, input.schoolId, input.entityType, input.contextId)
  validatePublicMediaMetadata({
    entityType: input.entityType,
    fileName: input.fileKey,
    contentType: input.contentType,
    fileSizeBytes: input.fileSizeBytes,
  })
  return verifyStoredObject(input, 'public')
}

export async function deleteStoredObject(fileKey: string) {
  const { client, bucketName } = configuredPublicClient()
  await client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: fileKey }))
}

export async function deletePrivateObject(fileKey: string, schoolId: string) {
  assertPrivateFileKey(fileKey, schoolId)
  const { client, bucketName } = configuredClient()
  await client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: fileKey }))
}

export async function uploadPrivateObject(input: {
  fileKey: string
  schoolId: string
  body: Buffer | Uint8Array
  contentType: string
}) {
  assertPrivateFileKey(input.fileKey, input.schoolId)
  const { client, bucketName } = configuredClient()
  await client.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: input.fileKey,
    Body: input.body,
    ContentType: input.contentType,
    ContentLength: input.body.byteLength,
  }))
  return { fileKey: input.fileKey }
}

export async function readPrivateObject(fileKey: string, schoolId: string) {
  assertPrivateFileKey(fileKey, schoolId)
  const { client, bucketName } = configuredClient()
  const object = await client.send(new GetObjectCommand({ Bucket: bucketName, Key: fileKey }))
  if (!object.Body) throw new StorageError('Uploaded object could not be read', 'FILE_NOT_FOUND', 404)
  return object.Body.transformToByteArray()
}

export async function uploadPublicObject(input: {
  fileKey: string
  body: Buffer | Uint8Array
  contentType: string
}) {
  if (!input.fileKey.includes('/public/') || input.fileKey.includes('..') || input.fileKey.includes('\\')) {
    throw new StorageError('Invalid public object key', 'FORBIDDEN', 403)
  }
  const { client, bucketName } = configuredPublicClient()
  await client.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: input.fileKey,
    Body: input.body,
    ContentType: input.contentType,
    ContentLength: input.body.byteLength,
  }))
  return { fileKey: input.fileKey, publicUrl: publicFileUrl(input.fileKey) }
}

export function documentFileType(contentType: string) {
  const type = DOCUMENT_CONTENT_TYPES[contentType as DocumentContentType]
  if (!type) throw new StorageError('Invalid file type', 'INVALID_FILE_TYPE')
  return type
}
