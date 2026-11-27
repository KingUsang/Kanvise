import { describe, expect, it, vi } from 'vitest'
import type { JobsRepository } from './repository'
import {
  LIVE_CLASS_REMINDER_JOB,
  MOCK_NOTIFY_JOB,
  createGuardedJob,
  CLASS_CANCELLED_NOTIFY_JOB,
  createNotificationJobHandlers,
  runAssignmentDeadlineJob,
  runLiveClassReminderJob,
  runMockPublicationJob,
  runTimetableMaterializationJob,
  type JobsDependencies,
} from './runners'

function dependencies(overrides: Partial<JobsRepository> = {}): JobsDependencies {
  const repository: JobsRepository = {
    async materializeTimetableClasses() { return 0 },
    async claimDueMocks() { return [] },
    async markMockPublicationNotified() {},
    async findDueLiveClasses() { return [] },
    async markLiveClassReminderSent() {},
    async findDueAssignments() { return [] },
    ...overrides,
  }
  return {
    repository,
    notifyMock: vi.fn(async () => ({ failures: [] })) as any,
    notifyClass: vi.fn(async () => ({ failures: [] })) as any,
    notifyAssignment: vi.fn(async () => ({ failures: [] })) as any,
    notifyCancelled: vi.fn(async () => ({ failures: [] })) as any,
    enqueue: vi.fn(async () => 'job') as any,
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  }
}

const now = new Date('2026-07-20T12:00:00Z')

