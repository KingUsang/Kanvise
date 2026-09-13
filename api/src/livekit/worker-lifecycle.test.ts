import { afterEach, describe, expect, it, vi } from 'vitest'
import { ensureLiveKitWorkerReady, isLiveKitHealthy } from './worker-lifecycle'

afterEach(() => vi.unstubAllEnvs())

describe('LiveKit worker lifecycle', () => {
  it('reports ready without contacting Azure when health succeeds', async () => {
    vi.stubEnv('LIVEKIT_WORKER_CONTROL_ENABLED', 'true')
    vi.stubEnv('LIVEKIT_URL', 'wss://livekit.example.com')
    const fetcher = vi.fn().mockResolvedValue(new Response('OK', { status: 200 })) as any
    await expect(ensureLiveKitWorkerReady(fetcher)).resolves.toEqual({ state: 'ready' })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(String(fetcher.mock.calls[0][0])).toContain('kanvise_health=')
  })

  it('starts the VM and reports preparing when health is down', async () => {
    vi.stubEnv('LIVEKIT_WORKER_CONTROL_ENABLED', 'true')
    vi.stubEnv('LIVEKIT_URL', 'wss://livekit.example.com')
    vi.stubEnv('AZURE_SUBSCRIPTION_ID', 'sub')
    vi.stubEnv('AZURE_LIVEKIT_RESOURCE_GROUP', 'rg')
    vi.stubEnv('AZURE_LIVEKIT_VM_NAME', 'vm')
    vi.stubEnv('AZURE_MANAGEMENT_ACCESS_TOKEN', 'token')
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(new Response(null, { status: 202 })) as any
    await expect(ensureLiveKitWorkerReady(fetcher)).resolves.toEqual({ state: 'preparing', retryAfterSeconds: 4 })
    expect(fetcher.mock.calls[1][0]).toContain('/virtualMachines/vm/start?')
  })

  it('preserves the existing always-on path when control is disabled', async () => {
    vi.stubEnv('LIVEKIT_URL', 'wss://livekit.example.com')
    const fetcher = vi.fn().mockRejectedValue(new Error('offline')) as any
    await expect(ensureLiveKitWorkerReady(fetcher)).resolves.toEqual({ state: 'ready' })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('treats a failed or timed-out health request as unhealthy', async () => {
    vi.stubEnv('LIVEKIT_URL', 'wss://livekit.example.com')
    await expect(isLiveKitHealthy(vi.fn().mockRejectedValue(new Error('down')) as any)).resolves.toBe(false)
  })
})
