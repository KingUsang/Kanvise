import { describe, expect, it } from 'vitest'
import { governingTimeZoneLabel, instantTimeZoneLabel, viewerTimeZoneLabel } from './viewer-timezone'

describe('schedule timezone labels', () => {
  it('falls back to the viewer zone when no timezone is returned', () => {
    const at = new Date('2025-06-01T10:00:00Z')
    expect(governingTimeZoneLabel(null, at)).toBe(viewerTimeZoneLabel(at))
    expect(instantTimeZoneLabel(undefined, at)).toBe(viewerTimeZoneLabel(at))
  })

  it('names the governing IANA zone for recurring slots', () => {
    expect(governingTimeZoneLabel('Africa/Lagos', new Date('2025-06-01T10:00:00Z'))).toContain('Africa/Lagos')
  })

  it('shows a different short name across a daylight-saving transition in the same zone', () => {
    const winter = governingTimeZoneLabel('America/New_York', new Date('2025-01-15T12:00:00Z'))
    const summer = governingTimeZoneLabel('America/New_York', new Date('2025-07-15T12:00:00Z'))
    expect(winter).toContain('GMT-5')
    expect(summer).toContain('GMT-4')
    expect(winter).not.toBe(summer)
  })

  it('names the series zone when it differs from the viewer zone', () => {
    const viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const other = viewerZone === 'Pacific/Auckland' ? 'Africa/Lagos' : 'Pacific/Auckland'
    const at = new Date('2025-06-01T10:00:00Z')
    expect(instantTimeZoneLabel(other, at)).toContain(`series timezone ${other}`)
    expect(instantTimeZoneLabel(viewerZone, at)).toBe(viewerTimeZoneLabel(at))
  })

  it('falls back for an invalid zone', () => {
    const at = new Date('2025-06-01T10:00:00Z')
    expect(governingTimeZoneLabel('Not/AZone', at)).toBe(viewerTimeZoneLabel(at))
  })
})