describe('scheduled notification jobs', () => {
  it('enqueues a deduplicated delivery job per published mock and leaves marking to the job', async () => {
    const mark = vi.fn(async () => {})
    const deps = dependencies({
      async claimDueMocks(_now, limit) {
        expect(limit).toBe(50)
        return [{ id: 'mock-1', schoolId: 'school-1', courseId: 'course-1', programmeId: null, audienceScope: 'course', title: 'Mock', courseName: 'Physics' }]
      },
      markMockPublicationNotified: mark,
    })
    await expect(runMockPublicationJob(now, deps)).resolves.toEqual({ name: 'mock_publication', processed: 1, failures: 0 })
    expect(deps.enqueue).toHaveBeenCalledWith(expect.objectContaining({ jobType: 'notify_mock_published', dedupeKey: 'notify_mock_published:mock-1' }))
    expect(mark).not.toHaveBeenCalled()
  })

  it('marks a mock notified only after delivery succeeds and gives up after the last attempt', async () => {
    const mark = vi.fn(async () => {})
    const deps = dependencies({ markMockPublicationNotified: mark })
    const handler = createNotificationJobHandlers(deps)[MOCK_NOTIFY_JOB]
    const job = (attempts: number) => ({ id: 'j', job_type: MOCK_NOTIFY_JOB, payload: { id: 'mock-1' }, attempts, max_attempts: 3 })

    ;(deps.notifyMock as any).mockResolvedValueOnce({ failures: [{ error: 'temporary' }] })
    await expect(handler(job(1))).rejects.toThrow(/delivery failure/)
    expect(mark).not.toHaveBeenCalled()

    ;(deps.notifyMock as any).mockResolvedValueOnce({ failures: [{ error: 'permanent' }] })
    await expect(handler(job(3))).rejects.toThrow(/Gave up after 3 attempts/)
    expect(mark).toHaveBeenCalledWith('mock-1')
  })

  it('uses a bounded upcoming window and enqueues one reminder job per class', async () => {
    const deps = dependencies({
      async findDueLiveClasses(start, end) {
        expect(start.toISOString()).toBe('2026-07-20T12:00:00.000Z')
        expect(end.toISOString()).toBe('2026-07-20T12:15:00.000Z')
        return [{ id: 'class-1', schoolId: 'school-1', courseId: 'course-1', title: 'Class', courseName: 'Physics', startsAt: end.toISOString() }]
      },
    })
    await expect(runLiveClassReminderJob(now, deps)).resolves.toEqual({ name: 'live_class_reminder', processed: 1, failures: 0 })
    expect(deps.enqueue).toHaveBeenCalledWith(expect.objectContaining({ dedupeKey: 'notify_live_class_reminder:class-1' }))
  })

  it('counts a failed enqueue so the class stays eligible for the next tick', async () => {
    const deps = dependencies({
      async findDueLiveClasses() {
        return [{ id: 'class-1', schoolId: 'school-1', courseId: 'course-1', title: 'Class', courseName: 'Physics', startsAt: '2026-07-20T12:05:00Z' }]
      },
    })
    ;(deps.enqueue as any).mockRejectedValueOnce(new Error('db down'))
    await expect(runLiveClassReminderJob(now, deps)).resolves.toMatchObject({ failures: 1 })
  })

  it('marks a reminder sent after delivery and retries partial failures', async () => {
    const mark = vi.fn(async () => {})
    const deps = dependencies({ markLiveClassReminderSent: mark })
    const handler = createNotificationJobHandlers(deps)[LIVE_CLASS_REMINDER_JOB]
    const job = { id: 'j', job_type: LIVE_CLASS_REMINDER_JOB, payload: { id: 'class-delayed' }, attempts: 1, max_attempts: 5 }
    ;(deps.notifyClass as any).mockResolvedValueOnce({ failures: [{ recipientId: 'student-1' }] })
    await expect(handler(job)).rejects.toThrow()
    expect(mark).not.toHaveBeenCalled()
    await handler(job)
    expect(mark).toHaveBeenCalledWith('class-delayed')
  })

  it('retries the queued cancellation notification until every channel succeeds (DEV-LVC-004)', async () => {
    const deps = dependencies()
    const handler = createNotificationJobHandlers(deps)[CLASS_CANCELLED_NOTIFY_JOB]
    const job = { id: 'j', job_type: CLASS_CANCELLED_NOTIFY_JOB, payload: { id: 'class-1' }, attempts: 1, max_attempts: 5 }
    ;(deps.notifyCancelled as any).mockResolvedValueOnce({ failures: [{ recipientId: 'student-1', channel: 'push' }] })
    await expect(handler(job)).rejects.toThrow(/class_cancelled delivery failure/)
    await expect(handler(job)).resolves.toBeUndefined()
    expect(deps.notifyCancelled).toHaveBeenCalledTimes(2)
  })

  it('keeps published weekly timetables materialized 12 weeks ahead', async () => {
    const materialize = vi.fn(async (horizonDays: number) => {
      expect(horizonDays).toBe(84)
      return 3
    })
    const deps = dependencies({ materializeTimetableClasses: materialize })

    await expect(runTimetableMaterializationJob(deps)).resolves.toEqual({
      name: 'timetable_materialization', processed: 3, failures: 0,
    })
    expect(materialize).toHaveBeenCalledOnce()
  })

  it('uses the 24–25 hour assignment window and skips submitted/empty recipients supplied by the repository', async () => {
    const deps = dependencies({
      async findDueAssignments(start, end) {
        expect(start.toISOString()).toBe('2026-07-21T12:00:00.000Z')
        expect(end.toISOString()).toBe('2026-07-21T13:00:00.000Z')
        return [{ id: 'assignment-1', schoolId: 'school-1', courseId: 'course-1', title: 'Essay', courseName: 'English', deadlineAt: end.toISOString(), recipientIds: [] }]
      },
    })
    await runAssignmentDeadlineJob(now, deps)
    expect(deps.notifyAssignment).not.toHaveBeenCalled()
  })

  it('skips overlapping executions and waits for the active run during shutdown', async () => {
    let release!: () => void
    const work = new Promise<void>((resolve) => { release = resolve })
    const task = vi.fn(() => work)
    const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
    const guarded = createGuardedJob('test', task, logger)

    const first = guarded.run()
    const second = guarded.run()
    expect(first).toBe(second)
    expect(task).toHaveBeenCalledOnce()
    expect(logger.warn).toHaveBeenCalledWith('job.overlap_skipped', { name: 'test' })
    release()
    await guarded.waitForIdle()
  })
})
