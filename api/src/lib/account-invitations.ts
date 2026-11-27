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

export class InvitationRejectedError extends Error {
  constructor(public readonly code: string) {
    super(code)
    this.name = 'InvitationRejectedError'
  }
}

const REJECTION_RESPONSES: Record<string, { status: 404 | 403 | 409 | 410; error: string }> = {
  INVITATION_NOT_FOUND: { status: 404, error: 'This invitation link is invalid' },
  INVITATION_EMAIL_MISMATCH: { status: 403, error: 'This invitation was sent to a different email address' },
  INVITATION_EXPIRED: { status: 410, error: 'This invitation has expired' },
  INVITATION_NOT_PENDING: { status: 409, error: 'This invitation is no longer active' },
  INVITATION_AUTH_USER_MISMATCH: { status: 409, error: 'This invitation is already linked to another sign-in' },
  INVITATION_PROFILE_MISMATCH: { status: 409, error: 'This invitation no longer matches its student profile' },
  INVITATION_ROLE_MISMATCH: { status: 409, error: 'This invitation does not match the requested account type' },
  TUTOR_INVITATION_REQUIRED: { status: 409, error: 'A tutor invitation from your tutoring agency is required' },
}

// Maps a database rejection to a stable, safe response. Unknown errors are
// dependency failures and must be reported as retryable, never echoed.
export function invitationFailureResponse(error: unknown) {
  const code = error instanceof InvitationRejectedError
    ? error.code
    : typeof (error as any)?.message === 'string' ? (error as any).message : ''
  const known = REJECTION_RESPONSES[code]
  if (known) return { status: known.status, body: { error: known.error, code } }
  return {
    status: 503 as const,
    body: { error: 'We could not complete this invitation right now. Try again shortly.', code: 'INVITATION_UNAVAILABLE', retryable: true },
  }
}

// Revokes any pending invitation for the same recipient and creates the new
// one in a single database transaction (tutor invitations also write their
// listing row there).
export async function createAccountInvitation(input: {
  schoolId: string
  invitedBy: string
  role: 'tutor' | 'student'
  email: string
  studentProfileId?: string
  metadata?: Record<string, unknown>
}) {
  const token = createInvitationToken()
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS).toISOString()
  const { data, error } = await (supabase as any).rpc('issue_account_invitation', {
    p_school_id: input.schoolId,
    p_invited_by: input.invitedBy,
    p_role: input.role,
    p_email: input.email.trim().toLowerCase(),
    p_token_hash: invitationTokenHash(token),
    p_expires_at: expiresAt,
    p_student_profile_id: input.studentProfileId ?? null,
    p_metadata: input.metadata || {},
  })
  if (error || !data) throw error || new Error('Could not create invitation')
  return {
    invitation: { id: data.invitation_id as string },
    tutorInviteId: (data.tutor_invite_id ?? null) as string | null,
    token,
    expiresAt: (data.expires_at ?? expiresAt) as string,
  }
}

export async function consumeAccountInvitation(token: string, email: string, authUserId: string) {
  const { data, error } = await (supabase as any).rpc('consume_account_invitation', {
    p_token_hash: invitationTokenHash(token),
    p_email: email,
    p_supabase_auth_id: authUserId,
  })
  if (error || !data) throw error || new Error('Invitation could not be completed')
  // An expired invitation is persisted as expired and returned, not raised.
  if (data.status !== 'accepted') {
    throw new InvitationRejectedError(data.status === 'expired' ? 'INVITATION_EXPIRED' : 'INVITATION_NOT_PENDING')
  }
  return data
}
