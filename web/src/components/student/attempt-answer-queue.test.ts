import { describe, expect, it } from 'vitest'
import {
  clearAttemptAnswers, createLatestWinsQueue, purgeStaleQueuedAnswers, queuedAnswerKey,
  QUEUED_ANSWER_TTL_MS, readQueuedAnswer, writeQueuedAnswer,
} from './attempt-answer-queue'

class MemoryStorage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

const answer = { selected_option_version_id: 'o1', theory_answer_text: null, is_flagged: false }

describe('queued answer storage (DEV-QUIZ-032)', () => {
  it('binds keys to the learner and attempt', () => {
    expect(queuedAnswerKey('u1', 'a1', 'q1')).not.toBe(queuedAnswerKey('u2', 'a1', 'q1'))
  })

  it('returns a fresh entry and drops an expired one', () => {
    const storage = new MemoryStorage()
    const key = queuedAnswerKey('u1', 'a1', 'q1')
    writeQueuedAnswer(storage, key, answer, 1_000)
    expect(readQueuedAnswer(storage, key, 2_000)).toEqual(answer)
    expect(readQueuedAnswer(storage, key, 1_000 + QUEUED_ANSWER_TTL_MS + 1)).toBeNull()
    expect(storage.getItem(key)).toBeNull()
  })

  it('discards corrupt entries', () => {
    const storage = new MemoryStorage()
    const key = queuedAnswerKey('u1', 'a1', 'q1')
    storage.setItem(key, '{not json')
    expect(readQueuedAnswer(storage, key)).toBeNull()
    expect(storage.getItem(key)).toBeNull()
  })

  it('clears one attempt only', () => {
    const storage = new MemoryStorage()
    writeQueuedAnswer(storage, queuedAnswerKey('u1', 'a1', 'q1'), answer)
    writeQueuedAnswer(storage, queuedAnswerKey('u1', 'a1', 'q2'), answer)
    writeQueuedAnswer(storage, queuedAnswerKey('u1', 'a2', 'q1'), answer)
    clearAttemptAnswers(storage, 'u1', 'a1')
    expect(storage.length).toBe(1)
    expect(storage.getItem(queuedAnswerKey('u1', 'a2', 'q1'))).not.toBeNull()
  })

  it('purges legacy, expired and other-learner entries but keeps current ones', () => {
    const storage = new MemoryStorage()
    storage.setItem('kanvise-attempt-a1-q1', JSON.stringify(answer))
    writeQueuedAnswer(storage, queuedAnswerKey('other', 'a1', 'q1'), answer)
    writeQueuedAnswer(storage, queuedAnswerKey('u1', 'a0', 'q1'), answer, 0)
    writeQueuedAnswer(storage, queuedAnswerKey('u1', 'a1', 'q1'), answer, 10 * QUEUED_ANSWER_TTL_MS)
    storage.setItem('unrelated', 'keep')
    purgeStaleQueuedAnswers(storage, 'u1', 10 * QUEUED_ANSWER_TTL_MS + 1)
    expect(storage.getItem('kanvise-attempt-a1-q1')).toBeNull()
    expect(storage.getItem(queuedAnswerKey('other', 'a1', 'q1'))).toBeNull()
    expect(storage.getItem(queuedAnswerKey('u1', 'a0', 'q1'))).toBeNull()
    expect(storage.getItem(queuedAnswerKey('u1', 'a1', 'q1'))).not.toBeNull()
    expect(storage.getItem('unrelated')).toBe('keep')
  })
})

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0))

describe('latest-wins save queue (DEV-QUIZ-031)', () => {
  it('collapses a synchronous burst to the newest value', async () => {
    const sent: string[] = []
    const queue = createLatestWinsQueue<string>(async (_key, value) => { sent.push(value); return true })
    const results = await Promise.all([queue.enqueue('q1', 'a'), queue.enqueue('q1', 'b'), queue.enqueue('q1', 'c')])
    expect(results).toEqual([true, true, true])
    expect(sent).toEqual(['c'])
  })

  it('sends one request at a time and only the newest value queued behind an in-flight save', async () => {
    const sent: string[] = []
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    let inFlight = 0
    let maxInFlight = 0
    const queue = createLatestWinsQueue<string>(async (_key, value) => {
      inFlight += 1; maxInFlight = Math.max(maxInFlight, inFlight)
      if (value === 'a') await gate
      sent.push(value)
      inFlight -= 1
      return true
    })
    const first = queue.enqueue('q1', 'a')
    await tick()
    const second = queue.enqueue('q1', 'b')
    const third = queue.enqueue('q1', 'c')
    release()
    await expect(Promise.all([first, second, third])).resolves.toEqual([true, true, true])
    expect(sent).toEqual(['a', 'c'])
    expect(maxInFlight).toBe(1)
  })

  it('reports whether a sent value is still the newest', async () => {
    const flags: Array<[string, boolean]> = []
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const queue = createLatestWinsQueue<string>(async (_key, value, isCurrent) => {
      if (value === 'a') await gate
      flags.push([value, isCurrent()])
      return true
    })
    const first = queue.enqueue('q1', 'a')
    await tick()
    const second = queue.enqueue('q1', 'b')
    release()
    await Promise.all([first, second])
    expect(flags).toEqual([['a', false], ['b', true]])
  })

  it('retries a failed value on the next enqueue', async () => {
    let calls = 0
    const queue = createLatestWinsQueue<string>(async () => (++calls > 1))
    await expect(queue.enqueue('q1', 'a')).resolves.toBe(false)
    await expect(queue.enqueue('q1', 'a')).resolves.toBe(true)
  })
})
