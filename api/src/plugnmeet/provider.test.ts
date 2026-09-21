import { describe, expect, it } from 'vitest'
import { providerForClass } from './provider'

describe('classroom provider selection', () => {
  it('never moves guest/link classes to PlugNmeet', () => {
    expect(providerForClass({ accessMode: 'anyone_with_link', schoolId: 'school-1' })).toBe('livekit')
  })

  it('preserves a persisted provider decision', () => {
    expect(providerForClass({ accessMode: 'enrolled_learners', schoolId: 'school-1', persisted: 'livekit' })).toBe('livekit')
    expect(providerForClass({ accessMode: 'enrolled_learners', schoolId: 'school-1', persisted: 'plugnmeet' })).toBe('plugnmeet')
  })

  it('requires the enrolled pilot flag and allowlist when selecting PlugNmeet', () => {
    const previous = { enabled: process.env.PLUGNMEET_ENROLLED_ENABLED, ids: process.env.PLUGNMEET_PILOT_SCHOOL_IDS, url: process.env.PLUGNMEET_SERVER_URL, key: process.env.PLUGNMEET_API_KEY, secret: process.env.PLUGNMEET_API_SECRET }
    process.env.PLUGNMEET_ENROLLED_ENABLED = 'true'
    process.env.PLUGNMEET_PILOT_SCHOOL_IDS = 'school-1'
    process.env.PLUGNMEET_SERVER_URL = 'https://plugnmeet.example'
    process.env.PLUGNMEET_API_KEY = 'key'
    process.env.PLUGNMEET_API_SECRET = 'secret'
    expect(providerForClass({ accessMode: 'enrolled_learners', schoolId: 'school-1' })).toBe('plugnmeet')
    expect(providerForClass({ accessMode: 'enrolled_learners', schoolId: 'school-2' })).toBe('livekit')
    if (previous.enabled === undefined) delete process.env.PLUGNMEET_ENROLLED_ENABLED; else process.env.PLUGNMEET_ENROLLED_ENABLED = previous.enabled
    if (previous.ids === undefined) delete process.env.PLUGNMEET_PILOT_SCHOOL_IDS; else process.env.PLUGNMEET_PILOT_SCHOOL_IDS = previous.ids
    if (previous.url === undefined) delete process.env.PLUGNMEET_SERVER_URL; else process.env.PLUGNMEET_SERVER_URL = previous.url
    if (previous.key === undefined) delete process.env.PLUGNMEET_API_KEY; else process.env.PLUGNMEET_API_KEY = previous.key
    if (previous.secret === undefined) delete process.env.PLUGNMEET_API_SECRET; else process.env.PLUGNMEET_API_SECRET = previous.secret
  })
})
