import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export type PlugNmeetRoomFeatures = {
  allow_webcams: boolean
  mute_on_start: boolean
  allow_screen_share: boolean
  admin_only_webcams: boolean
  allow_view_other_webcams: boolean
  allow_view_other_users_list: boolean
  enable_analytics: boolean
  allow_virtual_bg: boolean
  allow_raise_hand: boolean
  auto_gen_user_id: boolean
  room_duration: number
  recording_features: {
    is_allow: boolean
    is_allow_cloud: boolean
    is_allow_local: boolean
    enable_auto_cloud_recording: boolean
    only_record_admin_webcams: boolean
  }
  chat_features: { is_allow: boolean; is_allow_file_upload: boolean }
  shared_note_pad_features: { is_allow: boolean }
  whiteboard_features: { is_allow: boolean }
  external_media_player_features: { is_allow: boolean }
  external_broadcasting_features: { is_allow: boolean; is_allow_rtmp: boolean }
  waiting_room_features: { is_active: boolean }
  breakout_room_features: { is_allow: boolean }
  display_external_link_features: { is_allow: boolean }
  ingress_features: { is_allow: boolean }
  polls_features: { is_allow: boolean }
  insights_features: { is_allow: boolean }
  sip_dial_in_features: { is_allow: boolean }
  end_to_end_encryption_features: { is_enabled: boolean }
}

export type PlugNmeetRoomCreateRequest = {
  room_id: string
  max_participants: number
  empty_timeout: number
  metadata: {
    room_title: string
    welcome_message: string
    webhook_url?: string
    logout_url?: string
    room_features: PlugNmeetRoomFeatures
    copyright_conf: { display: boolean }
    extra_data: Record<string, string | null>
  }
}

export type PlugNmeetJoinRequest = {
  room_id: string
  user_info: {
    name: string
    user_id: string
    is_admin: boolean
    is_hidden: boolean
    client_type: 'WEB'
    user_metadata: {
      profile_pic?: string
      extra_data: Record<string, string | null>
      lock_settings: { lock_screen_sharing: boolean; lock_chat_file_share: boolean }
    }
  }
}

type PlugNmeetResponse<T = Record<string, unknown>> = T & { status?: boolean; msg?: string; status_code?: number }

export function plugNmeetConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.PLUGNMEET_SERVER_URL && env.PLUGNMEET_API_KEY && env.PLUGNMEET_API_SECRET)
}

function config() {
  const serverUrl = process.env.PLUGNMEET_SERVER_URL?.replace(/\/$/, '')
  const apiKey = process.env.PLUGNMEET_API_KEY
  const apiSecret = process.env.PLUGNMEET_API_SECRET
  if (!serverUrl || !apiKey || !apiSecret) throw new Error('PlugNmeet environment variables are not configured')
  return { serverUrl, apiKey, apiSecret }
}

export function signPlugNmeetBody(body: string, secret = process.env.PLUGNMEET_API_SECRET || '') {
  return createHmac('sha256', secret).update(body).digest('hex')
}

function verifyWebhookJwt(body: string, authorization: string, secret: string) {
  const token = authorization.replace(/^Bearer\s+/i, '').trim()
  const segments = token.split('.')
  if (segments.length !== 3) return false
  try {
    const [encodedHeader, encodedPayload, encodedSignature] = segments
    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8')) as { alg?: string; typ?: string }
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as { sha256?: string; exp?: number }
    if (header.alg !== 'HS256' || !payload.sha256 || (payload.exp !== undefined && payload.exp < Math.floor(Date.now() / 1000))) return false
    const expectedSignature = createHmac('sha256', secret).update(`${encodedHeader}.${encodedPayload}`).digest()
    const suppliedSignature = Buffer.from(encodedSignature, 'base64url')
    const calculatedHash = createHash('sha256').update(body).digest('hex')
    return suppliedSignature.length === expectedSignature.length
      && timingSafeEqual(suppliedSignature, expectedSignature)
      && payload.sha256 === calculatedHash
  } catch {
    return false
  }
}

