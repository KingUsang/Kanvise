import { supabase } from '../lib/supabase'
import { plugNmeet, plugNmeetClientUrl, plugNmeetConfigured, createEnrolledRoomRequest } from './client'

export type ClassroomProvider = 'livekit' | 'plugnmeet'

export function enrolledPlugNmeetEnabled(schoolId: string | null | undefined, env: NodeJS.ProcessEnv = process.env) {
  if (env.PLUGNMEET_ENROLLED_ENABLED !== 'true' || !plugNmeetConfigured(env) || !schoolId) return false
  const allowlist = (env.PLUGNMEET_PILOT_SCHOOL_IDS || '').split(',').map((value) => value.trim()).filter(Boolean)
  // A wildcard is useful for a controlled staging rollout (and keeps the
  // explicit school allowlist available for production). Guest/link classes
  // still never reach this branch because providerForClass checks access_mode.
  return allowlist.includes('*') || allowlist.includes(schoolId)
}

export function providerForClass(input: { accessMode?: string | null; schoolId: string | null | undefined; persisted?: string | null }): ClassroomProvider {
  if (input.persisted === 'plugnmeet' || input.persisted === 'livekit') return input.persisted
  if (input.accessMode === 'enrolled_learners' && enrolledPlugNmeetEnabled(input.schoolId)) return 'plugnmeet'
  return 'livekit'
}

export async function createEnrolledPlugNmeetRoom(input: { roomId: string; title: string; schoolId: string; courseId: string | null }) {
  await plugNmeet.createRoom(createEnrolledRoomRequest(input))
  return { provider: 'plugnmeet' as const, providerRoomId: input.roomId, serverUrl: plugNmeetClientUrl() }
}

export async function getPlugNmeetClientConfig(input: { roomId: string; userId: string; name: string; isHost: boolean; schoolId: string; profilePic?: string | null }) {
  const tokenResult = await plugNmeet.getJoinToken({
    room_id: input.roomId,
    user_info: {
      name: input.name,
      user_id: input.userId,
      is_admin: input.isHost,
      is_hidden: false,
      client_type: 'WEB',
      user_metadata: {
        ...(input.profilePic ? { profile_pic: input.profilePic } : {}),
        extra_data: { school_id: input.schoolId, access_profile: input.isHost ? 'tutor' : 'enrolled' },
        lock_settings: { lock_screen_sharing: true, lock_chat_file_share: true },
      },
    },
  })
  const files = await plugNmeet.getClientFiles()
  const token = tokenResult.token || tokenResult.join_token
  if (!token) throw new Error('PlugNmeet did not return a join token')
  return {
    provider: 'plugnmeet' as const,
    room_id: input.roomId,
    join_token: token,
    server_url: plugNmeetClientUrl(),
    client_files: { css_files: files.css_files || files.css || [], js_files: files.js_files || files.js || [] },
    is_host: input.isHost,
  }
}

export async function persistProvider(input: { classId: string; provider: ClassroomProvider; providerRoomId: string; schoolId: string }) {
  const { error } = await (supabase as any).from('live_classes').update({
    classroom_provider: input.provider,
    provider_room_id: input.providerRoomId,
  }).eq('id', input.classId).eq('school_id', input.schoolId)
  if (error) throw error
}
