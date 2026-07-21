import { describe, expect, it } from 'vitest'
import { runEmailSmoke, smokeInputs } from './email-smoke'

describe('email smoke script', () => {
  it('contains and renders every email template without sending by default', async () => {
    delete process.env.EMAIL_SMOKE_SEND
    delete process.env.EMAIL_SMOKE_TO
    expect(Object.keys(smokeInputs)).toHaveLength(9)
    const result = await runEmailSmoke()
    expect(result.mode).toBe('render')
    expect(result.results).toHaveLength(9)
    expect(result.results.every((item) => item.htmlBytes > 0 && item.textBytes > 0)).toBe(true)
  })

  it('requires an explicit recipient before enabling delivery', async () => {
    process.env.EMAIL_SMOKE_SEND = 'true'
    delete process.env.EMAIL_SMOKE_TO
    await expect(runEmailSmoke()).rejects.toThrow('EMAIL_SMOKE_TO is required')
    delete process.env.EMAIL_SMOKE_SEND
  })
})
