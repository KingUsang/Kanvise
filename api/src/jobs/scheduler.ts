import cron, { type ScheduledTask } from 'node-cron'
import { isTelegramEnabled } from '../config/runtime-env'
import { createGuardedJob, runAssignmentDeadlineJob, runLiveClassReminderJob, runMockPublicationJob, runTelegramAttendanceCloseJob, runTimetableMaterializationJob } from './runners'
import { deallocateIdleLiveKitWorker, reconcileClosedLiveClasses, warmLiveKitWorkerForUpcomingClasses } from '../livekit/worker-lifecycle'

export function startScheduledJobs(env: NodeJS.ProcessEnv = process.env) {
  const jobs = [
    { expression: '* * * * *', guarded: createGuardedJob('mock_publication', () => runMockPublicationJob()) },
    { expression: '*/5 * * * *', guarded: createGuardedJob('live_class_reminder', () => runLiveClassReminderJob()) },
    { expression: '*/30 * * * *', guarded: createGuardedJob('assignment_deadline', () => runAssignmentDeadlineJob()) },
    { expression: '17 */6 * * *', guarded: createGuardedJob('timetable_materialization', () => runTimetableMaterializationJob()) },
    { expression: '* * * * *', guarded: createGuardedJob('livekit_worker_warmup', () => warmLiveKitWorkerForUpcomingClasses()) },
    { expression: '*/5 * * * *', guarded: createGuardedJob('livekit_closed_class_reconciliation', () => reconcileClosedLiveClasses()) },
    { expression: '*/5 * * * *', guarded: createGuardedJob('livekit_worker_deallocation', () => deallocateIdleLiveKitWorker()) },
  ]
  if (isTelegramEnabled(env)) {
    jobs.push({ expression: '* * * * *', guarded: createGuardedJob('telegram_attendance_close', () => runTelegramAttendanceCloseJob()) })
  }
  const tasks: ScheduledTask[] = jobs.map(({ expression, guarded }) => cron.schedule(expression, () => {
    void guarded.run().catch((error) => console.error('job.execution_failed', { expression, error }))
  }))

  return {
    async stop() {
      for (const task of tasks) task.stop()
      await Promise.all(jobs.map(({ guarded }) => guarded.waitForIdle()))
      for (const task of tasks) task.destroy()
    },
  }
}
