import { RoomServiceClient } from 'livekit-server-sdk'
import { supabase } from '../lib/supabase'

export type WorkerReadiness = {
  state: 'ready' | 'preparing' | 'unavailable'
  retryAfterSeconds?: number
  message?: string
}

type Fetch = typeof fetch

const ARM_API_VERSION = '2024-07-01'
let startInFlight: Promise<void> | null = null

function enabled(env = process.env) {
  return env.LIVEKIT_WORKER_CONTROL_ENABLED === 'true'
}

function requiredAzureConfig(env = process.env) {
  const subscriptionId = env.AZURE_SUBSCRIPTION_ID
  const resourceGroup = env.AZURE_LIVEKIT_RESOURCE_GROUP
  const vmName = env.AZURE_LIVEKIT_VM_NAME
  if (!subscriptionId || !resourceGroup || !vmName) {
    throw new Error('Azure LiveKit worker control is enabled but its VM configuration is incomplete')
  }
  return { subscriptionId, resourceGroup, vmName }
}

function liveKitHttpUrl(env = process.env) {
  const value = env.LIVEKIT_HEALTH_URL || env.LIVEKIT_URL
  if (!value) throw new Error('LIVEKIT_URL is not configured')
  return value.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:').replace(/\/$/, '')
}

export async function isLiveKitHealthy(fetcher: Fetch = fetch, env = process.env) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2_500)
  try {
    const response = await fetcher(liveKitHttpUrl(env), { signal: controller.signal })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

async function managedIdentityToken(fetcher: Fetch, env = process.env) {
  if (env.AZURE_MANAGEMENT_ACCESS_TOKEN) return env.AZURE_MANAGEMENT_ACCESS_TOKEN
  const query = new URLSearchParams({
    'api-version': '2018-02-01',
    resource: 'https://management.azure.com/',
  })
  const response = await fetcher(`http://169.254.169.254/metadata/identity/oauth2/token?${query}`, {
    headers: { Metadata: 'true' },
  })
  if (!response.ok) throw new Error(`Managed identity token request failed (${response.status})`)
  const data = await response.json() as { access_token?: string }
  if (!data.access_token) throw new Error('Managed identity returned no access token')
  return data.access_token
}

async function azureVmAction(action: 'start' | 'deallocate', fetcher: Fetch = fetch, env = process.env) {
  const { subscriptionId, resourceGroup, vmName } = requiredAzureConfig(env)
  const token = await managedIdentityToken(fetcher, env)
  const resource = `/subscriptions/${encodeURIComponent(subscriptionId)}/resourceGroups/${encodeURIComponent(resourceGroup)}/providers/Microsoft.Compute/virtualMachines/${encodeURIComponent(vmName)}`
  const response = await fetcher(`https://management.azure.com${resource}/${action}?api-version=${ARM_API_VERSION}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (![200, 202, 204].includes(response.status)) {
    const detail = (await response.text()).slice(0, 400)
    throw new Error(`Azure VM ${action} failed (${response.status}): ${detail}`)
  }
}

export async function ensureLiveKitWorkerReady(fetcher: Fetch = fetch, env = process.env): Promise<WorkerReadiness> {
  // Preserve the existing always-on deployment unless Azure lifecycle control
  // has been explicitly configured. The subsequent LiveKit API call remains
  // the source of truth in that mode.
  if (!enabled(env)) return { state: 'ready' }
  if (await isLiveKitHealthy(fetcher, env)) return { state: 'ready' }

  if (!startInFlight) {
    startInFlight = azureVmAction('start', fetcher, env)
      .catch((error) => {
        console.error('livekit.worker_start_failed', { error })
        throw error
      })
      .finally(() => { startInFlight = null })
  }
  try {
    await startInFlight
    return { state: 'preparing', retryAfterSeconds: 4 }
  } catch {
    return { state: 'unavailable', message: 'The classroom server could not be started' }
  }
}

export async function warmLiveKitWorkerForUpcomingClasses(now = new Date()) {
  if (!enabled()) return { state: 'disabled' as const }
  const until = new Date(now.getTime() + 12 * 60_000).toISOString()
  const { count, error } = await supabase.from('live_classes')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'scheduled')
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', until)
  if (error) throw error
  if (!count) return { state: 'not_needed' as const }
  return ensureLiveKitWorkerReady()
}

export async function deallocateIdleLiveKitWorker(now = new Date()) {
  if (!enabled() || process.env.LIVEKIT_WORKER_AUTO_DEALLOCATE !== 'true') return { state: 'disabled' as const }
  if (!(await isLiveKitHealthy())) return { state: 'already_off' as const }

  const recentCutoff = new Date(now.getTime() - 15 * 60_000).toISOString()
  const upcomingCutoff = new Date(now.getTime() + 20 * 60_000).toISOString()
  const [{ count: liveCount, error: liveError }, { count: upcomingCount, error: upcomingError }, { count: recentCount, error: recentError }] = await Promise.all([
    supabase.from('live_classes').select('id', { count: 'exact', head: true }).eq('status', 'live'),
    supabase.from('live_classes').select('id', { count: 'exact', head: true }).eq('status', 'scheduled').gte('scheduled_at', now.toISOString()).lte('scheduled_at', upcomingCutoff),
    supabase.from('live_classes').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('ended_at', recentCutoff),
  ])
  if (liveError || upcomingError || recentError) throw liveError || upcomingError || recentError
  if (liveCount || upcomingCount || recentCount) return { state: 'busy' as const }

  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  if (!apiKey || !apiSecret) throw new Error('LiveKit credentials are not configured')
  const rooms = await new RoomServiceClient(liveKitHttpUrl(), apiKey, apiSecret).listRooms()
  if (rooms.length > 0) return { state: 'rooms_present' as const }

  await azureVmAction('deallocate')
  console.info('livekit.worker_deallocated', { at: now.toISOString() })
  return { state: 'deallocated' as const }
}
