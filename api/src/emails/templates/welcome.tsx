import { Button, Heading, Text } from '@react-email/components'
import { BrandedLayout } from './branded-layout'

export type WelcomeEmailProps = {
  firstName: string
  dashboardUrl: string
  logoUrl: string
}

export function WelcomeEmail({ firstName, dashboardUrl, logoUrl }: WelcomeEmailProps) {
  return (
    <BrandedLayout
      preview="Your Kanvise account is ready."
      logoUrl={logoUrl}
    >
      <Text style={styles.eyebrow}>WELCOME TO KANVISE</Text>
      <Heading as="h1" style={styles.heading}>Welcome, {firstName}.</Heading>
      <Text style={styles.copy}>
        Your account is ready. You can now continue setting up your profile and access your Kanvise workspace.
      </Text>
      <Button href={dashboardUrl} style={styles.button}>Open Kanvise</Button>
      <Text style={styles.note}>
        If you did not create this account, you can safely ignore this email.
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
  copy: { color: '#3C3027', fontSize: '16px', lineHeight: '26px', margin: '0 0 20px' },
  button: {
    backgroundColor: '#C26627',
    borderRadius: '10px',
    color: '#FFFFFF',
    display: 'inline-block',
    fontSize: '15px',
    fontWeight: 700,
    margin: '10px 0 22px',
    padding: '14px 24px',
    textDecoration: 'none',
  },
  note: { color: '#77727F', fontSize: '12px', lineHeight: '19px', margin: 0 },
}
