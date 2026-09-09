export type EmailPayload = {
  from: string
  to: string[]
  subject: string
  html: string
  text: string
  replyTo?: string
}

export type EmailTransport = {
  send(payload: EmailPayload, options?: { idempotencyKey?: string }): Promise<{
    data: { id: string } | null
    error: { message: string } | null
  }>
}
