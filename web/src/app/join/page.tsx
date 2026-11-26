import { redirect } from 'next/navigation'

// The legacy signed tutor invite (/join?token=...) was retired (DEV-SEC-008,
// DEV-AUTH-002). Tutors now join only through durable account invitations at
// /invite. Old links land on /invite without their token, which explains that
// the link is not valid and asks the tutor for a new invitation.
export default function LegacyJoinPage(): never {
  redirect('/invite')
}
