import { supabase } from '../lib/supabase'
import type { Json } from '../lib/database.types'
import { durableJobStore, type DurableJob, type DurableJobHandlers, type DurableJobStore } from '../jobs/durable-jobs'
import { deliverNotification } from './service'
import type { NotificationEvent, NotificationRequest, NotificationResult } from './types'

/**
 * Held messages (18 NTF-03).
 *
 * A message caused by an action with an Undo toast is held until the undo
 * window closes: the person dismisses the toast, leaves the page, or 5 minutes
 * pass. Undo inside the window means nothing is sent. When several held
 * messages about one subject are waiting, only the last one is sent.
 *
 * How a later step uses this:
 *
 * 1. Register a builder for the event in `heldMessageBuilders`, for example
 *
 *      heldMessageBuilders.lesson_moved = async (row) => {
 *        const lesson = await readLesson(row.school_id, row.params.lessonId)
 *        if (!lesson || lesson.status === 'cancelled') return null
 *        return { schoolId: row.school_id, event: 'lesson_moved', recipients: ..., ... }
 *      }
 *
 *    The builder runs when the message is released, so it reads the current
 *    state. It returns null when nothing should go out: the target was
 *    deleted or changed, or every recipient was removed (NTF-09 "Removed
 *    people"). Recipients are resolved by deliverNotification at send time.
 *
 * 2. In the route that performs the action, call `holdMessage` with a subject
 *    key such as `lesson:<id>` and return the id with the response.
 *
 * 3. On the web, show the toast with `undoableAction` (web/src/lib/held-messages.ts),
 *    which calls POST /held-messages/:id/undo or /release.
 */

export const HELD_MESSAGE_WINDOW_MS = 5 * 60_000
export const RELEASE_HELD_MESSAGES_JOB = 'release_held_messages'

export type HeldMessageRow = {
  id: string
  school_id: string
  actor_id: string
  subject_key: string
  event: string
  params: Record<string, unknown>
  status: string
  release_at: string
  attempts: number
}

export type HeldMessageBuilder = (row: HeldMessageRow) => Promise<NotificationRequest<NotificationEvent> | null>

/** Filled by later steps (NTF-202, NTF-203, NTF-204, NTF-213, NTF-301). Empty in step 1. */
export const heldMessageBuilders: Partial<Record<string, HeldMessageBuilder>> = {}

export type HeldMessageRepository = {
  insert(input: { schoolId: string; actorId: string; subjectKey: string; event: string; params: Record<string, unknown>; releaseAt: Date }): Promise<{ id: string; releaseAt: string }>
  cancel(id: string, actorId: string, schoolId: string): Promise<boolean>
  releaseNow(id: string, actorId: string, schoolId: string): Promise<boolean>
  claimDue(limit: number): Promise<HeldMessageRow[]>
  finish(id: string, status: 'sent' | 'dropped' | 'failed', error?: string): Promise<void>
}

export const supabaseHeldMessageRepository: HeldMessageRepository = {
  async insert(input) {
    const { data, error } = await supabase.from('held_messages').insert({
      school_id: input.schoolId,
      actor_id: input.actorId,
      subject_key: input.subjectKey,
      event: input.event,
      params: input.params as NonNullable<Json>,
      release_at: input.releaseAt.toISOString(),
    }).select('id, release_at').single()
    if (error) throw error
    return { id: data.id, releaseAt: data.release_at }
  },
  async cancel(id, actorId, schoolId) {
    const { data, error } = await supabase.rpc('cancel_held_message', { p_id: id, p_actor_id: actorId, p_school_id: schoolId })
    if (error) throw error
    return Boolean(data)
  },
  async releaseNow(id, actorId, schoolId) {
    const { data, error } = await supabase.rpc('release_held_message_now', { p_id: id, p_actor_id: actorId, p_school_id: schoolId })
    if (error) throw error
    return Boolean(data)
  },
  async claimDue(limit) {
    const { data, error } = await supabase.rpc('claim_due_held_messages', { p_limit: limit })
    if (error) throw error
    return (data || []).map((row) => ({
      id: row.id,
      school_id: row.school_id,
      actor_id: row.actor_id,
      subject_key: row.subject_key,
      event: row.event,
      params: row.params && typeof row.params === 'object' && !Array.isArray(row.params) ? row.params as Record<string, unknown> : {},
      status: row.status,
      release_at: row.release_at,
      attempts: row.attempts,
    }))
  },
  async finish(id, status, message) {
    const { error } = await supabase.from('held_messages').update({
      status,
      last_error: message ? message.slice(0, 500) : null,
      updated_at: new Date().toISOString(),
    }).eq('id', id).eq('status', 'released')
    if (error) throw error
  },
}

type Logger = Pick<Console, 'info' | 'error' | 'warn'>

export type HeldMessageDependencies = {
  repository: HeldMessageRepository
  enqueue: DurableJobStore['enqueue']
  deliver: (request: NotificationRequest<NotificationEvent>) => Promise<NotificationResult>
  builders: Partial<Record<string, HeldMessageBuilder>>
  logger: Logger
  now: () => Date
}

