import { describe, expect, it, vi } from 'vitest'
import type { JobsRepository } from './repository'
import {
  createGuardedJob,
  runAssignmentDeadlineJob,
  runLiveClassReminderJob,
  runMockPublicationJob,
  type JobsDependencies,
} from './runners'

function dependencies(overrides: Partial<JobsRepository> = {}): JobsDependencies {
  const repository: JobsRepository = {
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
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  }
}

const now = new Date('2026-07-20T12:00:00Z')

describe('scheduled notification jobs', () => {
  it('publishes bounded mocks and marks notification completion only after success', async () => {
    const mark = vi.fn(async () => {})
    const deps = dependencies({
      async claimDueMocks(_now, limit) {
        expect(limit).toBe(50)
        return [{ id: 'mock-1', schoolId: 'school-1', courseId: 'course-1', title: 'Mock', courseName: 'Physics' }]
      },
      markMockPublicationNotified: mark,
    })
    await expect(runMockPublicationJob(now, deps)).resolves.toEqual({ name: 'mock_publication', processed: 1, failures: 0 })
    expect(mark).toHaveBeenCalledWith('mock-1')

    ;(deps.notifyMock as any).mockResolvedValueOnce({ failures: [{ error: 'temporary' }] })
    await runMockPublicationJob(now, deps)
    expect(mark).toHaveBeenCalledTimes(1)
  })

  it('uses the documented 10–15 minute class window and retries partial failures', async () => {
    const mark = vi.fn(async () => {})
    const deps = dependencies({
      async findDueLiveClasses(start, end) {
        expect(start.toISOString()).toBe('2026-07-20T12:10:00.000Z')
        expect(end.toISOString()).toBe('2026-07-20T12:15:00.000Z')
        return [{ id: 'class-1', schoolId: 'school-1', courseId: 'course-1', title: 'Class', courseName: 'Physics', startsAt: end.toISOString() }]
      },
      markLiveClassReminderSent: mark,
    })
    ;(deps.notifyClass as any).mockResolvedValueOnce({ failures: [{ recipientId: 'student-1' }] })
    const result = await runLiveClassReminderJob(now, deps)
    expect(result.failures).toBe(1)
    expect(mark).not.toHaveBeenCalled()
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
