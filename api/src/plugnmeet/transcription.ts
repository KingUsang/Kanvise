import { createHmac, timingSafeEqual } from 'node:crypto'

export function createTutorEgressUrl(input: { classId: string; trackId: string; egressId: string; expiresAt: number; nonce: string }) {
  const secret = process.env.PLUGNMEET_BRIDGE_SIGNING_SECRET
  const base = process.env.PLUGNMEET_BRIDGE_URL
  if (!secret || !base) throw new Error('Transcription bridge is not configured')
  const payload = `${input.classId}.${input.trackId}.${input.egressId}.${input.expiresAt}.${input.nonce}`
  const signature = createHmac('sha256', secret).update(payload).digest('hex')
  const url = new URL('/audio/tutor', base)
  url.search = new URLSearchParams({ class_id: input.classId, track_id: input.trackId, egress_id: input.egressId, expires_at: String(input.expiresAt), nonce: input.nonce, signature }).toString()
  return url.toString()
}

export function verifyBridgeSignature(input: { classId: string; trackId: string; egressId: string; expiresAt: string; nonce: string; signature: string }) {
  const secret = process.env.PLUGNMEET_BRIDGE_SIGNING_SECRET
  if (!secret || Number(input.expiresAt) < Math.floor(Date.now() / 1000)) return false
  const payload = `${input.classId}.${input.trackId}.${input.egressId}.${input.expiresAt}.${input.nonce}`
  const expected = createHmac('sha256', secret).update(payload).digest('hex')
  const left = Buffer.from(input.signature, 'utf8')
  const right = Buffer.from(expected, 'utf8')
  return left.length === right.length && timingSafeEqual(left, right)
}
