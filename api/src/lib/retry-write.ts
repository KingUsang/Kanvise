/**
 * Retry a short database write a few times. Used after an external side effect
 * (an email or push was already accepted by the provider) so a transient write
 * failure does not turn a delivered message back into a retryable one.
 */
export async function retryWrite(write: () => Promise<void>, attempts = 3, delayMs = 200): Promise<boolean> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await write()
      return true
    } catch {
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, delayMs * attempt))
    }
  }
  return false
}

/**
 * Last resort after the provider accepted a message but the "sent" write kept
 * failing: push the delivery claim out by a day so the claim expiry does not
 * hand the row to another worker that would send it again. Best effort.
 */
export async function holdSentClaim(table: 'email_deliveries' | 'push_deliveries', idempotencyKey: string): Promise<void> {
  try {
    const { supabase } = await import('./supabase')
    await (supabase as any).from(table)
      .update({ claimed_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() })
      .eq('idempotency_key', idempotencyKey)
  } catch { /* the failure is already logged by the caller */ }
}
