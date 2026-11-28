export type EmailPayload = {
  from: string
  to: string[]
  subject: string
  html: string
  text: string
  replyTo?: string
  /** Extra message headers, for example List-Unsubscribe (18 NTF-04). */
  headers?: Record<string, string>
}

export type EmailTransport = {
  send(payload: EmailPayload, options?: { idempotencyKey?: string }): Promise<{
    data: { id: string } | null
    error: { message: string } | null
  }>
}
