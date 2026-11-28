'use client'

import { useId, useState, useSyncExternalStore } from 'react'
import { ApiRequestError } from '@/lib/api-request'
import {
  createIndexedDbStorage,
  createMemoryStorage,
  createSaveQueue,
  type SaveQueue,
  type SaveSender,
} from '@/lib/offline/save-queue'
import { useAutosaveField } from '@/lib/offline/use-autosave-field'
import { Button } from '@/components/ui/button'
import { ConflictBanner } from '@/components/ui/conflict-banner'
import { fieldControlClassName } from '@/components/ui/field'
import { SaveStatus } from '@/components/ui/save-status'

/*
 * Dev-only demo of a field that saves by itself (SH-13), with a pretend
 * server. Used by /design-system and /design-preview/shell?page=saving.
 * Changes are kept in IndexedDB under a demo person, so a reload shows the
 * draft coming back; nothing is ever sent anywhere.
 */

const DEMO_RECORD = 'demo-plan:1'
const DEMO_FIELD = 'text'

type DemoState = { simulateOffline: boolean; serverFails: boolean }

const demo: DemoState = { simulateOffline: false, serverFails: false }
const server = { value: 'Warm-up: times tables. Then fractions of amounts.', version: 1 }
const listeners = new Set<() => void>()
let snapshot: DemoState = { ...demo }

function setDemo(patch: Partial<DemoState>) {
  Object.assign(demo, patch)
  snapshot = { ...demo }
  listeners.forEach((listener) => listener())
}

function useDemoState() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => snapshot,
    () => snapshot,
  )
}

const browserOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false
export const demoOnline = () => !demo.simulateOffline && browserOnline()

let queue: SaveQueue | null = null

export function getDemoQueue() {
  if (queue) return queue
  const storage = typeof indexedDB === 'undefined' ? createMemoryStorage() : createIndexedDbStorage()
  queue = createSaveQueue({
    storage,
    isOnline: demoOnline,
    events: typeof window === 'undefined' ? undefined : window,
  })
  queue.setScope({ personId: 'design-system-demo', accountId: 'demo' })
  return queue
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const demoSender: SaveSender = async (change) => {
  await wait(700)
  if (!demoOnline()) throw new TypeError('Failed to fetch')
  if (demo.serverFails) throw new ApiRequestError(500, 'Pretend server error')
  if (change.baseVersion !== server.version) return { conflict: server.value, serverVersion: server.version }
  server.value = String(change.value)
  server.version += 1
  return { ok: true, version: server.version }
}

/** Whether the demo is pretending to be offline (for the preview banner). */
export function useDemoOnline() {
  const state = useDemoState()
  const browser = useSyncExternalStore(
    (listener) => {
      window.addEventListener('online', listener)
      window.addEventListener('offline', listener)
      return () => {
        window.removeEventListener('online', listener)
        window.removeEventListener('offline', listener)
      }
    },
    browserOnline,
    () => true,
  )
  return browser && !state.simulateOffline
}

export function AutosaveDemo({ initialConflict = false }: { initialConflict?: boolean }) {
  const demoQueue = getDemoQueue()
  const state = useDemoState()
  const online = useDemoOnline()
  const labelId = useId()
  const [loaded] = useState(() => ({ value: server.value, version: server.version }))
  const field = useAutosaveField({
    recordKey: DEMO_RECORD,
    field: DEMO_FIELD,
    initialValue: loaded.value,
    baseVersion: loaded.version,
    sender: demoSender,
    queue: demoQueue,
  })
  const [conflictShown, setConflictShown] = useState(initialConflict)

  const editElsewhere = () => {
    server.value = 'A co-tutor rewrote this: start with a fractions quiz, then go over homework.'
    server.version += 1
  }

  const toggleOffline = () => {
    const next = !state.simulateOffline
    setDemo({ simulateOffline: next })
    if (next) demoQueue.handleOffline()
    else demoQueue.handleOnline()
  }

  const mine = field.conflict?.mine ?? field.value
  const sampleConflict = conflictShown && !field.conflict

  return (
    <div className="space-y-4 rounded-dashboard-panel border border-dashboard-outline bg-dashboard-surface p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p id={labelId} className="text-dashboard-body font-semibold text-dashboard-foreground">Lesson plan</p>
        <SaveStatus state={field.state} savedAt={field.savedAt} onRetry={field.retry} conflict={Boolean(field.conflict)} />
      </div>
      {field.conflict ? (
        <ConflictBanner mine={mine} theirs={field.conflict.theirs} onKeepMine={field.keepMine} onUseNewer={field.useNewer} />
      ) : sampleConflict ? (
        <ConflictBanner
          mine={field.value}
          theirs="A co-tutor rewrote this: start with a fractions quiz, then go over homework."
          onKeepMine={() => setConflictShown(false)}
          onUseNewer={() => setConflictShown(false)}
        />
      ) : null}
      <textarea
        aria-labelledby={labelId}
        className={`${fieldControlClassName} min-h-32`}
        value={field.value}
        onChange={(event) => field.setValue(event.target.value)}
      />
      <div className="flex flex-wrap items-start gap-3">
        {/* OnlineOnlyButton follows the real connection; the demo also follows "Go offline". */}
        <Button disabledReason={online ? undefined : "You're offline. You can complete this summary when you're back online."}>
          Complete
        </Button>
      </div>
      <fieldset className="space-y-2 border-t border-dashboard-outline pt-4">
        <legend className="text-dashboard-eyebrow font-bold uppercase text-dashboard-muted">Pretend</legend>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" aria-pressed={state.simulateOffline} onClick={toggleOffline}>
            {state.simulateOffline ? 'Go back online' : 'Go offline'}
          </Button>
          <Button variant="outline" aria-pressed={state.serverFails} onClick={() => setDemo({ serverFails: !state.serverFails })}>
            {state.serverFails ? 'Let the server save' : 'Make the server fail'}
          </Button>
          <Button variant="outline" onClick={editElsewhere}>Someone else edits it</Button>
        </div>
        <p className="text-dashboard-secondary text-dashboard-muted">
          Type to save. &ldquo;Someone else edits it&rdquo; changes the pretend server, so your next change finds a newer version.
        </p>
      </fieldset>
    </div>
  )
}
