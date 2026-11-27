import { supabase } from '../lib/supabase'
import { StorageError } from './r2'

// The presigned URL lives 15 minutes. Intents stay valid for an hour so a slow
// confirmation still works; after that the sweep job deletes the object.
export const UPLOAD_INTENT_TTL_MS = 60 * 60 * 1000

export type UploadIntentScope = 'private' | 'public'

export type UploadIntentIdentity = { schoolId: string; requesterId: string; fileKey: string }

/**
 * Record a single-use intent for a presigned key. Callers must do this before
 * returning the presigned URL, and must not hand the URL out when it throws.
 */
export async function recordUploadIntent(input: UploadIntentIdentity & {
  scope: UploadIntentScope
  entityType: string
  contextId: string
  contentType: string
  fileSizeBytes: number
}) {
  const { error } = await supabase.from('upload_intents').insert({
    school_id: input.schoolId,
    requester_id: input.requesterId,
    scope: input.scope,
    entity_type: input.entityType,
    context_id: input.contextId,
    file_key: input.fileKey,
    content_type: input.contentType,
    file_size_bytes: input.fileSizeBytes,
    expires_at: new Date(Date.now() + UPLOAD_INTENT_TTL_MS).toISOString(),
  })
  if (error) intentStoreUnavailable(error)
}

function intentStoreUnavailable(error: unknown): never {
  console.error('storage.upload_intent_store_failed', error)
  throw new StorageError('Upload tracking is temporarily unavailable. Please retry.', 'SERVICE_UNAVAILABLE', 503)
}

/**
 * Consume the intent for a key exactly once. Keys presigned before intents
 * existed have no row ('legacy') and are accepted; every other state except
 * 'consumed' is a rejection.
 */
export async function consumeUploadIntent({ schoolId, requesterId, fileKey }: UploadIntentIdentity) {
  const { data, error } = await supabase.rpc('consume_upload_intent', {
    p_school_id: schoolId, p_requester_id: requesterId, p_file_key: fileKey,
  })
  if (error) intentStoreUnavailable(error)
  switch (data) {
    case 'consumed':
    case 'legacy':
      return data
    case 'already_consumed':
      throw new StorageError('This upload has already been registered', 'UPLOAD_INTENT_USED', 409)
    case 'expired':
      throw new StorageError('This upload has expired. Please upload the file again.', 'UPLOAD_INTENT_EXPIRED', 409)
    default:
      throw new StorageError('This upload was not issued to you', 'UPLOAD_INTENT_FORBIDDEN', 403)
  }
}

/** Make a consumed intent usable again after registration failed. Never throws. */
export async function releaseUploadIntent(identity: UploadIntentIdentity) {
  try {
    const { error } = await supabase.rpc('release_upload_intent', {
      p_school_id: identity.schoolId, p_requester_id: identity.requesterId, p_file_key: identity.fileKey,
    })
    if (error) throw error
  } catch (error) {
    console.error('storage.upload_intent_release_failed', { fileKey: identity.fileKey, error })
  }
}
