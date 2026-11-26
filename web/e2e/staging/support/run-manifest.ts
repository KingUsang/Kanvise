import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const MANIFEST_VERSION = 1

export type DatabaseResource = {
  table: string
  id: string
  schoolId: string
}

export type AuthResource = {
  id: string
  email: string
}

export type ProviderEvidence = {
  provider: string
  kind: string
  id: string
  metadata?: Record<string, string | number | boolean | null>
}

export type StagingRunManifest = {
  version: typeof MANIFEST_VERSION
  runId: string
  releaseSha: string
  createdAt: string
  updatedAt: string
  status: 'running' | 'passed' | 'failed' | 'cleaned'
  tenants: Array<{ id: string; name: string; slug: string }>
  database: DatabaseResource[]
  authUsers: AuthResource[]
  r2Objects: Array<{ bucket: string; key: string; schoolId: string }>
  rooms: Array<{ provider: 'plugnmeet'; id: string; schoolId: string; status: 'active' | 'ended' }>
  providers: ProviderEvidence[]
  events: Array<{ at: string; journey: string; action: string; detail?: Record<string, unknown> }>
}

export function manifestPath(env: NodeJS.ProcessEnv = process.env) {
  const runId = requireRunId(env.E2E_RUN_ID)
  return path.resolve(env.E2E_ARTIFACT_DIR || 'test-results/staging-evidence', `${runId}.manifest.json`)
}

export function requireRunId(value: string | undefined) {
  if (!value || !/^E2E-[A-Za-z0-9._-]+$/.test(value)) {
    throw new Error('E2E_RUN_ID must start with E2E- and contain only safe identifier characters')
  }
  return value
}

export function createManifest(env: NodeJS.ProcessEnv = process.env): StagingRunManifest {
  const now = new Date().toISOString()
  const releaseSha = env.E2E_EXPECTED_SHA || ''
  if (!/^[0-9a-f]{40}$/.test(releaseSha)) throw new Error('E2E_EXPECTED_SHA must be a full Git SHA')
  return {
    version: MANIFEST_VERSION,
    runId: requireRunId(env.E2E_RUN_ID),
    releaseSha,
    createdAt: now,
    updatedAt: now,
    status: 'running',
    tenants: [],
    database: [],
    authUsers: [],
    r2Objects: [],
    rooms: [],
    providers: [],
    events: [],
  }
}

export function validateManifest(value: unknown): asserts value is StagingRunManifest {
  if (!value || typeof value !== 'object') throw new Error('Run manifest must be an object')
  const manifest = value as Partial<StagingRunManifest>
  if (manifest.version !== MANIFEST_VERSION) throw new Error(`Unsupported manifest version: ${manifest.version}`)
  requireRunId(manifest.runId)
  if (!manifest.releaseSha || !/^[0-9a-f]{40}$/.test(manifest.releaseSha)) throw new Error('Manifest release SHA is invalid')
  for (const key of ['tenants', 'database', 'authUsers', 'r2Objects', 'rooms', 'providers', 'events'] as const) {
    if (!Array.isArray(manifest[key])) throw new Error(`Manifest ${key} must be an array`)
  }
}

export async function loadManifest(file = manifestPath()) {
  const manifest: unknown = JSON.parse(await readFile(file, 'utf8'))
  validateManifest(manifest)
  return manifest
}

export async function saveManifest(manifest: StagingRunManifest, file = manifestPath()) {
  validateManifest(manifest)
  manifest.updatedAt = new Date().toISOString()
  await mkdir(path.dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.tmp`
  await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })
  await rename(temporary, file)
}

export async function updateManifest(
  mutate: (manifest: StagingRunManifest) => void | Promise<void>,
  file = manifestPath(),
) {
  const manifest = await loadManifest(file)
  await mutate(manifest)
  await saveManifest(manifest, file)
  return manifest
}

export function taggedValue(runId: string, suffix: string) {
  const safeSuffix = suffix.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return `${requireRunId(runId)}-${safeSuffix}`
}
