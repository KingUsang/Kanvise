import cron, { type ScheduledTask } from 'node-cron'
import { isTelegramEnabled } from '../config/runtime-env'
import { createGuardedJob, runAssignmentDeadlineJob, runLiveClassReminderJob, runMockPublicationJob, runTelegramAttendanceCloseJob, runTimetableMaterializationJob } from './runners'
import { runLiveClassRecordingJob } from './live-class-recording'
import { reconcileRecorderFleet } from '../recording/recorder-fleet'
import { reconcileInactivePlugNmeetClasses } from '../plugnmeet/room-lifecycle'
import { deallocateIdlePlugNmeet, warmPlugNmeetForUpcomingClasses } from '../plugnmeet/classroom-lifecycle'
import { runOnboardingDripJob } from './onboarding-drip'

export function startScheduledJobs(env: NodeJS.ProcessEnv = process.env) {
  const jobs = [
    { expression: '0 * * * *', guarded: createGuardedJob('onboarding_drip', () => runOnboardingDripJob()) },
    { expression: '* * * * *', guarded: createGuardedJob('mock_publication', () => runMockPublicationJob()) },
    { expression: '*/5 * * * *', guarded: createGuardedJob('live_class_reminder', () => runLiveClassReminderJob()) },
    { expression: '*/30 * * * *', guarded: createGuardedJob('assignment_deadline', () => runAssignmentDeadlineJob()) },
    { expression: '17 */6 * * *', guarded: createGuardedJob('timetable_materialization', () => runTimetableMaterializationJob()) },
    { expression: '* * * * *', guarded: createGuardedJob('plugnmeet_classroom_warmup', () => warmPlugNmeetForUpcomingClasses()) },
    // Reconcile first, then decide whether the VM may sleep. Separate cron
    // callbacks could race and let stale database state keep the VM alive.
    { expression: '*/5 * * * *', guarded: createGuardedJob('plugnmeet_room_lifecycle', async () => {
      await reconcileInactivePlugNmeetClasses()
      return deallocateIdlePlugNmeet()
    }) },
    { expression: '* * * * *', guarded: createGuardedJob('live_class_recording', () => runLiveClassRecordingJob()) },
    { expression: '* * * * *', guarded: createGuardedJob('recorder_fleet', () => reconcileRecorderFleet()) },
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
