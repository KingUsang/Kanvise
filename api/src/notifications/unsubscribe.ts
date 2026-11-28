import { createHash, randomBytes } from 'node:crypto'
import { supabase } from '../lib/supabase'
import { isNotificationRowKey, notificationRows, rowDefault, rowEmailLabel, type NotificationRowKey } from './rows'

/**
 * Unsubscribe links (18 NTF-04, NTF-08; 20 DM-15).
 *
 * Each switchable email gets its own token: 32 random bytes, base64url. Only
 * its sha-256 hash is stored, and lookups are by hash, so the raw token is
 * never compared or kept anywhere but the email. A token switches exactly one
 * row's email for one person in one account (standard 03: minimum scope).
 *
 * A link works for 90 days. Once used, it keeps working for a day so the page
 * can be reloaded and Undo pressed; after that it shows "This link has
 * expired." Unknown, malformed and expired tokens all get the same answer.
 */

export const UNSUBSCRIBE_TOKEN_TTL_DAYS = 90
/** Must match apply_unsubscribe_token in 20261128090000_message_channels.sql. */
export const USED_TOKEN_GRACE_MS = 24 * 60 * 60_000

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

export type StoredUnsubscribeToken = {
  personId: string
  schoolId: string | null
  rowKey: string
  expiresAt: string
  usedAt: string | null
}

export type UnsubscribeStore = {
  insertToken(input: { personId: string; schoolId: string | null; rowKey: NotificationRowKey; tokenHash: string; expiresAt: string }): Promise<void>
  findToken(tokenHash: string): Promise<StoredUnsubscribeToken | null>
  emailPreference(personId: string, schoolId: string | null, rowKey: NotificationRowKey): Promise<boolean | null>
  /** Atomic: marks the token used and sets the row's email. Null when the token is no longer valid. */
  applyToken(tokenHash: string, emailOn: boolean): Promise<{ rowKey: string; emailOn: boolean } | null>
}

export type UnsubscribeState =
  | { state: 'expired' }
  | { state: 'subscribed' | 'unsubscribed'; row_label: string }

export function hashUnsubscribeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function isWellFormedUnsubscribeToken(token: unknown): token is string {
  return typeof token === 'string' && TOKEN_PATTERN.test(token)
}

export const supabaseUnsubscribeStore: UnsubscribeStore = {
  async insertToken(input) {
    const { error } = await supabase.from('unsubscribe_tokens').insert({
      person_id: input.personId,
      school_id: input.schoolId,
      row_key: input.rowKey,
      token_hash: input.tokenHash,
      expires_at: input.expiresAt,
    })
    if (error) throw error
  },
  async findToken(tokenHash) {
    const { data, error } = await supabase.from('unsubscribe_tokens')
      .select('person_id, school_id, row_key, expires_at, used_at')
      .eq('token_hash', tokenHash)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return {
      personId: data.person_id,
      schoolId: data.school_id,
      rowKey: data.row_key,
      expiresAt: data.expires_at,
      usedAt: data.used_at,
    }
  },
  async emailPreference(personId, schoolId, rowKey) {
    let query = supabase.from('notification_preferences').select('email_on')
      .eq('person_id', personId).eq('row_key', rowKey)
    query = schoolId ? query.eq('school_id', schoolId) : query.is('school_id', null)
    const { data, error } = await query.maybeSingle()
    if (error) throw error
    return data?.email_on ?? null
  },
  async applyToken(tokenHash, emailOn) {
    const { data, error } = await supabase.rpc('apply_unsubscribe_token', { p_token_hash: tokenHash, p_email_on: emailOn })
    if (error) throw error
    const row = data?.[0]
    return row ? { rowKey: row.applied_row_key, emailOn: row.applied_email_on } : null
  },
}

/**
 * Deletes tokens that can no longer be used: expired ones, and used ones past
 * the one-day grace. Rows still inside either window are kept so reloads and
 * Undo keep working. Returns how many rows were removed.
 */
