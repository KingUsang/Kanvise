import { notifyAssignmentDeadline, notifyLiveClassReminder, notifyMockPublished } from '../notifications/triggers'
import { jobsRepository, type JobsRepository } from './repository'
import { durableJobStore, type DurableJob, type DurableJobHandlers, type DurableJobStore } from './durable-jobs'

type Logger = Pick<Console, 'info' | 'error' | 'warn'>
type Delivery = { failures: unknown[] }

export type JobsDependencies = {
  repository: JobsRepository
  notifyMock: typeof notifyMockPublished
  notifyClass: typeof notifyLiveClassReminder
  notifyAssignment: typeof notifyAssignmentDeadline
  enqueue: DurableJobStore['enqueue']
  logger: Logger
}

const defaults: JobsDependencies = {
  repository: jobsRepository,
  notifyMock: notifyMockPublished,
  notifyClass: notifyLiveClassReminder,
  notifyAssignment: notifyAssignmentDeadline,
  enqueue: (input) => durableJobStore.enqueue(input),
  logger: console,
}

function summary(name: string, processed: number, failures: number) {
  return { name, processed, failures }
}

export const MOCK_NOTIFY_JOB = 'notify_mock_published'
export const LIVE_CLASS_REMINDER_JOB = 'notify_live_class_reminder'

export async function runMockPublicationJob(now = new Date(), dependencies = defaults) {
  const mocks = await dependencies.repository.claimDueMocks(now, 50)
  let failures = 0
  for (const mock of mocks) {
    try {
      // Direct links have no centre recipients. Combination recipients are
      // resolved at dashboard access time, so never blast this to a whole
      // programme while a precise notification query is absent.
      if (mock.audienceScope === 'direct_link' || mock.audienceScope === 'combination') {
        await dependencies.repository.markMockPublicationNotified(mock.id)
        continue
      }
      // Delivery runs as a durable job with its own retries and backoff, so a
      // mock whose delivery keeps failing cannot hold a slot in this page forever.
      await dependencies.enqueue({ jobType: MOCK_NOTIFY_JOB, dedupeKey: `${MOCK_NOTIFY_JOB}:${mock.id}`, payload: { ...mock } })
    } catch (error) {
      failures += 1
      dependencies.logger.error('job.mock_publication.item_failed', { mockId: mock.id, error })
    }
  }
  const result = summary('mock_publication', mocks.length, failures)
  dependencies.logger.info('job.mock_publication.complete', result)
  return result
}

export async function runTimetableMaterializationJob(dependencies = defaults) {
  try {
    const created = await dependencies.repository.materializeTimetableClasses(84)
    const result = summary('timetable_materialization', created, 0)
    dependencies.logger.info('job.timetable_materialization.complete', result)
    return result
  } catch (error) {
    dependencies.logger.error('job.timetable_materialization.failed', { error })
    return summary('timetable_materialization', 0, 1)
  }
}

export async function runLiveClassReminderJob(now = new Date(), dependencies = defaults) {
  // The scheduler runs every five minutes, but a process restart or a delayed
  // tick can move a class past the old 10-minute lower bound permanently. Keep
  // the upper bound bounded while allowing unsent upcoming classes to catch up.
  const start = now
  const end = new Date(now.getTime() + 15 * 60_000)
  const classes = await dependencies.repository.findDueLiveClasses(start, end, 50)
  let failures = 0
  for (const liveClass of classes) {
    try {
      await dependencies.enqueue({ jobType: LIVE_CLASS_REMINDER_JOB, dedupeKey: `${LIVE_CLASS_REMINDER_JOB}:${liveClass.id}`, payload: { ...liveClass } })
    } catch (error) {
      failures += 1
      dependencies.logger.error('job.live_class_reminder.item_failed', { liveClassId: liveClass.id, error })
    }
  }
  const result = summary('live_class_reminder', classes.length, failures)
  dependencies.logger.info('job.live_class_reminder.complete', result)
  return result
}

export async function runAssignmentDeadlineJob(now = new Date(), dependencies = defaults) {
  const start = new Date(now.getTime() + 24 * 60 * 60_000)
  const end = new Date(now.getTime() + 25 * 60 * 60_000)
  const assignments = await dependencies.repository.findDueAssignments(start, end, 50)
  let failures = 0
  for (const assignment of assignments) {
    if (assignment.recipientIds.length === 0) continue
    try {
      const delivery = await dependencies.notifyAssignment({ ...assignment }) as Delivery
      failures += delivery.failures.length
    } catch (error) {
      failures += 1
      dependencies.logger.error('job.assignment_deadline.item_failed', { assignmentId: assignment.id, error })
    }
  }
  const result = summary('assignment_deadline', assignments.length, failures)
  dependencies.logger.info('job.assignment_deadline.complete', result)
  return result
}

export function createGuardedJob(name: string, job: () => Promise<unknown>, logger: Logger = console) {
  let active: Promise<unknown> | null = null
  return {
    run() {
      if (active) {
        logger.warn('job.overlap_skipped', { name })
        return active
      }
      active = job().finally(() => { active = null })
      return active
    },
    async waitForIdle() { await active },
  }
}

async function finishNotification(
  job: DurableJob, failureCount: number, markSent: () => Promise<void>, dependencies: JobsDependencies, label: string,
) {
  if (failureCount === 0) return markSent()
  // Sent channels are recorded in their own ledgers, so a retry only re-attempts
  // the ones that failed. After the last attempt, stop retrying (the failures are
  // logged) so the notification is not re-selected forever.
  if (job.attempts >= job.max_attempts) {
    dependencies.logger.error(`job.${label}.gave_up`, { jobId: job.id, failures: failureCount })
    return markSent()
  }
  throw new Error(`${failureCount} ${label} delivery failure(s)`)
}

export function createNotificationJobHandlers(dependencies = defaults): DurableJobHandlers {
  return {
    [MOCK_NOTIFY_JOB]: async (job) => {
      const mock = job.payload as any
      const delivery = await dependencies.notifyMock(mock) as Delivery
      await finishNotification(job, delivery.failures.length, () => dependencies.repository.markMockPublicationNotified(mock.id), dependencies, 'mock_publication')
    },
    [LIVE_CLASS_REMINDER_JOB]: async (job) => {
      const liveClass = job.payload as any
      const delivery = await dependencies.notifyClass(liveClass) as Delivery
      await finishNotification(job, delivery.failures.length, () => dependencies.repository.markLiveClassReminderSent(liveClass.id), dependencies, 'live_class_reminder')
    },
  }
}
