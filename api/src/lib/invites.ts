import crypto from 'crypto'

export const generateInviteToken = (schoolId: string, adminUserId: string) => {
  const payload = {
    school_id: schoolId,
    created_by: adminUserId,
    issued_at: Date.now(),
    expires_at: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
  }
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const secret = process.env.INVITE_TOKEN_SECRET || 'dev_secret_only'
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadBase64)
    .digest('base64url')
    
  return `${payloadBase64}.${signature}`
}

export const validateInviteToken = (token: string) => {
  const [payloadBase64, signature] = token.split('.')
  
  const secret = process.env.INVITE_TOKEN_SECRET || 'dev_secret_only'
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payloadBase64)
    .digest('base64url')
    
  if (signature !== expectedSignature) {
    throw new Error('INVALID_INVITE_TOKEN')
  }
  
  const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString())
  
  if (Date.now() > payload.expires_at) {
    throw new Error('INVITE_TOKEN_EXPIRED')
  }
  
  return payload
}
