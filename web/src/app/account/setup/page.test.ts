import { describe, expect, it } from 'vitest'
import { accountDashboardPath, optionalProfileChanged } from '@/lib/profile-setup'

const avatar = {
  skin_tone: '#FAD6B1', hair_style: 'Short', hair_colour: '#2b2b2b',
  face_shape: 'Oval', outfit_colour: '#2563EB',
}

describe('optional account setup', () => {
  it('continues directly to the correct dashboard for every role', () => {
    expect(accountDashboardPath('admin')).toBe('/dashboard')
    expect(accountDashboardPath('tutor')).toBe('/dashboard')
    expect(accountDashboardPath('student')).toBe('/dashboard/student')
  })

  it('only treats optional profile customisation as dirty when it changed', () => {
    expect(optionalProfileChanged('', '', avatar, { ...avatar })).toBe(false)
    expect(optionalProfileChanged('Tutor', '', avatar, { ...avatar })).toBe(true)
    expect(optionalProfileChanged('', '', { ...avatar, hair_style: 'Long' }, avatar)).toBe(true)
  })
})
