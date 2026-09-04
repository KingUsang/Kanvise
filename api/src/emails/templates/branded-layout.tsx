import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { ReactNode } from 'react'

type BrandedLayoutProps = {
  preview: string
  logoUrl: string
  children: ReactNode
}

export function BrandedLayout({ preview, logoUrl, children }: BrandedLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Img src={logoUrl} width="54" height="49" alt="Kanvise" style={styles.logo} />
            <Text style={styles.wordmark}>KANVISE</Text>
          </Section>
          <Section style={styles.content}>{children}</Section>
          <Hr style={styles.rule} />
          <Text style={styles.footer}>
            Kanvise helps tutorial centres run focused, professional virtual schools.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const styles = {
  body: {
    backgroundColor: '#F7F5F2',
    color: '#3C3027',
    fontFamily: 'Arial, Helvetica, sans-serif',
    margin: 0,
    padding: '32px 12px',
  },
  container: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E3DED5',
    borderRadius: '16px',
    margin: '0 auto',
    maxWidth: '600px',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#F1EFEA',
    padding: '24px 36px',
  },
  logo: { display: 'inline-block', verticalAlign: 'middle' },
  wordmark: {
    color: '#322B7A',
    display: 'inline-block',
    fontSize: '18px',
    fontWeight: 700,
    letterSpacing: '3px',
    margin: '0 0 0 14px',
    verticalAlign: 'middle',
  },
  content: { padding: '38px 36px 28px' },
  rule: { borderColor: '#E3DED5', margin: '0 36px' },
  footer: {
    color: '#77727F',
    fontSize: '12px',
    lineHeight: '18px',
    margin: 0,
    padding: '22px 36px 28px',
    textAlign: 'center' as const,
  },
}
