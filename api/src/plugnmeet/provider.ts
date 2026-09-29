import { supabase } from '../lib/supabase'
import { plugNmeet, plugNmeetClientUrl, plugNmeetConfigured, createEnrolledRoomRequest, createGuestRoomRequest } from './client'

export type ClassroomProvider = 'plugnmeet'

export function providerForClass(input: { accessMode?: string | null; schoolId: string | null | undefined; persisted?: string | null }): ClassroomProvider {
  // Kanvise has one classroom provider. Persisted legacy values are handled
  // by the cancellation migration, never by a browser fallback.
  void input
  return 'plugnmeet'
}

export async function createPlugNmeetRoom(input: { roomId: string; title: string; schoolId: string; courseId: string | null; accessMode: string }) {
  await plugNmeet.createRoom(input.accessMode === 'anyone_with_link' ? createGuestRoomRequest(input) : createEnrolledRoomRequest(input))
  return { provider: 'plugnmeet' as const, providerRoomId: input.roomId, serverUrl: plugNmeetClientUrl() }
}

export async function getPlugNmeetClientConfig(input: { roomId: string; userId: string; name: string; isHost: boolean; schoolId: string; accessMode?: string | null; profilePic?: string | null }) {
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
        extra_data: { school_id: input.schoolId, access_profile: input.isHost ? 'tutor' : input.accessMode === 'anyone_with_link' ? 'guest' : 'enrolled' },
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
