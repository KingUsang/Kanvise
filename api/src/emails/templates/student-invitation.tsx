import { Button, Text } from '@react-email/components'
import { BrandedLayout } from './branded-layout'

export function StudentInvitationEmail({ inviteUrl, invitedByName, schoolName, programmeName, expiresAt, logoUrl }: {
  inviteUrl: string
  invitedByName: string
  schoolName: string
  programmeName: string
  expiresAt: string
  logoUrl: string
}) {
  const expiry = new Intl.DateTimeFormat('en-NG', { dateStyle: 'long', timeZone: 'Africa/Lagos' }).format(new Date(expiresAt))
  return <BrandedLayout preview={`${invitedByName} invited you to ${programmeName} on Kanvise.`} logoUrl={logoUrl}>
    <Text style={copy}>Hey!</Text>
    <Text style={copy}>{invitedByName} invited you to <strong>{programmeName}</strong> at <strong>{schoolName}</strong>.</Text>
    <Text style={copy}>Open your invitation to create your account and access your learning dashboard. You can reopen this same link if setup is interrupted.</Text>
    <Button href={inviteUrl} style={button}>Open invitation →</Button>
    <Text style={small}>This invitation expires on {expiry}.</Text>
    <Text style={small}>If the button does not work, copy and paste this link into your browser:<br />{inviteUrl}</Text>
  </BrandedLayout>
}

const copy = { color: '#3C3027', fontSize: '16px', lineHeight: '26px', margin: '0 0 16px' }
const button = { backgroundColor: '#C26627', borderRadius: '10px', color: '#FFFFFF', display: 'inline-block', fontSize: '15px', fontWeight: 700, margin: '14px 0 20px', padding: '14px 24px', textDecoration: 'none' }
const small = { color: '#5F5964', fontSize: '12px', lineHeight: '19px', margin: '0 0 14px', overflowWrap: 'anywhere' as const }
