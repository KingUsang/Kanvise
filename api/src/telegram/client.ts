export type TelegramButton = { text: string; url?: string; callback_data?: string }

export type TelegramApi = {
  sendMessage(input: { chatId: string; text: string; button?: TelegramButton }): Promise<{ messageId: string }>
  getChatMemberStatus(chatId: string, userId: string): Promise<string>
  answerCallbackQuery(id: string, text?: string): Promise<void>
  createJoinRequestInvite(input: { chatId: string; name: string; expiresAt: Date }): Promise<{ inviteLink: string }>
  approveChatJoinRequest(input: { chatId: string; userId: string }): Promise<void>
}

function botToken(): string | null {
  const value = process.env.TELEGRAM_BOT_TOKEN?.trim()
  return value || null
}

function apiUrl(method: string): string {
  return `https://api.telegram.org/bot${botToken()}/${method}`
}

async function telegramRequest<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(apiUrl(method), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  const payload = await response.json().catch(() => null) as { ok?: boolean; result?: T; description?: string } | null
  if (!response.ok || !payload?.ok || !payload.result) {
    throw new Error(payload?.description || `Telegram ${method} failed with ${response.status}`)
  }
  return payload.result
}

export function telegramConfigured(): boolean {
  return Boolean(botToken())
}

export const telegramApi: TelegramApi = {
  async sendMessage({ chatId, text, button }) {
    const result = await telegramRequest<{ message_id: number }>('sendMessage', {
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
      ...(button ? { reply_markup: { inline_keyboard: [[button]] } } : {}),
    })
    return { messageId: String(result.message_id) }
  },

  async getChatMemberStatus(chatId, userId) {
    const result = await telegramRequest<{ status: string }>('getChatMember', {
      chat_id: chatId,
      user_id: userId,
    })
    return result.status
  },

  async answerCallbackQuery(id, text) {
    await telegramRequest<boolean>('answerCallbackQuery', {
      callback_query_id: id,
      ...(text ? { text } : {}),
    })
  },

  async createJoinRequestInvite({ chatId, name, expiresAt }) {
    const result = await telegramRequest<{ invite_link: string }>('createChatInviteLink', {
      chat_id: chatId,
      name: name.slice(0, 32),
      expire_date: Math.floor(expiresAt.getTime() / 1000),
      creates_join_request: true,
    })
    return { inviteLink: result.invite_link }
  },

  async approveChatJoinRequest({ chatId, userId }) {
    await telegramRequest<boolean>('approveChatJoinRequest', { chat_id: chatId, user_id: userId })
  },
}
