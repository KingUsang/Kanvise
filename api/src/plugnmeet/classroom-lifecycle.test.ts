import { describe, expect, it } from 'vitest'
import { plugNmeetWorkerConfig } from './classroom-lifecycle'

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
