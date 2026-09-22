import { createHash, createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createEnrolledRoomRequest, createGuestRoomRequest, enrolledRoomFeatures, verifyPlugNmeetWebhook } from './client'

describe('PlugNmeet provider contract', () => {
  it('creates an uncapped enrolled room with data-saving features', () => {
    const request = createEnrolledRoomRequest({ roomId: 'class-1', title: 'Physics', schoolId: 'school-1', courseId: 'course-1' })
    expect(request.max_participants).toBe(1000)
    expect(request.empty_timeout).toBe(300)
    expect(request.metadata.room_features.enable_analytics).toBe(true)
    expect(request.metadata.room_features.recording_features.enable_auto_cloud_recording).toBe(false)
    expect(request.metadata.room_features.allow_screen_share).toBe(false)
    expect(request.metadata.room_features.chat_features.is_allow_file_upload).toBe(false)
    expect(request.metadata.room_features.insights_features.transcription_features?.is_allow).toBe(false)
    expect(request.metadata.room_features.insights_features.ai_features?.ai_text_chat_features?.is_allow).toBe(true)
    expect(request.metadata.room_features.insights_features.ai_features?.meeting_summarization_features?.is_allow).toBe(false)
  })

  it('signs and verifies the exact webhook body', () => {
    const body = JSON.stringify({ id: 'event-1', event: 'room_started' })
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ sha256: createHash('sha256').update(body).digest('hex') })).toString('base64url')
    const signature = createHmac('sha256', 'test-secret').update(`${header}.${payload}`).digest('base64url')
    const authorization = `Bearer ${header}.${payload}.${signature}`
    expect(verifyPlugNmeetWebhook(body, authorization, 'test-secret')).toBe(true)
    expect(verifyPlugNmeetWebhook(`${body} `, authorization, 'test-secret')).toBe(false)
    expect(verifyPlugNmeetWebhook(body, authorization, 'wrong-secret')).toBe(false)
  })

  it('keeps E2EE disabled so tutor audio can be transcribed', () => {
    expect(enrolledRoomFeatures().end_to_end_encryption_features.is_enabled).toBe(false)
  })

  it('creates a restricted guest room on the same PlugNmeet server', () => {
    const request = createGuestRoomRequest({ roomId: 'guest-1', title: 'Try class', schoolId: 'school-1', courseId: null })
    expect(request.metadata.room_features.recording_features.is_allow).toBe(false)
    expect(request.metadata.room_features.enable_analytics).toBe(false)
    expect(request.metadata.room_features.insights_features.is_allow).toBe(false)
    expect(request.metadata.extra_data.course_id).toBe('')
  })
})
