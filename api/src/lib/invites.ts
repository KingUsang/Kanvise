import crypto from 'crypto'

export const generateInviteToken = (inviteId: string, schoolId: string, email: string) => {
  const payload = {
    invite_id: inviteId,
    school_id: schoolId,
    email: email.toLowerCase().trim(),
    issued_at: Date.now(),
    expires_at: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
  }
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const secret = process.env.INVITE_TOKEN_SECRET!
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadBase64)
    .digest('base64url')
    
  return `${payloadBase64}.${signature}`
}

export const validateInviteToken = (token: string) => {
  const [payloadBase64, signature] = token.split('.')
  
  const secret = process.env.INVITE_TOKEN_SECRET!
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payloadBase64)
    .digest('base64url')
    
  if (!signature || signature.length !== expectedSignature.length
    || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    throw new Error('INVALID_INVITE_TOKEN')
  }
  
  const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString())

  if (!payload.invite_id || !payload.school_id || !payload.email) {
    throw new Error('INVALID_INVITE_TOKEN')
  }
  
  if (Date.now() > payload.expires_at) {
    throw new Error('INVITE_TOKEN_EXPIRED')
  }
  
  return payload
}
