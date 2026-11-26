import { afterEach, describe, expect, it, vi } from 'vitest'
import { plugNmeet } from './client'
import { getPlugNmeetClientConfig, providerForClass } from './provider'

describe('classroom provider selection', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('always selects PlugNmeet for organised and shared classes', () => {
    expect(providerForClass({ accessMode: 'enrolled_learners', schoolId: 'school-1' })).toBe('plugnmeet')
    expect(providerForClass({ accessMode: 'anyone_with_link', schoolId: 'school-1' })).toBe('plugnmeet')
  })

  it('does not revive a persisted LiveKit row', () => {
    expect(providerForClass({ accessMode: 'enrolled_learners', schoolId: 'school-1', persisted: 'livekit' })).toBe('plugnmeet')
  })

  it('lets tutors share their screen while keeping students locked', async () => {
    vi.stubEnv('PLUGNMEET_SERVER_URL', 'https://plugnmeet.example')
    vi.stubEnv('PLUGNMEET_API_KEY', 'test-key')
    vi.stubEnv('PLUGNMEET_API_SECRET', 'test-secret')
    const joinToken = vi.spyOn(plugNmeet, 'getJoinToken').mockResolvedValue({ token: 'join-token' })
    vi.spyOn(plugNmeet, 'getClientFiles').mockResolvedValue({ css_files: [], js_files: [] } as any)
    const base = { roomId: 'room-1', userId: 'user-1', name: 'Ada', schoolId: 'school-1' }

    await getPlugNmeetClientConfig({ ...base, isHost: true })
    await getPlugNmeetClientConfig({ ...base, isHost: false })

    expect(joinToken.mock.calls[0][0].user_info.user_metadata.lock_settings.lock_screen_sharing).toBe(false)
    expect(joinToken.mock.calls[1][0].user_info.user_metadata.lock_settings.lock_screen_sharing).toBe(true)
  })

  it('issues school admins a moderator token without making them the Kanvise host', async () => {
    vi.stubEnv('PLUGNMEET_SERVER_URL', 'https://plugnmeet.example')
    vi.stubEnv('PLUGNMEET_API_KEY', 'test-key')
    vi.stubEnv('PLUGNMEET_API_SECRET', 'test-secret')
    const joinToken = vi.spyOn(plugNmeet, 'getJoinToken').mockResolvedValue({ token: 'join-token' })
    vi.spyOn(plugNmeet, 'getClientFiles').mockResolvedValue({ css_files: [], js_files: [] } as any)

    const config = await getPlugNmeetClientConfig({
      roomId: 'room-1', userId: 'admin-1', name: 'Administrator', schoolId: 'school-1',
      isHost: false, isModerator: true,
    })

    expect(joinToken).toHaveBeenCalledWith(expect.objectContaining({
      user_info: expect.objectContaining({
        is_admin: true,
        user_metadata: expect.objectContaining({
          extra_data: expect.objectContaining({ access_profile: 'admin' }),
          lock_settings: expect.objectContaining({ lock_screen_sharing: false }),
        }),
      }),
    }))
    expect(config.is_host).toBe(false)
  })
})
