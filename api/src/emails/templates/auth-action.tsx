import { Button, Heading, Text } from '@react-email/components'
import { BrandedLayout } from './branded-layout'

export type AuthActionEmailProps = {
  actionLabel?: string
  actionUrl?: string
  body: string
  code?: string
  heading: string
  logoUrl: string
  preview: string
}

export function AuthActionEmail({
  actionLabel,
  actionUrl,
  body,
  code,
  heading,
  logoUrl,
  preview,
}: AuthActionEmailProps) {
  return <BrandedLayout preview={preview} logoUrl={logoUrl}>
    <Text style={styles.eyebrow}>KANVISE ACCOUNT SECURITY</Text>
    <Heading as="h1" style={styles.heading}>{heading}</Heading>
    <Text style={styles.copy}>{body}</Text>
    {code && <>
      <Text style={styles.codeLabel}>YOUR SIX-DIGIT CODE</Text>
      <Text style={styles.code}>{code}</Text>
    </>}
    {actionUrl && actionLabel && <Button href={actionUrl} style={styles.button}>{actionLabel}</Button>}
    {actionUrl && <Text style={styles.fallback}>
      If the button does not work, copy and paste this link into your browser:<br />
      {actionUrl}
    </Text>}
    <Text style={styles.note}>If you did not request this, you can safely ignore this email.</Text>
  </BrandedLayout>
}

const styles = {
  eyebrow: { color: '#C26627', fontSize: '12px', fontWeight: 700, letterSpacing: '1.5px', margin: '0 0 12px' },
  heading: { color: '#322B7A', fontSize: '30px', lineHeight: '38px', margin: '0 0 20px' },
  copy: { color: '#3C3027', fontSize: '16px', lineHeight: '26px', margin: '0 0 20px' },
  codeLabel: { color: '#77727F', fontSize: '11px', fontWeight: 700, letterSpacing: '1.2px', margin: '8px 0' },
  code: {
    backgroundColor: '#F1EFEA', borderRadius: '10px', color: '#322B7A', fontSize: '30px',
    fontWeight: 700, letterSpacing: '8px', margin: '0 0 22px', padding: '18px', textAlign: 'center' as const,
  },
  button: {
    backgroundColor: '#C26627', borderRadius: '10px', color: '#FFFFFF', display: 'inline-block',
    fontSize: '15px', fontWeight: 700, margin: '8px 0 20px', padding: '14px 24px', textDecoration: 'none',
  },
  fallback: { color: '#77727F', fontSize: '11px', lineHeight: '18px', margin: '0 0 20px', overflowWrap: 'anywhere' as const },
  note: { color: '#77727F', fontSize: '12px', lineHeight: '19px', margin: 0 },
}
