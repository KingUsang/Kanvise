import { redirect } from 'next/navigation'

// Retired with the legacy signed tutor invite (DEV-SEC-008, DEV-AUTH-002).
// Durable invitations complete through /auth/complete-invitation.
export default function LegacyCompleteTutorInvitePage(): never {
  redirect('/invite')
}
