import { describe, expect, it } from 'vitest'
import { meetsPasswordPolicy, passwordChecks } from './password-policy'

describe('password policy', () => {
  it('accepts the shared registration and password-setup policy', () => {
    expect(meetsPasswordPolicy('Kanvise8')).toBe(true)
  })

  it.each(['Short1', 'kanvise8', 'KANVISE8', 'Kanvises'])('rejects %s', password => {
    expect(meetsPasswordPolicy(password)).toBe(false)
  })

  it('reports each requirement independently', () => {
    expect(passwordChecks('ABC123')).toEqual({
      hasMinLength: false,
      hasLowercase: false,
      hasUppercase: true,
      hasNumber: true,
    })
  })
})
