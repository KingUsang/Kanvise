import { describe, expect, it } from 'vitest'
import { normalizeSchoolProfileUpdate, normalizeSchoolSlug, schoolSlugCandidates, SchoolProfileValidationError } from './school-profile'

describe('school profile normalization', () => {
  it('accepts handles and legitimate platform URL variations', () => {
    expect(normalizeSchoolProfileUpdate({
      website_url: 'kanvise.com/about',
      instagram_url: '@kanvise.school',
      twitter_url: 'https://twitter.com/kanvise_app?ref=profile',
      facebook_url: 'm.facebook.com/profile.php?id=123',
    })).toEqual({
      website_url: 'https://kanvise.com/about',
      instagram_url: 'https://instagram.com/kanvise.school',
      twitter_url: 'https://twitter.com/kanvise_app?ref=profile',
      facebook_url: 'https://m.facebook.com/profile.php?id=123',
    })
  })

  it('normalizes emails and international phone numbers', () => {
    expect(normalizeSchoolProfileUpdate({
      contact_email: ' INFO@KANVISE.COM ',
      contact_phone: '+234 (801) 234-5678',
      whatsapp_number: '00234 802 345 6789',
    })).toEqual({
      contact_email: 'info@kanvise.com',
      contact_phone: '+2348012345678',
      whatsapp_number: '+2348023456789',
    })
  })

  it('rejects lookalike social domains and ambiguous local phone numbers', () => {
    expect(() => normalizeSchoolProfileUpdate({ instagram_url: 'instagram.com.example.org/kanvise' })).toThrow(SchoolProfileValidationError)
    expect(() => normalizeSchoolProfileUpdate({ contact_phone: '08012345678' })).toThrow(/country code/i)
  })

  it('only returns fields present in a partial update', () => {
    expect(normalizeSchoolProfileUpdate({ name: '  Kanvise Academy  ' })).toEqual({ name: 'Kanvise Academy' })
  })

  it('generates bounded fallback slugs when a centre name is already taken', () => {
    expect(normalizeSchoolSlug(' Emmanuel’s JAMB & WAEC Centre ')).toBe('emmanuel-s-jamb-waec-centre')
    expect(schoolSlugCandidates('Bright Future', undefined, 4)).toEqual([
      'bright-future',
      'bright-future-2',
      'bright-future-3',
      'bright-future-4',
    ])
    expect(schoolSlugCandidates('Bright Future', 'my-centre')).toEqual(['my-centre'])
    expect(schoolSlugCandidates('A'.repeat(80), undefined, 2).every((slug) => slug.length <= 64)).toBe(true)
  })
})
