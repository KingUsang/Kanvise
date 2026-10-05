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
      preview="Your Kanvise account is ready. 👀"
      logoUrl={logoUrl}
    >
      <Text style={styles.copy}>Hey {firstName}!</Text>
      <Text style={styles.copy}>
        Kavi here. Your Kanvise account is fully set up and ready to go.
      </Text>
      <Text style={styles.copy}>
        You can now jump in to access your classes, assignments, and everything else you need.
      </Text>
      <Button href={dashboardUrl} style={styles.button}>Open Kanvise →</Button>
      <Text style={styles.copy}>See you inside. 👀</Text>
      <Text style={styles.signature}>Kavi 💛</Text>
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
  signature: { color: '#3C3027', fontSize: '16px', lineHeight: '26px', margin: '20px 0 0', fontWeight: 'bold' },
  note: { color: '#77727F', fontSize: '12px', lineHeight: '19px', margin: 0 },
}
