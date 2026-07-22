import { describe, expect, it } from 'vitest'
import { resolveTrustedProfileClaims } from './auth'

describe('resolveTrustedProfileClaims', () => {
  it('uses server-controlled app metadata for the profile fast path', () => {
    expect(resolveTrustedProfileClaims({
      sub: 'auth-user-1',
      app_metadata: {
        role: 'admin',
        school_id: 'school-1',
        profile_id: 'profile-1',
        kanvise_user_id: 'KNV-ADM-00001',
      },
    })).toEqual({
      id: 'profile-1',
      supabase_auth_id: 'auth-user-1',
      role: 'admin',
      school_id: 'school-1',
      kanvise_user_id: 'KNV-ADM-00001',
    })
  })

  it('ignores user-editable metadata for authorisation', () => {
    expect(resolveTrustedProfileClaims({
      sub: 'auth-user-1',
      user_metadata: {
        kanvise_role: 'admin',
        school_id: 'another-school',
        profile_id: 'another-profile',
        kanvise_user_id: 'KNV-ADM-99999',
      },
    })).toBeNull()
  })

  it('falls back to database resolution when required claims are incomplete', () => {
    expect(resolveTrustedProfileClaims({
      sub: 'auth-user-1',
      app_metadata: { role: 'tutor' },
    })).toBeNull()
  })
})
