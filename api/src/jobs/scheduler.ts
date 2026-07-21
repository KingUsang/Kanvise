import cron, { type ScheduledTask } from 'node-cron'
import { createGuardedJob, runAssignmentDeadlineJob, runLiveClassReminderJob, runMockPublicationJob } from './runners'

export function startScheduledJobs() {
  const jobs = [
    { expression: '* * * * *', guarded: createGuardedJob('mock_publication', () => runMockPublicationJob()) },
    { expression: '*/5 * * * *', guarded: createGuardedJob('live_class_reminder', () => runLiveClassReminderJob()) },
    { expression: '*/30 * * * *', guarded: createGuardedJob('assignment_deadline', () => runAssignmentDeadlineJob()) },
  ]
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
