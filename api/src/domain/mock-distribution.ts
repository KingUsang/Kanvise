export type MockDistributionMode = 'centre' | 'marketplace' | 'both'

const modes = new Set<MockDistributionMode>(['centre', 'marketplace', 'both'])

export function parseMockDistributionMode(value: unknown): MockDistributionMode | null {
  return typeof value === 'string' && modes.has(value as MockDistributionMode)
    ? value as MockDistributionMode
    : null
}

export function distributionRequiresCourse(mode: MockDistributionMode) {
  return mode === 'centre' || mode === 'both'
}

export function distributionUsesMarketplace(mode: MockDistributionMode) {
  return mode === 'marketplace' || mode === 'both'
}

export function canTutorPublishMarketplace(role: string) {
  return role === 'admin'
}
