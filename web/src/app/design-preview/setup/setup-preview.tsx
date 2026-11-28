'use client'

import { useState } from 'react'
import { PageLoadingState } from '@/components/dashboard/async-states'
import { SetupView } from '@/components/dashboard/setup/setup-view'
import { buildSetupChecklist, type SetupFacts } from '@/lib/setup-checklist'
import { ShellPreview } from '../shell/shell-preview'

type Role = 'independent' | 'admin'
type State = 'fresh' | 'some' | 'done' | 'skipped'

const facts: Record<State, SetupFacts> = {
  fresh: { students: 0, courses: 0, lessons: 0, tutors: 0 },
  some: { students: 3, courses: 1, lessons: 0, tutors: 2 },
  skipped: { students: 3, courses: 1, lessons: 0, tutors: 2 },
  done: { students: 3, courses: 1, lessons: 2, tutors: 2 },
}

// The real SETUP_SHIPPED_STEP is 2 until later steps ship; the fixture raises
// it so every row can be reviewed. Nothing here changes the real value.
const PREVIEW_SHIPPED_STEP = 5

export function SetupPreview({ role, state, banner, loading }: { role: Role; state: State; banner: boolean; loading: boolean }) {
  const [bannerOpen, setBannerOpen] = useState(banner)
  // The course plan has no stored fact until step 4, so "done" skips it to reach SET-03.
  const [skipped, setSkipped] = useState<string[]>(state === 'skipped' || state === 'done' ? ['course_plan'] : [])
  const checklist = buildSetupChecklist({
    accountType: role === 'independent' ? 'independent' : 'centre',
    facts: facts[state],
    skippedSteps: skipped,
    shippedStep: PREVIEW_SHIPPED_STEP,
  })
  const content = loading
    ? <PageLoadingState label="Loading your setup" />
    : (
      <SetupView
        firstName={role === 'admin' ? 'Chidi' : 'Alex'}
        checklist={checklist}
        helpUrl="https://help.example.com"
        showDefaultsBanner={bannerOpen}
        onDismissBanner={() => setBannerOpen(false)}
        onToggleSkip={(id, value) => setSkipped((current) => (value ? [...current, id] : current.filter((item) => item !== id)))}
        busyStep={null}
        onFinish={() => undefined}
      />
    )
  return (
    <ShellPreview
      options={{ role: role === 'independent' ? 'independent' : 'admin', rail: false, long: false, read: true, pending: 0, signedOut: false, path: '/dashboard/setup', badge: '0' }}
      content={content}
      setup={state === 'done' ? null : { completed: checklist.completed, total: checklist.total, label: checklist.label }}
    />
  )
}
