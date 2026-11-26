import { mkdir, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'
import { assertStagingSafety } from './staging-e2e-safety.mjs'

const execute = process.argv.includes('--execute')
const outputDirectory = path.resolve(process.env.E2E_ORPHAN_MANIFEST_DIR || 'test-results/staging-orphans')
const cutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString()
assertStagingSafety()

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
})

const { data: schools, error } = await supabase
  .from('schools')
  .select('id,name,slug,created_at')
  .ilike('name', 'E2E-%')
  .lt('created_at', cutoff)
if (error) throw error

const candidateRuns = new Map()
const refused = []
for (const school of schools || []) {
  const match = `${school.name} ${school.slug}`.match(/E2E-\d+-\d+/i)
  if (!match) {
    refused.push({ school_id: school.id, reason: 'name does not contain a workflow run tag' })
    continue
  }
  const runId = match[0].toUpperCase()
  const { data: activeClasses, error: classError } = await supabase
    .from('live_classes')
    .select('id,status')
    .eq('school_id', school.id)
    .not('status', 'in', '(completed,cancelled)')
  if (classError) throw classError
  if (activeClasses?.length) {
    refused.push({ school_id: school.id, run_id: runId, reason: 'active live classes remain', live_class_ids: activeClasses.map((item) => item.id) })
    continue
  }

  const { data: profiles, error: profileError } = await supabase
    .from('user_profiles')
    .select('id,auth_user_id,email')
    .eq('school_id', school.id)
  if (profileError) throw profileError
  if ((profiles || []).some((profile) => !profile.email?.toLowerCase().includes(runId.toLowerCase()))) {
    refused.push({ school_id: school.id, run_id: runId, reason: 'school contains an untagged user profile' })
    continue
  }

  const objects = []
  let continuationToken
  do {
    const page = await s3.send(new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME,
      Prefix: `schools/${school.id}/`,
      ContinuationToken: continuationToken,
    }))
    objects.push(...(page.Contents || []).flatMap((object) => object.Key ? [{ bucket: process.env.R2_BUCKET_NAME, key: object.Key, schoolId: school.id }] : []))
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined
  } while (continuationToken)

  const now = new Date().toISOString()
  const candidate = candidateRuns.get(runId) || {
    version: 1,
    runId,
    releaseSha: '0000000000000000000000000000000000000000',
    createdAt: school.created_at,
    updatedAt: now,
    status: 'failed',
    tenants: [],
    database: [],
    authUsers: [],
    r2Objects: [],
    rooms: [],
    providers: [],
    events: [{ at: now, journey: 'orphan-cleanup', action: 'discovered' }],
  }
  candidate.tenants.push({ id: school.id, name: school.name, slug: school.slug })
  candidate.database.push(...(profiles || []).map((profile) => ({ table: 'user_profiles', id: profile.id, schoolId: school.id })))
  candidate.authUsers.push(...(profiles || []).filter((profile) => profile.auth_user_id && profile.email).map((profile) => ({ id: profile.auth_user_id, email: profile.email })))
  candidate.r2Objects.push(...objects)
  candidateRuns.set(runId, candidate)
}

// Registration can fail after Supabase Auth creates the identity but before a
// school exists. Include only old, explicitly run-tagged mailbox aliases.
for (let page = 1; page <= 100; page += 1) {
  const { data, error: usersError } = await supabase.auth.admin.listUsers({ page, perPage: 100 })
  if (usersError) throw usersError
  for (const user of data.users) {
    if (!user.email || !user.created_at || user.created_at >= cutoff) continue
    const match = user.email.match(/\+?(E2E-\d+-\d+)-/i)
    if (!match) continue
    const runId = match[1].toUpperCase()
    const existing = candidateRuns.get(runId)
    if (existing?.authUsers.some((item) => item.id === user.id)) continue
    const { data: profile, error: pendingProfileError } = await supabase
      .from('user_profiles')
      .select('id,school_id')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    if (pendingProfileError) throw pendingProfileError
    if (profile?.school_id && !existing?.tenants.some((tenant) => tenant.id === profile.school_id)) {
      refused.push({ auth_user_id: user.id, run_id: runId, reason: 'tagged auth user belongs to a non-candidate school' })
      continue
    }
    const now = new Date().toISOString()
    const candidate = existing || {
      version: 1,
      runId,
      releaseSha: '0000000000000000000000000000000000000000',
      createdAt: user.created_at,
      updatedAt: now,
      status: 'failed',
      tenants: [], database: [], authUsers: [], r2Objects: [], rooms: [], providers: [],
      events: [{ at: now, journey: 'orphan-cleanup', action: 'discovered-pending-auth' }],
    }
    candidate.authUsers.push({ id: user.id, email: user.email })
    if (profile && candidate.tenants.length) candidate.database.push({ table: 'user_profiles', id: profile.id, schoolId: profile.school_id })
    candidateRuns.set(runId, candidate)
  }
  if (data.users.length < 100) break
}

await mkdir(outputDirectory, { recursive: true })
const refusedRunIds = new Set(refused.flatMap((item) => item.run_id ? [item.run_id] : []))
const candidates = [...candidateRuns.values()].filter((candidate) => !refusedRunIds.has(candidate.runId))
for (const manifest of candidates) {
  const file = path.join(outputDirectory, `${manifest.runId}.manifest.json`)
  await writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })
  if (execute) {
    await promisify(execFile)(process.execPath, ['scripts/staging-e2e-cleanup.mjs', file, '--execute'], {
      cwd: process.cwd(),
      env: { ...process.env, E2E_RUN_ID: manifest.runId },
    })
  }
}

const report = { cutoff, mode: execute ? 'execute' : 'dry-run', candidates: candidates.map((item) => item.runId), refused }
await writeFile(path.join(outputDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
if (refused.length) process.exitCode = 1
