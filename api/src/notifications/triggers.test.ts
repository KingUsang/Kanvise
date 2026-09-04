import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../telegram/delivery', () => ({ announceTelegramClassReminder: vi.fn(async () => undefined) }))
import {
  notifyClassCancelled,
  notifyAssignmentDeadline,
  notifyLiveClassReminder,
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

  it('targets programme enrolments and all active centre students for wider mocks', async () => {
    const deliver = vi.fn(async () => result)
    await notifyMockPublished({ id: 'mock-programme', schoolId: 'school-1', programmeId: 'programme-1', audienceScope: 'programme', title: 'UTME Mock', courseName: 'Science' }, deliver as any)
    await notifyMockPublished({ id: 'mock-school', schoolId: 'school-1', audienceScope: 'school', title: 'Orientation', courseName: 'Centre' }, deliver as any)
    expect(deliver).toHaveBeenNthCalledWith(1, expect.objectContaining({ recipients: { enrolment: { type: 'programme', id: 'programme-1' } } }))
    expect(deliver).toHaveBeenNthCalledWith(2, expect.objectContaining({ recipients: { school: true } }))
  })

  it('targets only the submission owner after grading', async () => {
    const deliver = vi.fn(async () => ({ ...result, event: 'submission_graded' as const }))
    await notifySubmissionGraded({ id: 'submission-1', assignmentId: 'assignment-1', schoolId: 'school-1', studentId: 'student-1', assignmentTitle: 'Essay', score: '85', feedback: null }, deliver as any)
    expect(deliver).toHaveBeenCalledWith(expect.objectContaining({
      event: 'submission_graded', recipients: { recipientIds: ['student-1'] }, relatedEntityId: 'submission-1',
      push: { body: 'Your assignment has been graded. Open Kanvise to view your result.', url: '/dashboard/student/assignments' },
    }))
    expect(JSON.stringify(deliver.mock.calls[0][0].push)).not.toContain('85')
  })

  it('adds privacy-safe push destinations for reminders and deadlines', async () => {
    const deliver = vi.fn(async () => result)
    await notifyLiveClassReminder({ id: 'class-1', schoolId: 'school-1', courseId: 'course-1', title: 'Physics', courseName: 'Physics', startsAt: '2026-08-16T12:00:00Z' }, deliver as any)
    await notifyAssignmentDeadline({ id: 'assignment-1', schoolId: 'school-1', courseName: 'Physics', title: 'Essay', deadlineAt: '2026-08-17T12:00:00Z', recipientIds: ['student-1'] }, deliver as any)
    expect(deliver).toHaveBeenNthCalledWith(1, expect.objectContaining({
      event: 'live_class_reminder', push: { body: 'Physics starts soon.', url: '/class/class-1' },
    }))
    expect(deliver).toHaveBeenNthCalledWith(2, expect.objectContaining({
      event: 'assignment_deadline', push: { body: 'Essay is due in less than 24 hours.', url: '/dashboard/student/assignments' },
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
