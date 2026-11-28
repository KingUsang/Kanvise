import { Button, Heading, Text } from '@react-email/components'
import type { ReactNode } from 'react'
import { formatEmailDateTime } from '../format-email-time'
import type { EmailFooter } from '../footer'

export { formatEmailDateTime }

/** What every template gets besides its own input (18 NTF-04). */
export type EmailChrome = {
  logoUrl: string
  footer: EmailFooter
  /** The account's timezone: every time in the email is written in it. */
  timeZone: string
}

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

/** '28 November 2026 at 4:00 pm' in the given zone (payment receipts keep this style). */
export function formatLongEmailDate(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(value))
}

/** '28 November 2026' in the given zone, for invitation expiry dates. */
export function formatLongEmailDay(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-NG', { dateStyle: 'long', timeZone }).format(new Date(value))
}

