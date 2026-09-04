export type MockDistributionMode = 'centre'

const modes = new Set<MockDistributionMode>(['centre'])

export function parseMockDistributionMode(value: unknown): MockDistributionMode | null {
  return typeof value === 'string' && modes.has(value as MockDistributionMode)
    ? value as MockDistributionMode
    : null
}

export function distributionRequiresCourse(mode: MockDistributionMode) {
  return mode === 'centre'
}
