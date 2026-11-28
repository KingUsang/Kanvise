'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, fieldControlClassName } from '@/components/ui/field'
import {
  choiceQuestions,
  isTeam,
  SUBJECTS_ASK,
  validateAgencyName,
  type Audience,
  type ClassFormat,
  type OnboardingAnswers,
  type TeachingMode,
  type ChoiceId,
  type ChoiceValue,
} from '@/lib/onboarding-script'
import { SubjectPicker } from './subject-picker'

function RadioGroup({ id, answers, onChange }: { id: ChoiceId; answers: OnboardingAnswers; onChange: (value: ChoiceValue) => void }) {
  const question = choiceQuestions[id]
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-dashboard-foreground">{question.ask}</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        {question.options.map((option) => (
          <label key={String(option.value)} className="flex min-h-11 items-center gap-2 text-sm text-dashboard-foreground">
            <input
              type="radio"
              name={id}
              checked={answers[id] === option.value}
              onChange={() => onChange(option.value)}
              className="size-4 accent-[var(--dashboard-primary)]"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/** ONB-11: the same questions as a plain form. Unanswered ones use the defaults. */
export function OnboardingForm({ saving, saveError, onSubmit, onUseDefaults }: {
  saving: boolean
  saveError: boolean
  onSubmit: (answers: OnboardingAnswers) => void
  onUseDefaults: () => void
}) {
  const [answers, setAnswers] = useState<OnboardingAnswers>({})
  const [agencyError, setAgencyError] = useState<string | null>(null)
  const set = (patch: OnboardingAnswers) => setAnswers((current) => ({ ...current, ...patch }))

  return (
    <form
      noValidate
      className="space-y-7"
      onSubmit={(event) => {
        event.preventDefault()
        if (isTeam(answers)) {
          const error = validateAgencyName(answers.agency_name ?? '')
          setAgencyError(error)
          if (error) return
        }
        onSubmit(answers)
      }}
    >
      <div className="space-y-1">
        <h1 className="text-dashboard-page-title font-bold text-dashboard-foreground">A few questions</h1>
        <p className="text-sm text-dashboard-muted">So Kanvise fits the way you teach. You can change these later in Settings.</p>
      </div>
      <RadioGroup id="teaching_mode" answers={answers} onChange={(value) => set({ teaching_mode: value as TeachingMode })} />
      {isTeam(answers) ? (
        <Field label="Agency name" hint="This is what your tutors and students will see." error={agencyError}>
          <input
            value={answers.agency_name ?? ''}
            maxLength={80}
            placeholder="e.g. Science Students Academy"
            onChange={(event) => set({ agency_name: event.target.value })}
            className={fieldControlClassName}
          />
        </Field>
      ) : null}
      <RadioGroup id="audience" answers={answers} onChange={(value) => set({ audience: value as Audience })} />
      <RadioGroup id="class_format" answers={answers} onChange={(value) => set({ class_format: value as ClassFormat })} />
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-dashboard-foreground">{SUBJECTS_ASK}</legend>
        <SubjectPicker subjects={answers.subjects ?? []} onChange={(subjects) => set({ subjects })} />
      </fieldset>
      <RadioGroup id="has_students" answers={answers} onChange={(value) => set({ has_students: value as boolean })} />
      {saveError ? (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-dashboard-danger">We couldn&apos;t save your answers. Your choices are still here.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit">Try again</Button>
            <Button variant="outline" onClick={onUseDefaults}>Continue with defaults</Button>
          </div>
        </div>
      ) : (
        <Button type="submit" pending={saving} pendingLabel="Saving…">Save and continue</Button>
      )}
    </form>
  )
}
