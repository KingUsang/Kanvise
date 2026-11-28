'use client'

import { useEffect, useReducer, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, fieldControlClassName } from '@/components/ui/field'
import {
  AGENCY_ASK,
  choiceQuestions,
  GREETING_LINES,
  initialOnboardingState,
  onboardingReducer,
  QUESTION_ORDER,
  questionNumber,
  replyFor,
  SUBJECTS_ASK,
  validateAgencyName,
  type OnboardingAnswers,
  type QuestionId,
} from '@/lib/onboarding-script'
import { KaviLine, KaviMark } from './kavi-line'
import { SubjectPicker } from './subject-picker'

const chipClass = 'dashboard-press inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-focus'

function askFor(id: QuestionId) {
  return id === 'subjects' ? SUBJECTS_ASK : choiceQuestions[id].ask
}

function answerLabel(id: QuestionId, answers: OnboardingAnswers): string | null {
  if (id === 'subjects') return answers.subjects && answers.subjects.length > 0 ? answers.subjects.join(', ') : null
  const value = answers[id]
  if (value === undefined) return null
  return choiceQuestions[id].options.find((option) => option.value === value)?.label ?? null
}

/** The five segments at the top (ONB-02 to ONB-06). */
function Progress({ current }: { current: number }) {
  return (
    <div role="progressbar" aria-label="Questions" aria-valuemin={1} aria-valuemax={5} aria-valuenow={current + 1} aria-valuetext={`Question ${current + 1} of 5`} className="flex gap-1.5">
      {QUESTION_ORDER.map((id, index) => (
        <span key={id} className={`h-1.5 flex-1 rounded-full ${index <= current ? 'bg-dashboard-primary' : 'bg-dashboard-outline'}`} />
      ))}
    </div>
  )
}

function Exchange({ id, answers }: { id: QuestionId; answers: OnboardingAnswers }) {
  const label = answerLabel(id, answers)
  const reply = replyFor(id, answers)
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3"><KaviMark /><p className="pt-1.5 text-base text-dashboard-foreground">{askFor(id)}</p></div>
      {label ? <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-dashboard-primary px-4 py-2 text-sm text-white">{label}</p> : null}
      {reply ? <div className="flex items-start gap-3"><KaviMark /><p className="pt-1.5 text-base text-dashboard-foreground">{reply}</p></div> : null}
    </div>
  )
}

export function OnboardingChat({ firstName, saving, saveError, onSubmit, onRetry, onUseDefaults, onUseForm }: {
  firstName: string
  /** The last button reads Saving… and cannot be pressed twice (ONB-08). */
  saving: boolean
  saveError: boolean
  /** Called once with the answers when the last answer is in. */
  onSubmit: (answers: OnboardingAnswers) => void
  onRetry: () => void
  onUseDefaults: () => void
  /** ONB-11 */
  onUseForm: () => void
}) {
  const [state, dispatch] = useReducer(onboardingReducer, initialOnboardingState)
  const [agency, setAgency] = useState('')
  const [agencyError, setAgencyError] = useState<string | null>(null)
  const [subjects, setSubjects] = useState<string[]>([])
  const [lineShown, setLineShown] = useState(false)
  const { step, answers } = state
  const index = questionNumber(step)

  useEffect(() => {
    if (step === 'saving') onSubmit(answers)
    // The save starts once, when the last answer arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  if (step === 'hello') {
    const [first, second] = GREETING_LINES(firstName)
    return (
      <div className="space-y-6">
        <KaviMark wave />
        <div className="space-y-2">
          <KaviLine text={first} onShown={() => setLineShown(true)} />
          {lineShown ? <KaviLine text={second} /> : null}
        </div>
        <div className="space-y-2">
          <Button onClick={() => dispatch({ type: 'start' })}>Let&apos;s go</Button>
          <div>
            <button type="button" onClick={onUseForm} className="inline-flex min-h-11 items-center text-sm text-dashboard-muted underline underline-offset-2 hover:text-dashboard-foreground">
              Answer as a form instead
            </button>
          </div>
        </div>
      </div>
    )
  }

  const past = index === null ? QUESTION_ORDER : QUESTION_ORDER.slice(0, index)
  const current = index === null ? null : QUESTION_ORDER[index]

  return (
    <div className="space-y-6">
      <Progress current={index ?? QUESTION_ORDER.length - 1} />
      {(index !== null && index > 0) || step === 'agency' ? (
        <button type="button" onClick={() => dispatch({ type: 'back' })} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-dashboard-muted hover:text-dashboard-foreground">
          <ArrowLeft aria-hidden="true" className="size-4" />Back
        </button>
      ) : null}

      <div className="space-y-5" aria-label="Your conversation with Kavi" role="log">
        {past.map((id) => <Exchange key={id} id={id} answers={answers} />)}
      </div>

      {current ? (
        <div key={current} className="space-y-4">
          <div className="flex items-start gap-3"><KaviMark /><div className="pt-1.5"><KaviLine text={askFor(current)} /></div></div>
          {current === 'subjects' ? (
            <div className="space-y-4 animate-dashboard-chip-in">
              <SubjectPicker subjects={subjects} onChange={setSubjects} />
              <Button onClick={() => dispatch({ type: 'subjects', subjects })}>Continue</Button>
            </div>
          ) : (
            <ul className="flex flex-wrap gap-2" aria-label="Answers">
              {choiceQuestions[current].options.map((option, position) => {
                const selected = answers[current] === option.value
                return (
                  <li key={String(option.value)} className="animate-dashboard-chip-in" style={{ animationDelay: `${position * 60}ms` }}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => dispatch({ type: 'answer', id: current, value: option.value })}
                      className={`${chipClass} ${selected ? 'border-dashboard-primary bg-dashboard-primary text-white' : 'border-dashboard-outline bg-dashboard-surface text-dashboard-foreground hover:bg-dashboard-surface-hover'}`}
                    >
                      {option.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <button type="button" onClick={() => dispatch({ type: 'skip-question' })} className="inline-flex min-h-11 items-center text-sm text-dashboard-muted underline underline-offset-2 hover:text-dashboard-foreground">
            Skip this question
          </button>
        </div>
      ) : null}

      {step === 'agency' ? (
        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            const error = validateAgencyName(agency)
            setAgencyError(error)
            if (!error) dispatch({ type: 'agency', name: agency })
          }}
        >
          <div className="flex items-start gap-3"><KaviMark /><div className="pt-1.5"><KaviLine text={AGENCY_ASK} /></div></div>
          <Field label="Agency name" hint="This is what your tutors and students will see." error={agencyError}>
            <input
              value={agency}
              maxLength={80}
              placeholder="e.g. Science Students Academy"
              onChange={(event) => setAgency(event.target.value)}
              className={fieldControlClassName}
            />
          </Field>
          <Button type="submit">Continue</Button>
        </form>
      ) : null}

      {step === 'saving' ? (
        <div className="space-y-4">
          {saveError ? (
            <>
              <p role="alert" className="text-sm text-dashboard-danger">We couldn&apos;t save your answers. Your choices are still here.</p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={onRetry}>Try again</Button>
                <Button variant="outline" onClick={onUseDefaults}>Continue with defaults</Button>
              </div>
            </>
          ) : (
            <Button pending={saving} pendingLabel="Saving…" disabled>Continue</Button>
          )}
        </div>
      ) : null}
    </div>
  )
}
