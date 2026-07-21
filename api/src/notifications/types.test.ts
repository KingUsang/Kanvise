import { describe, expect, it } from 'vitest'
import { notificationEmailEvents } from './types'

describe('notification type contract', () => {
  it('maps every shared notification event to its email template', () => {
    expect(notificationEmailEvents).toEqual({
      live_class_reminder: 'live_class_reminder',
      assignment_deadline: 'assignment_deadline',
      mock_published: 'mock_published',
      submission_graded: 'submission_graded',
      mock_fully_graded: 'mock_fully_graded',
      class_cancelled: 'class_cancellation',
    })
  })
})
