import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

function key() {
  const encoded = process.env.CLASS_LINK_ENCRYPTION_KEY || ''
  const value = Buffer.from(encoded, 'base64')
  if (value.length !== 32) throw new Error('CLASS_LINK_ENCRYPTION_KEY must be a base64-encoded 32-byte key')
  return value
}

export function encryptClassLinkToken(token: string) {
  if (!process.env.CLASS_LINK_ENCRYPTION_KEY) return null
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.')
}

export function decryptClassLinkToken(value: string) {
  const [ivPart, tagPart, encryptedPart] = value.split('.')
  if (!ivPart || !tagPart || !encryptedPart) throw new Error('Invalid encrypted class link')
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivPart, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(encryptedPart, 'base64url')), decipher.final()]).toString('utf8')
}

export function classShareUrl(liveClass: { id: string; access_mode?: string | null; share_token_encrypted?: string | null }) {
  const origin = (process.env.FRONTEND_URL || '').replace(/\/$/, '')
  if (liveClass.access_mode !== 'anyone_with_link') return `${origin}/class/${liveClass.id}`
  if (!liveClass.share_token_encrypted) return null
  return `${origin}/live/${decryptClassLinkToken(liveClass.share_token_encrypted)}`
}