const defaults: HeldMessageDependencies = {
  repository: supabaseHeldMessageRepository,
  enqueue: (input) => durableJobStore.enqueue(input),
  deliver: (request) => deliverNotification(request),
  builders: heldMessageBuilders,
  logger: console,
  now: () => new Date(),
}

function releaseJobKey(id: string, suffix = 'window') {
  return `${RELEASE_HELD_MESSAGES_JOB}:${id}:${suffix}`
}

/** Hold a message until the undo window closes. */
export async function holdMessage(
  input: { schoolId: string; actorId: string; subjectKey: string; event: string; params?: Record<string, unknown>; windowMs?: number },
  dependencies: Partial<HeldMessageDependencies> = {},
): Promise<{ id: string; releaseAt: string }> {
  const deps = { ...defaults, ...dependencies }
  const windowMs = Math.max(0, Math.min(input.windowMs ?? HELD_MESSAGE_WINDOW_MS, HELD_MESSAGE_WINDOW_MS))
  const releaseAt = new Date(deps.now().getTime() + windowMs)
  const held = await deps.repository.insert({
    schoolId: input.schoolId,
    actorId: input.actorId,
    subjectKey: input.subjectKey,
    event: input.event,
    params: input.params ?? {},
    releaseAt,
  })
  // The job only wakes the releaser; claim_due_held_messages decides what goes.
  await deps.enqueue({
    jobType: RELEASE_HELD_MESSAGES_JOB,
    dedupeKey: releaseJobKey(held.id),
    payload: { heldMessageId: held.id, schoolId: input.schoolId },
    runAt: new Date(held.releaseAt),
  })
  return held
}

/** Undo: nothing is sent. False when the message isn't this person's or has already gone. */
export async function undoHeldMessage(
  input: { id: string; actorId: string; schoolId: string },
  dependencies: Partial<HeldMessageDependencies> = {},
): Promise<boolean> {
  const deps = { ...defaults, ...dependencies }
  const cancelled = await deps.repository.cancel(input.id, input.actorId, input.schoolId)
  if (cancelled) {
    // An older held message about the same subject may now be the newest one,
    // and its own window may already have closed.
    await deps.enqueue({
      jobType: RELEASE_HELD_MESSAGES_JOB,
      dedupeKey: releaseJobKey(input.id, 'undone'),
      payload: { heldMessageId: input.id, schoolId: input.schoolId },
      runAt: deps.now(),
    })
  }
  return cancelled
}

/** The toast closed without Undo: send now instead of waiting the full 5 minutes. */
export async function releaseHeldMessageNow(
  input: { id: string; actorId: string; schoolId: string },
  dependencies: Partial<HeldMessageDependencies> = {},
): Promise<boolean> {
  const deps = { ...defaults, ...dependencies }
  const released = await deps.repository.releaseNow(input.id, input.actorId, input.schoolId)
  if (released) {
    await deps.enqueue({
      jobType: RELEASE_HELD_MESSAGES_JOB,
      dedupeKey: releaseJobKey(input.id, 'now'),
      payload: { heldMessageId: input.id, schoolId: input.schoolId },
      runAt: deps.now(),
    })
  }
  return released
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Send every held message whose window has closed. Idempotent: delivery is
 * recorded per recipient and channel, so a retry never sends twice. Throws
 * when a message failed, so the durable job retries with backoff.
 */
export async function releaseDueHeldMessages(dependencies: Partial<HeldMessageDependencies> = {}) {
  const deps = { ...defaults, ...dependencies }
  const rows = await deps.repository.claimDue(50)
  let sent = 0
  let dropped = 0
  const failures: string[] = []
  for (const row of rows) {
    const builder = deps.builders[row.event]
    try {
      if (!builder) throw new Error(`No held message builder for ${row.event}`)
      const request = await builder(row)
      if (!request) {
        await deps.repository.finish(row.id, 'dropped', 'Nothing to send')
        dropped += 1
        continue
      }
      if (request.schoolId !== row.school_id) throw new Error('Held message builder returned another account')
      const result = await deps.deliver(request)
      if (result.failures.length) throw new Error(`${result.failures.length} delivery failure(s)`)
      await deps.repository.finish(row.id, 'sent')
      sent += 1
    } catch (error) {
      const message = errorMessage(error)
      failures.push(row.id)
      deps.logger.error('held_message.release_failed', { heldMessageId: row.id, event: row.event, attempts: row.attempts, error: message })
      await deps.repository.finish(row.id, 'failed', message).catch((finishError) => {
        // The row stays released; claim_due_held_messages picks it up again later.
        deps.logger.error('held_message.failed_state_write_failed', { heldMessageId: row.id, error: errorMessage(finishError) })
      })
    }
  }
  const summary = { claimed: rows.length, sent, dropped, failed: failures.length }
  deps.logger.info('held_message.release_complete', summary)
  if (failures.length) throw new Error(`${failures.length} held message(s) failed to send`)
  return summary
}

export function createHeldMessageJobHandlers(dependencies: Partial<HeldMessageDependencies> = {}): DurableJobHandlers {
  return {
    [RELEASE_HELD_MESSAGES_JOB]: async (_job: DurableJob) => {
      await releaseDueHeldMessages(dependencies)
    },
  }
}
