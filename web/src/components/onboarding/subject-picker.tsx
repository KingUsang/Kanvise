'use client'

import { useId, useState } from 'react'
import { X } from 'lucide-react'
import { addSubject, MAX_SUBJECTS, SUBJECT_SUGGESTIONS, SUBJECTS_FULL_LINE } from '@/lib/onboarding-script'
import { fieldControlClassName } from '@/components/ui/field'

const chip = 'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-focus'

/** ONB-05: free text with suggestion chips. Up to ten subjects. */
export function SubjectPicker({ subjects, onChange }: { subjects: string[]; onChange: (subjects: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const inputId = useId()
  const full = subjects.length >= MAX_SUBJECTS
  const suggestions = SUBJECT_SUGGESTIONS.filter((name) => !subjects.some((subject) => subject.toLowerCase() === name.toLowerCase()))
    .filter((name) => !draft.trim() || name.toLowerCase().includes(draft.trim().toLowerCase()))

  function commit(value: string) {
    onChange(addSubject(subjects, value))
    setDraft('')
  }

  return (
    <div className="space-y-3">
      {subjects.length > 0 ? (
        <ul aria-label="Chosen subjects" className="flex flex-wrap gap-2">
          {subjects.map((subject) => (
            <li key={subject}>
              <button
                type="button"
                aria-label={`Remove ${subject}`}
                onClick={() => onChange(subjects.filter((item) => item !== subject))}
                className={`${chip} border-dashboard-primary bg-dashboard-primary/10 text-dashboard-primary`}
              >
                {subject}
                <X aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {full ? (
        <p className="text-sm text-dashboard-muted">{SUBJECTS_FULL_LINE}</p>
      ) : (
        <>
          <label htmlFor={inputId} className="sr-only">Add a subject</label>
          <input
            id={inputId}
            value={draft}
            maxLength={40}
            placeholder="Type a subject"
            autoComplete="off"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                if (draft.trim()) commit(draft)
              }
            }}
            className={fieldControlClassName}
          />
          <ul aria-label="Suggested subjects" className="flex flex-wrap gap-2">
            {suggestions.map((name) => (
              <li key={name}>
                <button type="button" onClick={() => commit(name)} className={`${chip} border-dashboard-outline bg-dashboard-surface text-dashboard-foreground hover:bg-dashboard-surface-hover`}>
                  {name}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
