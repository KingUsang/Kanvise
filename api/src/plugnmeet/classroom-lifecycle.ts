import { supabase } from '../lib/supabase'

export type ClassroomReadiness = {
  state: 'ready' | 'preparing' | 'unavailable'
  message?: string
}

type Fetcher = typeof fetch

const ARM_API_VERSION = '2024-07-01'
let startInFlight: Promise<void> | null = null

function enabled(env = process.env) {
  return env.PLUGNMEET_WORKER_CONTROL_ENABLED === 'true'
}

function serverUrl(env = process.env) {
  const value = env.PLUGNMEET_HEALTH_URL || env.PLUGNMEET_SERVER_URL
  if (!value) throw new Error('PLUGNMEET_SERVER_URL is not configured')
  return value.replace(/\/$/, '')
}

export async function isPlugNmeetHealthy(fetcher: Fetcher = fetch, env = process.env) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2_500)
  try {
    const response = await fetcher(serverUrl(env), { signal: controller.signal, cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

async function managedIdentityToken(fetcher: Fetcher, env = process.env) {
  if (env.AZURE_MANAGEMENT_ACCESS_TOKEN) return env.AZURE_MANAGEMENT_ACCESS_TOKEN
  const query = new URLSearchParams({ 'api-version': '2018-02-01', resource: 'https://management.azure.com/' })
  const response = await fetcher(`http://169.254.169.254/metadata/identity/oauth2/token?${query}`, { headers: { Metadata: 'true' } })
  if (!response.ok) throw new Error(`Managed identity token request failed (${response.status})`)
  const data = await response.json() as { access_token?: string }
  if (!data.access_token) throw new Error('Managed identity returned no access token')
  return data.access_token
}

async function classroomVmAction(action: 'start' | 'deallocate', fetcher: Fetcher = fetch, env = process.env) {
  const subscriptionId = env.AZURE_SUBSCRIPTION_ID
  const resourceGroup = env.AZURE_PLUGNMEET_RESOURCE_GROUP
  const vmName = env.AZURE_PLUGNMEET_VM_NAME
  if (!subscriptionId || !resourceGroup || !vmName) throw new Error('Azure PlugNmeet VM configuration is incomplete')
  const token = await managedIdentityToken(fetcher, env)
  const resource = `/subscriptions/${encodeURIComponent(subscriptionId)}/resourceGroups/${encodeURIComponent(resourceGroup)}/providers/Microsoft.Compute/virtualMachines/${encodeURIComponent(vmName)}`
  const response = await fetcher(`https://management.azure.com${resource}/${action}?api-version=${ARM_API_VERSION}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
  if (![200, 202, 204].includes(response.status)) throw new Error(`Azure PlugNmeet VM ${action} failed (${response.status})`)
}

export async function ensurePlugNmeetReady(fetcher: Fetcher = fetch, env = process.env): Promise<ClassroomReadiness> {
  if (!enabled(env) || await isPlugNmeetHealthy(fetcher, env)) return { state: 'ready' }
  if (!startInFlight) startInFlight = classroomVmAction('start', fetcher, env).finally(() => { startInFlight = null })
  try {
    await startInFlight
    return { state: 'preparing' }
  } catch {
    return { state: 'unavailable', message: 'The classroom server could not be started.' }
  }
}

export async function warmPlugNmeetForUpcomingClasses(now = new Date()) {
  const until = new Date(now.getTime() + 10 * 60_000).toISOString()
  const { count, error } = await (supabase as any).from('live_classes').select('id', { count: 'exact', head: true })
    .eq('classroom_provider', 'plugnmeet').eq('status', 'scheduled').gte('scheduled_at', now.toISOString()).lte('scheduled_at', until)
  if (error) throw error
  if (!count) return { state: 'not_needed' as const }
  return ensurePlugNmeetReady()
}

export async function deallocateIdlePlugNmeet(now = new Date()) {
  if (!enabled()) return { state: 'disabled' as const }
  const upcoming = new Date(now.getTime() + 10 * 60_000).toISOString()
  const recent = new Date(now.getTime() - 10 * 60_000).toISOString()
  const [{ count: scheduled, error: scheduledError }, { count: live, error: liveError }, { count: recentlyEnded, error: endedError }] = await Promise.all([
    (supabase as any).from('live_classes').select('id', { count: 'exact', head: true }).eq('classroom_provider', 'plugnmeet').eq('status', 'scheduled').lte('scheduled_at', upcoming),
    (supabase as any).from('live_classes').select('id', { count: 'exact', head: true }).eq('classroom_provider', 'plugnmeet').eq('status', 'live'),
    (supabase as any).from('live_classes').select('id', { count: 'exact', head: true }).eq('classroom_provider', 'plugnmeet').eq('status', 'completed').gte('ended_at', recent),
  ])
  if (scheduledError || liveError || endedError) throw scheduledError || liveError || endedError
  if (scheduled || live || recentlyEnded) return { state: 'busy' as const }
  if (!await isPlugNmeetHealthy()) return { state: 'already_off' as const }
  await classroomVmAction('deallocate')
  return { state: 'deallocated' as const }
}
