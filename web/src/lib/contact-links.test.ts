import { describe, expect, it } from 'vitest'
import { buildWhatsAppHref } from './contact-links'

describe('buildWhatsAppHref', () => {
  it('uses the international number without formatting characters', () => {
    expect(buildWhatsAppHref('+234 801 234-5678')).toBe('https://wa.me/2348012345678')
  })

  it('does not create an empty WhatsApp link', () => {
    expect(buildWhatsAppHref(null)).toBeNull()
  })
})
