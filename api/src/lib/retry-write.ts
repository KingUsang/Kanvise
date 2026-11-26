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
