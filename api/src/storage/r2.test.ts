import { afterEach, describe, expect, it } from 'vitest'
import {
  assertPrivateFileKey,
  assertPublicFileKey,
  buildPrivateFileKey,
  buildPublicFileKey,
  documentFileType,
  isPrivateUploadType,
  isPublicUploadType,
  isPublicR2Configured,
  isR2Configured,
  MAX_DOCUMENT_SIZE,
  MAX_PUBLIC_IMAGE_SIZE,
  publicFileKeyFromUrl,
  publicFileUrl,
  StorageError,
  validateDocumentMetadata,
  validatePublicMediaMetadata,
  uploadPublicObject,
} from './r2'

const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('R2 storage policy', () => {
  it('requires every R2 setting, including the bucket name', () => {
    process.env.R2_ACCOUNT_ID = 'account'
    process.env.R2_ACCESS_KEY_ID = 'key'
    process.env.R2_SECRET_ACCESS_KEY = 'secret'
    delete process.env.R2_BUCKET_NAME
    expect(isR2Configured()).toBe(false)

    process.env.R2_BUCKET_NAME = 'bucket'
    expect(isR2Configured()).toBe(true)
  })

  it('requires a distinct public bucket and CDN base URL for public media', () => {
    process.env.R2_ACCOUNT_ID = 'account'
    process.env.R2_ACCESS_KEY_ID = 'key'
    process.env.R2_SECRET_ACCESS_KEY = 'secret'
    process.env.R2_BUCKET_NAME = 'private-bucket'
    process.env.R2_PUBLIC_BUCKET_NAME = 'private-bucket'
    process.env.R2_PUBLIC_BASE_URL = 'https://cdn.example.com'
    expect(isPublicR2Configured()).toBe(false)
    process.env.R2_PUBLIC_BUCKET_NAME = 'public-bucket'
    expect(isPublicR2Configured()).toBe(true)
  })

  it('allows only implemented private upload types', () => {
    expect(isPrivateUploadType('note')).toBe(true)
    expect(isPrivateUploadType('submission')).toBe(true)
    expect(isPrivateUploadType('logo')).toBe(false)
    expect(isPrivateUploadType('../note')).toBe(false)
  })

  it('keeps public upload types separate from private documents', () => {
    expect(isPublicUploadType('logo')).toBe(true)
    expect(isPublicUploadType('programme_thumbnail')).toBe(true)
    expect(isPublicUploadType('note')).toBe(false)
    expect(isPrivateUploadType('logo')).toBe(false)
  })

  it('builds tenant-, entity-, and context-scoped public keys', () => {
    const key = buildPublicFileKey('school-1', 'banner', 'school-1', 'webp', 'file-1')
    expect(key).toBe('schools/school-1/public/banner/school-1/file-1.webp')
    expect(() => assertPublicFileKey(key, 'school-1', 'banner', 'school-1')).not.toThrow()
    expect(() => assertPublicFileKey(key, 'school-2', 'banner', 'school-1')).toThrowError(StorageError)
    expect(() => assertPublicFileKey(key, 'school-1', 'logo', 'school-1')).toThrowError(StorageError)
  })

  it('enforces media-specific MIME types and limits', () => {
    expect(validatePublicMediaMetadata({
      entityType: 'logo', fileName: 'logo.webp', contentType: 'image/webp', fileSizeBytes: 1024,
    })).toEqual({ extension: 'webp', fileSizeBytes: 1024 })
    expect(() => validatePublicMediaMetadata({
      entityType: 'logo', fileName: 'intro.mp4', contentType: 'video/mp4', fileSizeBytes: 1024,
    })).toThrowError('Invalid file type for this media field')
    expect(() => validatePublicMediaMetadata({
      entityType: 'banner', fileName: 'banner.png', contentType: 'image/png', fileSizeBytes: MAX_PUBLIC_IMAGE_SIZE + 1,
    })).toThrowError('File exceeds 10MB limit')
  })

  it('creates and parses stable public URLs only under the configured base URL', () => {
    process.env.R2_PUBLIC_BASE_URL = 'https://cdn.example.com/'
    const key = 'schools/school-1/public/logo/school-1/file 1.png'
    const url = publicFileUrl(key)
    expect(url).toBe('https://cdn.example.com/schools/school-1/public/logo/school-1/file%201.png')
    expect(publicFileKeyFromUrl(url)).toBe(key)
    expect(publicFileKeyFromUrl('https://other.example.com/file.png')).toBeNull()
  })

  it('rejects server-generated objects outside the public key namespace', async () => {
    await expect(uploadPublicObject({
      fileKey: 'schools/school-1/private/slides/page-1.jpg',
      body: Buffer.from('jpeg'),
      contentType: 'image/jpeg',
    })).rejects.toThrowError('Invalid public object key')
  })

  it('builds and validates tenant- and entity-scoped keys', () => {
    const key = buildPrivateFileKey('school-1', 'note', 'course-1', 'pdf', 'file-1')
    expect(key).toBe('schools/school-1/private/note/course-1/file-1.pdf')
    expect(() => assertPrivateFileKey(key, 'school-1', 'note', 'course-1')).not.toThrow()
    expect(() => assertPrivateFileKey(key, 'school-2', 'note')).toThrowError(StorageError)
    expect(() => assertPrivateFileKey(key, 'school-1', 'submission')).toThrowError(StorageError)
    expect(() => assertPrivateFileKey(key, 'school-1', 'note', 'course-2')).toThrowError(StorageError)
    expect(() => assertPrivateFileKey('schools/school-1/private/note/../secret.pdf', 'school-1')).toThrowError(StorageError)
  })

  it('requires matching MIME type, extension, and size', () => {
    expect(validateDocumentMetadata({
      fileName: 'lesson.pdf',
      contentType: 'application/pdf',
      fileSizeBytes: 1024,
    })).toEqual({ extension: 'pdf', fileSizeBytes: 1024 })

    expect(() => validateDocumentMetadata({
      fileName: 'malware.pdf',
      contentType: 'image/png',
      fileSizeBytes: 1024,
    })).toThrowError('Filename extension does not match content type')

    expect(() => validateDocumentMetadata({
      fileName: 'large.pdf',
      contentType: 'application/pdf',
      fileSizeBytes: MAX_DOCUMENT_SIZE + 1,
    })).toThrowError('File exceeds 50MB limit')
  })

  it('normalizes MIME types to the database file-type values', () => {
    expect(documentFileType('application/pdf')).toBe('pdf')
    expect(documentFileType('image/jpeg')).toBe('jpg')
    expect(() => documentFileType('application/octet-stream')).toThrowError(StorageError)
  })
})
