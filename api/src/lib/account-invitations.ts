import { createHash, randomBytes } from 'node:crypto'
import { supabase } from './supabase'

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function invitationTokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function createInvitationToken() {
  return randomBytes(32).toString('base64url')
}

export function accountInvitationStatus(invitation: { status: string; expires_at: string }, now = Date.now()) {
  return invitation.status === 'pending' && new Date(invitation.expires_at).getTime() <= now
    ? 'expired'
    : invitation.status
}

export async function findAccountInvitation(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null
  const { data, error } = await (supabase as any)
    .from('account_invitations')
    .select('*, school:schools(name)')
    .eq('token_hash', invitationTokenHash(token))
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createAccountInvitation(input: {
  schoolId: string
  invitedBy: string
  role: 'tutor' | 'student'
  email: string
  studentProfileId?: string
  tutorInviteId?: string
  metadata?: Record<string, unknown>
}) {
  const token = createInvitationToken()
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS).toISOString()
  const email = input.email.trim().toLowerCase()

  const existing = await (supabase as any).from('account_invitations')
    .select('id')
    .eq('school_id', input.schoolId)
    .eq('role', input.role)
    .eq('email', email)
    .eq('status', 'pending')
    .maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data) {
    const expired = await (supabase as any).from('account_invitations')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', existing.data.id)
    if (expired.error) throw expired.error
  }

  const { data, error } = await (supabase as any).from('account_invitations').insert({
    school_id: input.schoolId,
    invited_by: input.invitedBy,
    role: input.role,
    email,
    token_hash: invitationTokenHash(token),
    status: 'pending',
    expires_at: expiresAt,
    student_profile_id: input.studentProfileId || null,
    tutor_invite_id: input.tutorInviteId || null,
    metadata: input.metadata || {},
  }).select('*').single()
  if (error || !data) throw error || new Error('Could not create invitation')
  return { invitation: data, token, expiresAt }
}

export async function consumeAccountInvitation(token: string, email: string, authUserId: string) {
  const { data, error } = await (supabase as any).rpc('consume_account_invitation', {
    p_token_hash: invitationTokenHash(token),
    p_email: email,
    p_supabase_auth_id: authUserId,
  })
  if (error || !data) throw error || new Error('Invitation could not be completed')
  return data
}
