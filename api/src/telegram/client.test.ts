import { afterEach, describe, expect, it, vi } from 'vitest'
import { telegramApi, telegramConfigured } from './client'

afterEach(() => vi.unstubAllEnvs())

describe('Telegram Bot API client', () => {
  it('sends an inline callback button without exposing the bot token', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'secret-token')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      ok: true, result: { message_id: 71 },
    }), { status: 200 }))

    await expect(telegramApi.sendMessage({
      chatId: '-1001', text: 'Attendance is open', button: { text: 'Check in', callback_data: 'attendance:window-1' },
    })).resolves.toEqual({ messageId: '71' })

    expect(telegramConfigured()).toBe(true)
    expect(fetchSpy).toHaveBeenCalledWith('https://api.telegram.org/botsecret-token/sendMessage', expect.objectContaining({
      method: 'POST', body: expect.stringContaining('attendance:window-1'),
    }))
    fetchSpy.mockRestore()
  })

  it('fails closed when Telegram rejects a request', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'secret-token')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: false, description: 'Forbidden' }), { status: 403 }))
    await expect(telegramApi.sendMessage({ chatId: '1', text: 'Hello' })).rejects.toThrow('Forbidden')
  })
})
