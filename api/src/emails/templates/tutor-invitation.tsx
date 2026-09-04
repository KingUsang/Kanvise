import { Button, Heading, Text } from '@react-email/components'
import { BrandedLayout } from './branded-layout'

export type TutorInvitationProps = {
  inviteUrl: string
  invitedByName: string
  schoolName: string
  expiresAt: string
  logoUrl: string
}

export function TutorInvitationEmail({
  inviteUrl,
  invitedByName,
  schoolName,
  expiresAt,
  logoUrl,
}: TutorInvitationProps) {
  const expiry = new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'long',
    timeZone: 'Africa/Lagos',
  }).format(new Date(expiresAt))

  return (
    <BrandedLayout
      preview={`${invitedByName} invited you to join ${schoolName} on Kanvise.`}
      logoUrl={logoUrl}
    >
      <Text style={styles.eyebrow}>TUTOR INVITATION</Text>
      <Heading as="h1" style={styles.heading}>You’ve been invited to teach.</Heading>
      <Text style={styles.copy}>
        {invitedByName} has invited you to join <strong>{schoolName}</strong> as a tutor on Kanvise.
      </Text>
      <Text style={styles.copy}>
        Set up your account to access your subjects, students, classes, and teaching tools.
      </Text>
      <Button href={inviteUrl} style={styles.button}>Accept invitation</Button>
      <Text style={styles.expiry}>This invitation expires on {expiry}.</Text>
      <Text style={styles.fallback}>
        If the button does not work, copy and paste this link into your browser:<br />
        {inviteUrl}
      </Text>
    </BrandedLayout>
  )
}

const styles = {
  eyebrow: {
    color: '#C26627',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '1.5px',
    margin: '0 0 12px',
  },
  heading: {
    color: '#322B7A',
    fontSize: '30px',
    lineHeight: '38px',
    margin: '0 0 20px',
  },
  copy: { color: '#3C3027', fontSize: '16px', lineHeight: '26px', margin: '0 0 16px' },
  button: {
    backgroundColor: '#C26627',
    borderRadius: '10px',
    color: '#FFFFFF',
    display: 'inline-block',
    fontSize: '15px',
    fontWeight: 700,
    margin: '14px 0 20px',
    padding: '14px 24px',
    textDecoration: 'none',
  },
  expiry: { color: '#5F5964', fontSize: '13px', lineHeight: '20px', margin: '0 0 20px' },
  fallback: {
    color: '#77727F',
    fontSize: '11px',
    lineHeight: '18px',
    margin: 0,
    overflowWrap: 'anywhere' as const,
  },
}
