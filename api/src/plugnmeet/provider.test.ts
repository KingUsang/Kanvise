import { describe, expect, it } from 'vitest'
import { providerForClass } from './provider'

describe('classroom provider selection', () => {
  it('always selects PlugNmeet for organised and shared classes', () => {
    expect(providerForClass({ accessMode: 'enrolled_learners', schoolId: 'school-1' })).toBe('plugnmeet')
    expect(providerForClass({ accessMode: 'anyone_with_link', schoolId: 'school-1' })).toBe('plugnmeet')
  })

  it('does not revive a persisted LiveKit row', () => {
    expect(providerForClass({ accessMode: 'enrolled_learners', schoolId: 'school-1', persisted: 'livekit' })).toBe('plugnmeet')
  })
})
