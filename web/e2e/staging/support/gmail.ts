type GmailPart = {
  mimeType?: string
  body?: { data?: string }
  parts?: GmailPart[]
}

type GmailMessage = {
  id: string
  internalDate?: string
  payload?: GmailPart
}

function decodeBase64Url(value: string) {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

export function messageText(part: GmailPart | undefined): string {
  if (!part) return ''
  const own = part.body?.data ? decodeBase64Url(part.body.data) : ''
  return [own, ...(part.parts || []).map(messageText)].filter(Boolean).join('\n')
}

export function verificationCodeFromMessage(message: GmailMessage) {
  const text = messageText(message.payload).replace(/<[^>]+>/g, ' ')
  const labelled = text.match(/(?:verification code|your code)[\s\S]{0,160}?\b(\d{6})\b/i)
  const fallback = text.match(/\b(\d{6})\b/)
  const code = labelled?.[1] || fallback?.[1]
  if (!code) throw new Error(`Gmail message ${message.id} did not contain a six-digit verification code`)
  return code
}

export function invitationLinkFromMessage(message: GmailMessage, expectedOrigin: string) {
  const text = messageText(message.payload).replace(/&amp;/g, '&')
  const urls = text.match(/https?:\/\/[^\s"'<>]+/g) || []
  const link = urls.find((value) => {
    try {
      const url = new URL(value)
      return url.origin === expectedOrigin && url.pathname === '/invite' && Boolean(url.searchParams.get('token'))
    } catch { return false }
  })
  if (!link) throw new Error(`Gmail message ${message.id} did not contain a Kanvise invitation link`)
  return link
}

async function accessToken(env: NodeJS.ProcessEnv = process.env) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.E2E_GMAIL_CLIENT_ID!,
      client_secret: env.E2E_GMAIL_CLIENT_SECRET!,
      refresh_token: env.E2E_GMAIL_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  })
  const body = await response.json()
  if (!response.ok || !body.access_token) throw new Error(`Gmail token refresh failed (${response.status})`)
  return body.access_token as string
}

async function gmail<T>(pathname: string, token: string): Promise<T> {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${pathname}`, {
    headers: { authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new Error(`Gmail API ${pathname} failed (${response.status})`)
  return response.json() as Promise<T>
}

export function taggedMailbox(address: string, runId: string, role: string) {
  const at = address.lastIndexOf('@')
  if (at < 1) throw new Error('E2E_GMAIL_ADDRESS is invalid')
  const local = address.slice(0, at).split('+')[0]
  const tag = `${runId}-${role}`.toLowerCase().replace(/[^a-z0-9-]/g, '-')
  return `${local}+${tag}${address.slice(at)}`
}

export async function waitForVerificationCode(
  recipient: string,
  options: { after: Date; timeoutMs?: number; pollMs?: number } ,
) {
  const token = await accessToken()
  const timeoutMs = options.timeoutMs ?? 120_000
  const pollMs = options.pollMs ?? 5_000
  const deadline = Date.now() + timeoutMs
  const afterSeconds = Math.floor(options.after.getTime() / 1000)
  const query = encodeURIComponent(`to:${recipient} after:${afterSeconds}`)

  while (Date.now() < deadline) {
    const list = await gmail<{ messages?: Array<{ id: string }> }>(`/messages?q=${query}&maxResults=10`, token)
    for (const item of list.messages || []) {
      const message = await gmail<GmailMessage>(`/messages/${item.id}?format=full`, token)
      if (Number(message.internalDate || 0) < options.after.getTime()) continue
      try {
        return { code: verificationCodeFromMessage(message), messageId: message.id }
      } catch {
        // The mailbox can receive unrelated messages matching a forwarded alias.
      }
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }
  throw new Error(`No verification email arrived for ${recipient} within ${timeoutMs}ms`)
}

export async function waitForInvitationLink(
  recipient: string,
  options: { after: Date; expectedOrigin: string; timeoutMs?: number; pollMs?: number },
) {
  const token = await accessToken()
  const timeoutMs = options.timeoutMs ?? 120_000
  const pollMs = options.pollMs ?? 5_000
  const deadline = Date.now() + timeoutMs
  const query = encodeURIComponent(`to:${recipient} after:${Math.floor(options.after.getTime() / 1000)}`)
  while (Date.now() < deadline) {
    const list = await gmail<{ messages?: Array<{ id: string }> }>(`/messages?q=${query}&maxResults=10`, token)
    for (const item of list.messages || []) {
      const message = await gmail<GmailMessage>(`/messages/${item.id}?format=full`, token)
      if (Number(message.internalDate || 0) < options.after.getTime()) continue
      try {
        return { link: invitationLinkFromMessage(message, options.expectedOrigin), messageId: message.id }
      } catch {
        // Continue until the actual invitation arrives.
      }
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }
  throw new Error(`No invitation email arrived for ${recipient} within ${timeoutMs}ms`)
}