export async function purgeUnsubscribeTokens(
  client: Pick<typeof supabase, 'from'> = supabase,
  now: Date = new Date(),
): Promise<number> {
  const nowIso = now.toISOString()
  const usedBefore = new Date(now.getTime() - USED_TOKEN_GRACE_MS).toISOString()
  const expired = await client.from('unsubscribe_tokens').delete().lte('expires_at', nowIso).select('id')
  if (expired.error) throw expired.error
  const used = await client.from('unsubscribe_tokens').delete().lte('used_at', usedBefore).select('id')
  if (used.error) throw used.error
  return (expired.data?.length ?? 0) + (used.data?.length ?? 0)
}

/** A new raw token for one email. Only its hash is stored. */
export async function issueUnsubscribeToken(
  input: { personId: string; schoolId: string | null; rowKey: NotificationRowKey },
  store: UnsubscribeStore = supabaseUnsubscribeStore,
  now: Date = new Date(),
): Promise<string> {
  const row = notificationRows[input.rowKey]
  if (!(row.channels as ReadonlyArray<string>).includes('email')) throw new Error(`${input.rowKey} has no email to unsubscribe from`)
  const schoolId = row.scope === 'person' ? null : input.schoolId
  if (row.scope === 'account' && !schoolId) throw new Error(`${input.rowKey} needs an account`)
  const token = randomBytes(32).toString('base64url')
  await store.insertToken({
    personId: input.personId,
    schoolId,
    rowKey: input.rowKey,
    tokenHash: hashUnsubscribeToken(token),
    expiresAt: new Date(now.getTime() + UNSUBSCRIBE_TOKEN_TTL_DAYS * 24 * 60 * 60_000).toISOString(),
  })
  return token
}

const expired: UnsubscribeState = { state: 'expired' }

function stillValid(token: StoredUnsubscribeToken, now: Date): token is StoredUnsubscribeToken & { rowKey: NotificationRowKey } {
  if (!isNotificationRowKey(token.rowKey)) return false
  if (new Date(token.expiresAt).getTime() <= now.getTime()) return false
  return !token.usedAt || new Date(token.usedAt).getTime() > now.getTime() - USED_TOKEN_GRACE_MS
}

/** What the page shows before anything is pressed. Never changes anything (mail scanners open links). */
export async function lookupUnsubscribe(
  token: unknown,
  store: UnsubscribeStore = supabaseUnsubscribeStore,
  now: Date = new Date(),
): Promise<UnsubscribeState> {
  if (!isWellFormedUnsubscribeToken(token)) return expired
  const stored = await store.findToken(hashUnsubscribeToken(token))
  if (!stored || !stillValid(stored, now)) return expired
  const emailOn = await store.emailPreference(stored.personId, stored.schoolId, stored.rowKey)
  const on = emailOn ?? rowDefault(stored.rowKey, 'email')
  return { state: on ? 'subscribed' : 'unsubscribed', row_label: rowEmailLabel(stored.rowKey) }
}

async function setEmail(token: unknown, emailOn: boolean, store: UnsubscribeStore): Promise<UnsubscribeState> {
  if (!isWellFormedUnsubscribeToken(token)) return expired
  const applied = await store.applyToken(hashUnsubscribeToken(token), emailOn)
  if (!applied || !isNotificationRowKey(applied.rowKey)) return expired
  return { state: applied.emailOn ? 'subscribed' : 'unsubscribed', row_label: rowEmailLabel(applied.rowKey) }
}

/** Switch the row's email off. Pressing it again gives the same result. */
export function unsubscribe(token: unknown, store: UnsubscribeStore = supabaseUnsubscribeStore) {
  return setEmail(token, false, store)
}

/** The page's Undo: switch the row's email back on. */
export function undoUnsubscribe(token: unknown, store: UnsubscribeStore = supabaseUnsubscribeStore) {
  return setEmail(token, true, store)
}
