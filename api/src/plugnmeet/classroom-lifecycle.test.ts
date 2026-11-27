import { describe, expect, it } from 'vitest'
import { ensurePlugNmeetReady, plugNmeetWorkerConfig } from './classroom-lifecycle'

describe('PlugNmeet classroom worker configuration', () => {
  it('prefers explicit PlugNmeet Azure identifiers', () => {
    expect(plugNmeetWorkerConfig({
      AZURE_SUBSCRIPTION_ID: 'subscription',
      AZURE_PLUGNMEET_RESOURCE_GROUP: 'plugnmeet-group',
      AZURE_PLUGNMEET_VM_NAME: 'plugnmeet-vm',
      AZURE_LIVEKIT_RESOURCE_GROUP: 'legacy-group',
      AZURE_LIVEKIT_VM_NAME: 'legacy-vm',
    } as NodeJS.ProcessEnv)).toEqual({ subscriptionId: 'subscription', resourceGroup: 'plugnmeet-group', vmName: 'plugnmeet-vm' })
  })

  it('uses the legacy production LiveKit identifiers when PlugNmeet names are absent', () => {
    expect(plugNmeetWorkerConfig({
      AZURE_SUBSCRIPTION_ID: 'subscription',
      AZURE_LIVEKIT_RESOURCE_GROUP: 'legacy-group',
      AZURE_LIVEKIT_VM_NAME: 'legacy-vm',
    } as NodeJS.ProcessEnv)).toEqual({ subscriptionId: 'subscription', resourceGroup: 'legacy-group', vmName: 'legacy-vm' })
  })
})

describe('classroom readiness (DEV-PNM-002)', () => {
  const env = { PLUGNMEET_SERVER_URL: 'https://pnm.example' } as NodeJS.ProcessEnv

  it('reports unavailable, not ready, when worker control is off and the provider is down', async () => {
    const fetcher = (async () => { throw new Error('down') }) as unknown as typeof fetch
    await expect(ensurePlugNmeetReady(fetcher, env)).resolves.toMatchObject({ state: 'unavailable' })
  })

  it('reports ready when the provider probe succeeds', async () => {
    const fetcher = (async () => new Response('ok', { status: 200 })) as unknown as typeof fetch
    await expect(ensurePlugNmeetReady(fetcher, env)).resolves.toEqual({ state: 'ready' })
  })
})
