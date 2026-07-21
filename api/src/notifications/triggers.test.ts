import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  notifyClassCancelled,
  notifyMockFullyGraded,
  notifyMockPublished,
  notifySubmissionGraded,
} from './triggers'

beforeEach(() => { process.env.FRONTEND_URL = 'https://kanvise.test/' })

const result = {
  event: 'mock_published' as const, recipients: 1, inAppCreated: 1, emailsSent: 1,
  emailsAlreadySent: 0, skippedNoEmail: 0, failures: [],
}

describe('route notification triggers', () => {
  it('targets course enrolments when a mock is published', async () => {
    const deliver = vi.fn(async () => result)
    await notifyMockPublished({ id: 'mock-1', schoolId: 'school-1', courseId: 'course-1', title: 'Mock 1', courseName: 'Physics' }, deliver as any)
    expect(deliver).toHaveBeenCalledWith(expect.objectContaining({
      event: 'mock_published', recipients: { enrolment: { type: 'course', id: 'course-1' } }, relatedEntityId: 'mock-1',
    }))
  })

  it('targets only the submission owner after grading', async () => {
    const deliver = vi.fn(async () => ({ ...result, event: 'submission_graded' as const }))
    await notifySubmissionGraded({ id: 'submission-1', assignmentId: 'assignment-1', schoolId: 'school-1', studentId: 'student-1', assignmentTitle: 'Essay', score: '85', feedback: null }, deliver as any)
    expect(deliver).toHaveBeenCalledWith(expect.objectContaining({
      event: 'submission_graded', recipients: { recipientIds: ['student-1'] }, relatedEntityId: 'submission-1',
    }))
  })

  it('deduplicates fully graded delivery by attempt', async () => {
    const deliver = vi.fn(async () => ({ ...result, event: 'mock_fully_graded' as const }))
    await notifyMockFullyGraded({ attemptId: 'attempt-1', mockId: 'mock-1', schoolId: 'school-1', studentId: 'student-1', mockTitle: 'Mock 1', score: '22' }, deliver as any)
    expect(deliver).toHaveBeenCalledWith(expect.objectContaining({ event: 'mock_fully_graded', relatedEntityId: 'attempt-1' }))
  })

  it('targets enrolled students for cancellation', async () => {
    const deliver = vi.fn(async () => ({ ...result, event: 'class_cancelled' as const }))
    await notifyClassCancelled({ id: 'class-1', schoolId: 'school-1', schoolName: 'K School', courseId: 'course-1', title: 'Revision', scheduledAt: '2026-07-21T10:00:00Z' }, deliver as any)
    expect(deliver).toHaveBeenCalledWith(expect.objectContaining({
      event: 'class_cancelled', recipients: { enrolment: { type: 'course', id: 'course-1' } }, relatedEntityId: 'class-1',
    }))
  })
})
