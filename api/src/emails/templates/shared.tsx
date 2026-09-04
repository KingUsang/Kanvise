import { Button, Heading, Text } from '@react-email/components'
import type { ReactNode } from 'react'

export const templateStyles = {
  eyebrow: { color: '#C26627', fontSize: '12px', fontWeight: 700, letterSpacing: '1.5px', margin: '0 0 12px' },
  heading: { color: '#322B7A', fontSize: '30px', lineHeight: '38px', margin: '0 0 20px' },
  copy: { color: '#3C3027', fontSize: '16px', lineHeight: '26px', margin: '0 0 16px' },
  button: { backgroundColor: '#C26627', borderRadius: '10px', color: '#FFFFFF', display: 'inline-block', fontSize: '15px', fontWeight: 700, margin: '14px 0 20px', padding: '14px 24px', textDecoration: 'none' },
  detail: { color: '#5F5964', fontSize: '14px', lineHeight: '22px', margin: '0 0 8px' },
  note: { color: '#77727F', fontSize: '12px', lineHeight: '19px', margin: '8px 0 0' },
}

export function EmailHeading({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return <><Text style={templateStyles.eyebrow}>{eyebrow}</Text><Heading as="h1" style={templateStyles.heading}>{children}</Heading></>
}

export function EmailButton({ href, children }: { href: string; children: ReactNode }) {
  return <Button href={href} style={templateStyles.button}>{children}</Button>
}

export function formatEmailDate(value: string): string {
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Africa/Lagos',
  }).format(new Date(value))
}

