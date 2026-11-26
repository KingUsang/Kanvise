import { readFile, rename, writeFile } from 'node:fs/promises'
import { DeleteObjectsCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'
import { assertStagingSafety, resolveManifestPath } from './staging-e2e-safety.mjs'

const execute = process.argv.includes('--execute')
const manifestArgument = process.argv.find((value) => value.endsWith('.manifest.json'))
if (!manifestArgument) throw new Error('Usage: node scripts/staging-e2e-cleanup.mjs <run.manifest.json> [--execute]')

const safety = assertStagingSafety()
const file = resolveManifestPath(manifestArgument)
const manifest = JSON.parse(await readFile(file, 'utf8'))
if (manifest.version !== 1 || manifest.runId !== safety.runId) throw new Error('Manifest identity does not match this cleanup run')
if (!Array.isArray(manifest.tenants) || !Array.isArray(manifest.authUsers) || !Array.isArray(manifest.r2Objects) || !Array.isArray(manifest.rooms)) {
  throw new Error('Cleanup manifest resources are incomplete')
}
if (!manifest.tenants.length && !manifest.authUsers.length) throw new Error('Cleanup refuses a manifest without owned resources')
if (!manifest.tenants.length && (manifest.r2Objects.length || manifest.rooms.length || manifest.database?.length)) {
  throw new Error('Cleanup refuses tenant resources when the manifest has no verified tenant')
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const tenantIds = new Set(manifest.tenants.map((tenant) => tenant.id))
const normalizedTag = manifest.runId.toLowerCase()

for (const tenant of manifest.tenants) {
  if (!tenant.id || !`${tenant.name} ${tenant.slug}`.toLowerCase().includes(normalizedTag)) {
    throw new Error(`Tenant ${tenant.id || '(missing id)'} is not tagged with ${manifest.runId}`)
  }
  const { data, error } = await supabase.from('schools').select('id,name,slug').eq('id', tenant.id).maybeSingle()
  if (error) throw error
  if (!data) throw new Error(`Manifest tenant ${tenant.id} does not exist`)
  if (!`${data.name} ${data.slug}`.toLowerCase().includes(normalizedTag)) throw new Error(`Stored tenant ${tenant.id} is untagged`)
}

for (const user of manifest.authUsers) {
  if (!user.id || !user.email?.toLowerCase().includes(normalizedTag)) throw new Error(`Auth user ${user.id || '(missing id)'} is untagged`)
  const { data, error } = await supabase.auth.admin.getUserById(user.id)
  if (error) throw error
  if (data.user.email?.toLowerCase() !== user.email.toLowerCase()) throw new Error(`Auth user ${user.id} email does not match the manifest`)
}

for (const object of manifest.r2Objects) {
  if (object.bucket !== safety.bucket) throw new Error(`Object bucket ${object.bucket} is not allowed`)
  if (!tenantIds.has(object.schoolId)) throw new Error(`Object ${object.key} is not owned by a manifest tenant`)
  if (!object.key.startsWith(`schools/${object.schoolId}/`) && !object.key.toLowerCase().includes(normalizedTag)) {
    throw new Error(`Object key ${object.key} is outside the manifest tenant prefix`)
  }
}

const activeRooms = manifest.rooms.filter((room) => room.status !== 'ended' || !tenantIds.has(room.schoolId))
if (activeRooms.length) throw new Error(`Cleanup refuses ${activeRooms.length} active or foreign room(s); end them through the product first`)

const plan = {
  run_id: manifest.runId,
  mode: execute ? 'execute' : 'dry-run',
  tenants: manifest.tenants.map(({ id }) => id),
  auth_users: manifest.authUsers.map(({ id }) => id),
  r2_objects: manifest.r2Objects.map(({ bucket, key }) => ({ bucket, key })),
}
console.log(JSON.stringify(plan, null, 2))
if (!execute) process.exit(0)

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
})

if (manifest.r2Objects.length) {
  await s3.send(new DeleteObjectsCommand({
    Bucket: safety.bucket,
    Delete: { Quiet: false, Objects: manifest.r2Objects.map(({ key }) => ({ Key: key })) },
  }))
}

for (const tenant of manifest.tenants) {
  const { error } = await supabase.from('schools').delete().eq('id', tenant.id)
  if (error) throw error
}
for (const user of manifest.authUsers) {
  const { error } = await supabase.auth.admin.deleteUser(user.id)
  if (error) throw error
}

for (const tenant of manifest.tenants) {
  const { data, error } = await supabase.from('schools').select('id').eq('id', tenant.id).maybeSingle()
  if (error) throw error
  if (data) throw new Error(`Tenant ${tenant.id} remained after cleanup`)
}
for (const user of manifest.authUsers) {
  const { data } = await supabase.auth.admin.getUserById(user.id)
  if (data?.user) throw new Error(`Auth user ${user.id} remained after cleanup`)
}
for (const object of manifest.r2Objects) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: object.bucket, Key: object.key }))
    throw new Error(`R2 object ${object.key} remained after cleanup`)
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode
    if (status !== 404) throw error
  }
}

manifest.status = 'cleaned'
manifest.updatedAt = new Date().toISOString()
manifest.events.push({ at: manifest.updatedAt, journey: 'cleanup', action: 'zero-residue-verified' })
const temporary = `${file}.${process.pid}.tmp`
await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })
await rename(temporary, file)
console.log(`Cleanup completed and verified for ${manifest.runId}`)
