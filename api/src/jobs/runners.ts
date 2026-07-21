import { notifyAssignmentDeadline, notifyLiveClassReminder, notifyMockPublished } from '../notifications/triggers'
import { jobsRepository, type JobsRepository } from './repository'

type Logger = Pick<Console, 'info' | 'error' | 'warn'>
type Delivery = { failures: unknown[] }

export type JobsDependencies = {
  repository: JobsRepository
  notifyMock: typeof notifyMockPublished
  notifyClass: typeof notifyLiveClassReminder
  notifyAssignment: typeof notifyAssignmentDeadline
  logger: Logger
}

const defaults: JobsDependencies = {
  repository: jobsRepository,
  notifyMock: notifyMockPublished,
  notifyClass: notifyLiveClassReminder,
  notifyAssignment: notifyAssignmentDeadline,
  logger: console,
}

function summary(name: string, processed: number, failures: number) {
  return { name, processed, failures }
}

export async function runMockPublicationJob(now = new Date(), dependencies = defaults) {
  const mocks = await dependencies.repository.claimDueMocks(now, 50)
  let failures = 0
  for (const mock of mocks) {
    try {
      const delivery = await dependencies.notifyMock({ ...mock })
      failures += delivery.failures.length
      if (delivery.failures.length === 0) await dependencies.repository.markMockPublicationNotified(mock.id)
    } catch (error) {
      failures += 1
      dependencies.logger.error('job.mock_publication.item_failed', { mockId: mock.id, error })
    }
  }
  const result = summary('mock_publication', mocks.length, failures)
  dependencies.logger.info('job.mock_publication.complete', result)
  return result
}

export async function runLiveClassReminderJob(now = new Date(), dependencies = defaults) {
  const start = new Date(now.getTime() + 10 * 60_000)
  const end = new Date(now.getTime() + 15 * 60_000)
  const classes = await dependencies.repository.findDueLiveClasses(start, end, 50)
  let failures = 0
  for (const liveClass of classes) {
    try {
      const delivery = await dependencies.notifyClass({ ...liveClass }) as Delivery
      if (delivery.failures.length === 0) await dependencies.repository.markLiveClassReminderSent(liveClass.id)
      else failures += delivery.failures.length
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
