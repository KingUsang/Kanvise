import { describe, expect, it } from 'vitest'
import {
  canTutorPublishMarketplace,
  distributionRequiresCourse,
  distributionUsesMarketplace,
  parseMockDistributionMode,
} from './mock-distribution'

describe('mock distribution contract', () => {
  it('allows a course to be omitted only for marketplace-only mocks', () => {
    expect(distributionRequiresCourse('centre')).toBe(true)
    expect(distributionRequiresCourse('both')).toBe(true)
    expect(distributionRequiresCourse('marketplace')).toBe(false)
  })

  it('recognises the marketplace distributions', () => {
    expect(distributionUsesMarketplace('centre')).toBe(false)
    expect(distributionUsesMarketplace('marketplace')).toBe(true)
    expect(distributionUsesMarketplace('both')).toBe(true)
  })

  it('accepts only supported distribution modes', () => {
    expect(parseMockDistributionMode('marketplace')).toBe('marketplace')
    expect(parseMockDistributionMode('public')).toBeNull()
    expect(parseMockDistributionMode(null)).toBeNull()
  })

  it('lets admins publish marketplace mocks directly', () => {
    expect(canTutorPublishMarketplace('admin')).toBe(true)
    expect(canTutorPublishMarketplace('tutor')).toBe(false)
  })
})