export function verifyPlugNmeetWebhook(body: string, authorization: string | null, secret = process.env.PLUGNMEET_WEBHOOK_SECRET || process.env.PLUGNMEET_API_SECRET || '') {
  if (!authorization || !secret) return false
  return verifyWebhookJwt(body, authorization, secret)
}

export function enrolledRoomFeatures(): PlugNmeetRoomFeatures {
  return {
    allow_webcams: true,
    mute_on_start: true,
    allow_screen_share: false,
    admin_only_webcams: false,
    allow_view_other_webcams: true,
    allow_view_other_users_list: true,
    enable_analytics: true,
    allow_virtual_bg: false,
    allow_raise_hand: true,
    auto_gen_user_id: false,
    room_duration: 0,
    recording_features: {
      is_allow: true,
      is_allow_cloud: true,
      is_allow_local: false,
      enable_auto_cloud_recording: false,
      only_record_admin_webcams: false,
    },
    chat_features: { is_allow: true, is_allow_file_upload: false },
    shared_note_pad_features: { is_allow: false },
    whiteboard_features: { is_allow: true },
    external_media_player_features: { is_allow: false },
    external_broadcasting_features: { is_allow: false, is_allow_rtmp: false },
    waiting_room_features: { is_active: false },
    breakout_room_features: { is_allow: false },
    display_external_link_features: { is_allow: false },
    ingress_features: { is_allow: false },
    polls_features: { is_allow: true },
    insights_features: { is_allow: false },
    sip_dial_in_features: { is_allow: false },
    end_to_end_encryption_features: { is_enabled: false },
  }
}

export function createEnrolledRoomRequest(input: {
  roomId: string
  title: string
  schoolId: string
  courseId: string | null
}) : PlugNmeetRoomCreateRequest {
  return {
    room_id: input.roomId,
    max_participants: 0,
    empty_timeout: 0,
    metadata: {
      room_title: input.title,
      welcome_message: 'Welcome to your Kanvise class.',
      ...(process.env.PLUGNMEET_WEBHOOK_URL ? { webhook_url: process.env.PLUGNMEET_WEBHOOK_URL } : {}),
      ...(process.env.FRONTEND_URL ? { logout_url: `${process.env.FRONTEND_URL.replace(/\/$/, '')}/dashboard` } : {}),
      room_features: enrolledRoomFeatures(),
      copyright_conf: { display: false },
      extra_data: { school_id: input.schoolId, course_id: input.courseId },
    },
  }
}

async function request<T>(path: string, payload: Record<string, unknown>): Promise<PlugNmeetResponse<T>> {
  const { serverUrl, apiKey, apiSecret } = config()
  const body = JSON.stringify(payload)
  const response = await fetch(`${serverUrl}/auth${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'API-KEY': apiKey,
      'HASH-SIGNATURE': signPlugNmeetBody(body, apiSecret),
    },
    body,
  })
  const json = await response.json().catch(() => ({})) as PlugNmeetResponse<T>
  if (!response.ok || json.status === false) {
    throw new Error(`PlugNmeet ${path} failed (${response.status}): ${json.msg || 'unknown error'}`)
  }
  return json
}

export const plugNmeet = {
  createRoom(input: PlugNmeetRoomCreateRequest) {
    return request<{ room_id?: string }>('/room/create', input as unknown as Record<string, unknown>)
  },
  getJoinToken(input: PlugNmeetJoinRequest) {
    return request<{ token?: string; join_token?: string }>('/room/getJoinToken', input as unknown as Record<string, unknown>)
  },
  endRoom(roomId: string) {
    return request('/room/end', { room_id: roomId })
  },
  getClientFiles() {
    return request<{ css_files?: string[]; js_files?: string[]; css?: string[]; js?: string[] }>('/getClientFiles', {})
  },
  createPoll(input: { room_id: string; question: string; options: Array<{ id: number; text: string; is_correct?: boolean }>; is_quiz: boolean; is_anonymous: boolean; duration: number }) {
    return request<{ poll_id?: string }>('/room/createPoll', input as unknown as Record<string, unknown>)
  },
}

export function plugNmeetClientUrl() {
  return config().serverUrl
}
