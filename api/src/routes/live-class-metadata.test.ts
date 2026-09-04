import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../notifications/triggers', () => ({ notifyClassCancelled: vi.fn() }))

import { buildParticipantMetadata } from './live-classes'

describe('LiveKit participant metadata', () => {
  it('carries avatar configuration without requiring a generated image URL', () => {
    const avatar = {
      skin_tone: 's3', face_shape: 'f1', hair_style: 'h4', hair_colour: 'hc1',
      outfit_colour: 'oc2', accessory: null, headwear: null,
    }
    const metadata = buildParticipantMetadata(false, avatar)
    expect(metadata).toEqual({ isHost: false, avatar_config: avatar })
    expect(metadata).not.toHaveProperty('avatar_url')
  })
})
