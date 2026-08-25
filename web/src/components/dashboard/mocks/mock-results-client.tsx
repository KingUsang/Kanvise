'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { QuestionContent, type ContentBlock } from '@/components/questions/question-content'

type MockAnswer = {
  id: string
  theory_answer_text: string | null
  tutor_score: number | null
  tutor_feedback: string | null
  question: { id: string; question_text: string; content_blocks: ContentBlock[]; question_type: string; marks: number; order_index: number }
}

type Attempt = {
  id: string
  status: string
  submitted_at: string | null
  mcq_score: number | null
  correct_mcq_answers: number | null
  total_mcq_questions: number | null
  total_marks: number | null
  student: { first_name: string; last_name: string; email: string } | null
  answers: MockAnswer[]
}

type ResultsData = {
  mock: { id: string; title: string; status: string; course: { name: string } | null }
  attempts: Attempt[]
}

function studentName(attempt: Attempt) {
  return [attempt.student?.first_name, attempt.student?.last_name].filter(Boolean).join(' ') || 'Student'
}

function theoryAnswers(attempt: Attempt) {
  return attempt.answers.filter((answer) => answer.question?.question_type === 'theory')
}

function attemptScore(attempt: Attempt) {
  return Number(attempt.mcq_score || 0) + theoryAnswers(attempt).reduce((sum, answer) => sum + Number(answer.tutor_score || 0), 0)
}

function maximumScore(attempt: Attempt) {
  return Number(attempt.total_marks || 0)
}

function needsGrading(attempt: Attempt) {
  const theory = theoryAnswers(attempt)
  return theory.some((answer) => answer.tutor_score === null)
}

function csvCell(value: string | number) {
  let safe = String(value)
  if (/^[=+\-@]/.test(safe)) safe = `'${safe}`
  return `"${safe.replaceAll('"', '""')}"`
}

export function MockResultsClient({ mockId, token }: { mockId: string; token: string }) {
  const [data, setData] = useState<ResultsData | null>(null)
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null)
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [savingAnswerId, setSavingAnswerId] = useState<string | null>(null)
  const [grantingAttemptId, setGrantingAttemptId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState('')
  const [drafts, setDrafts] = useState<Record<string, { score: string; feedback: string }>>({})
  const apiUrl = process.env.NEXT_PUBLIC_API_URL

  const loadResults = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      const response = await fetch(`${apiUrl}/mocks/${mockId}/results`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || 'Failed to load results')
      setData(body.data)
      setSelectedAttemptId((current) => current || body.data.attempts[0]?.id || null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.'
      setLoadError(message)
      toast.error('Could not load mock results', { description: message })
    } finally {
      setIsLoading(false)
    }
  }, [apiUrl, mockId, token])

  useEffect(() => { void loadResults() }, [loadResults])

  const selectedAttempt = data?.attempts.find((attempt) => attempt.id === selectedAttemptId) || null
  const selectedTheoryAnswers = useMemo(() => selectedAttempt ? theoryAnswers(selectedAttempt) : [], [selectedAttempt])
  const selectedAnswer = selectedTheoryAnswers[selectedQuestionIndex] || null

  const selectAttempt = (attemptId: string) => {
    setSelectedAttemptId(attemptId)
    setSelectedQuestionIndex(0)
  }

  const saveGrade = async (answer: MockAnswer, moveNext = false) => {
    const draft = drafts[answer.id] || { score: String(answer.tutor_score ?? ''), feedback: answer.tutor_feedback || '' }
    const score = Number(draft.score)
    if (!Number.isFinite(score) || score < 0 || score > Number(answer.question.marks)) {
      toast.error(`Enter a score between 0 and ${answer.question.marks}`)
      return
    }
    setSavingAnswerId(answer.id)
    try {
      const response = await fetch(`${apiUrl}/mock-answers/${answer.id}/grade`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tutor_score: score, tutor_feedback: draft.feedback.trim() || null }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || 'Failed to save grade')
      await loadResults()

      if (moveNext && selectedQuestionIndex < selectedTheoryAnswers.length - 1) {
        setSelectedQuestionIndex((index) => index + 1)
      } else if (moveNext && data && selectedAttempt) {
        const currentIndex = data.attempts.findIndex((attempt) => attempt.id === selectedAttempt.id)
        const nextAttempt = data.attempts.slice(currentIndex + 1).find(needsGrading)
          || data.attempts.find((attempt) => attempt.id !== selectedAttempt.id && needsGrading(attempt))
        if (nextAttempt) selectAttempt(nextAttempt.id)
      }
      toast.success(body.fully_graded ? 'Submission grading completed' : 'Grade saved')
    } catch (error) {
      toast.error('Could not save grade', { description: error instanceof Error ? error.message : 'Please try again.' })
    } finally {
      setSavingAnswerId(null)
    }
  }

  const exportCsv = () => {
    if (!data || data.attempts.length === 0) return
    const rows = [
      ['Student', 'Email', 'Status', 'MCQ score', 'Theory score', 'Total score', 'Maximum score', 'Submitted at'],
      ...data.attempts.map((attempt) => [
        studentName(attempt),
        attempt.student?.email || '',
        needsGrading(attempt) ? 'Needs grading' : 'Graded',
        Number(attempt.mcq_score || 0),
        theoryAnswers(attempt).reduce((sum, answer) => sum + Number(answer.tutor_score || 0), 0),
        attemptScore(attempt),
        maximumScore(attempt),
        attempt.submitted_at || '',
      ]),
    ]
    const blob = new Blob([rows.map((row) => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${data.mock.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-results.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Results exported')
  }

  const allowAnotherAttempt = async (attempt: Attempt) => {
    setGrantingAttemptId(attempt.id)
    try {
      const response = await fetch(`${apiUrl}/mocks/${mockId}/attempt-grants`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ attempt_id: attempt.id, reason: 'Allowed from the mock results page' }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || 'Could not allow another attempt')
      toast.success(`${studentName(attempt)} can try this mock one more time`)
    } catch (error) {
      toast.error('Could not allow another attempt', { description: error instanceof Error ? error.message : 'Please try again.' })
    } finally {
      setGrantingAttemptId(null)
    }
  }

  if (isLoading) return <div className="py-20 text-center text-on-surface-variant">Loading mock results…</div>
  if (!data) return <div className="py-20 text-center"><span className="material-symbols-outlined text-4xl text-error">cloud_off</span><p className="mt-3 font-semibold text-on-surface">Mock results are unavailable</p><p className="mt-1 text-sm text-on-surface-variant">{loadError}</p><div className="mt-5 flex justify-center gap-4"><button type="button" onClick={() => void loadResults()} className="rounded bg-primary px-4 py-2 text-sm font-semibold text-white">Try again</button><Link href="/dashboard/mocks" className="px-4 py-2 text-sm font-semibold text-primary">Back to mocks</Link></div></div>

  const pending = data.attempts.filter(needsGrading).length
  const averageMcq = data.attempts.length
    ? Math.round(data.attempts.reduce((sum, attempt) => sum + (Number(attempt.total_mcq_questions) > 0 ? Number(attempt.correct_mcq_answers || 0) / Number(attempt.total_mcq_questions) * 100 : 0), 0) / data.attempts.length)
    : 0
  const currentDraft = selectedAnswer
    ? drafts[selectedAnswer.id] || { score: String(selectedAnswer.tutor_score ?? ''), feedback: selectedAnswer.tutor_feedback || '' }
    : null

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 pb-16">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs text-on-surface-variant"><Link href="/dashboard/mocks" className="hover:text-primary">Mocks</Link> <span className="px-1">›</span> {data.mock.title}</p>
          <h1 className="mt-2 text-3xl font-bold text-on-surface">Mock results</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Review scores and mark written answers for {data.mock.course?.name || 'this subject'}.</p>
        </div>
        <button type="button" onClick={exportCsv} disabled={data.attempts.length === 0} className="inline-flex items-center justify-center gap-2 rounded-md border border-outline-variant bg-white px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container-low disabled:opacity-50">
          <span className="material-symbols-outlined text-lg">download</span> Export CSV
        </button>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-outline-variant bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Total submissions</p><p className="mt-3 text-3xl font-bold text-on-surface">{data.attempts.length}</p></div>
        <div className="rounded-lg border border-outline-variant bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Average MCQ score</p><p className="mt-3 text-3xl font-bold text-on-surface">{averageMcq}%</p></div>
        <div className="rounded-lg border border-outline-variant bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Written answers to mark</p><p className="mt-3 text-3xl font-bold text-[#994704]">{pending} <span className="text-xs font-medium text-on-surface-variant">submissions</span></p></div>
      </section>

      {data.attempts.length === 0 ? (
        <section className="rounded-xl border border-dashed border-outline-variant bg-white px-6 py-20 text-center"><h2 className="text-xl font-semibold text-on-surface">No submissions yet</h2><p className="mt-2 text-on-surface-variant">Student submissions will appear here.</p></section>
      ) : (
        <div className="grid min-h-[620px] gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-lg border border-outline-variant bg-white">
            <div className="border-b border-outline-variant px-5 py-4"><h2 className="font-semibold text-on-surface">Submissions</h2></div>
            {data.attempts.map((attempt) => {
              const pendingAttempt = needsGrading(attempt)
              return (
                <button key={attempt.id} onClick={() => selectAttempt(attempt.id)} className={`w-full border-b border-outline-variant px-5 py-4 text-left transition-colors last:border-0 ${attempt.id === selectedAttemptId ? 'bg-primary-fixed' : 'hover:bg-surface-container-low'}`}>
                  <span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold text-on-surface">{studentName(attempt)}</span><span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${pendingAttempt ? 'bg-[#fff3e8] text-[#994704]' : 'bg-green-100 text-green-800'}`}>{pendingAttempt ? 'Pending' : 'Graded'}</span></span>
                  <span className="mt-2 flex justify-between text-xs text-on-surface-variant"><span>{attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleDateString('en-NG') : 'Not submitted'}</span><span className="font-semibold">Total: {attemptScore(attempt)}/{maximumScore(attempt)}</span></span>
                </button>
              )
            })}
          </aside>

          {selectedAttempt && (
            <main className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-outline-variant bg-white">
              <div className="flex flex-col gap-4 border-b border-outline-variant p-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded bg-primary text-sm font-bold text-white">{studentName(selectedAttempt).split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div><div><h2 className="font-semibold text-on-surface">{studentName(selectedAttempt)}</h2><p className="text-xs text-on-surface-variant">Submitted {selectedAttempt.submitted_at ? new Date(selectedAttempt.submitted_at).toLocaleString('en-NG') : '—'}</p></div></div>
                <div className="flex flex-wrap items-center justify-end gap-4 text-right">
                  <button type="button" onClick={() => void allowAnotherAttempt(selectedAttempt)} disabled={grantingAttemptId === selectedAttempt.id} className="rounded-md border border-outline-variant bg-white px-3 py-2 text-xs font-semibold text-primary hover:bg-primary-fixed disabled:opacity-50">
                    {grantingAttemptId === selectedAttempt.id ? 'Allowing…' : 'Allow another attempt'}
                  </button>
                  <div><p className="text-[10px] font-semibold uppercase text-on-surface-variant">Multiple choice</p><p className="mt-1 text-lg font-bold text-on-surface">{selectedAttempt.mcq_score ?? 0}</p></div>
                  <div><p className="text-[10px] font-semibold uppercase text-[#994704]">Written answers</p><p className="mt-1 text-lg font-bold text-[#994704]">{theoryAnswers(selectedAttempt).reduce((sum, answer) => sum + Number(answer.tutor_score || 0), 0)}</p></div>
                </div>
              </div>

              {selectedAnswer && currentDraft ? (
                <div className="flex flex-1 flex-col">
                  <div className="flex-1 space-y-5 p-6">
                    <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold text-on-surface-variant">Written question {selectedQuestionIndex + 1} of {selectedTheoryAnswers.length}</p><div className="mt-2 max-w-3xl font-semibold leading-6 text-on-surface"><QuestionContent plainText={selectedAnswer.question.question_text} blocks={selectedAnswer.question.content_blocks} /></div></div><span className="shrink-0 text-xs font-semibold text-on-surface-variant">{selectedAnswer.question.marks} marks</span></div>
                    <div className="rounded-lg bg-surface-container-low p-5 text-sm leading-7 text-on-surface whitespace-pre-wrap">{selectedAnswer.theory_answer_text || 'No answer provided.'}</div>
                    <div className="grid gap-4 md:grid-cols-[160px_minmax(0,1fr)]">
                      <label className="text-sm font-semibold text-on-surface">Score<input type="number" min="0" max={selectedAnswer.question.marks} value={currentDraft.score} onChange={(event) => setDrafts((current) => ({ ...current, [selectedAnswer.id]: { ...currentDraft, score: event.target.value } }))} className="mt-2 w-full rounded-md border border-outline-variant px-3 py-2.5 focus:border-primary focus:outline-none" /></label>
                      <label className="text-sm font-semibold text-on-surface">Tutor feedback<textarea value={currentDraft.feedback} onChange={(event) => setDrafts((current) => ({ ...current, [selectedAnswer.id]: { ...currentDraft, feedback: event.target.value } }))} placeholder="Add useful feedback for the student…" className="mt-2 min-h-24 w-full resize-y rounded-md border border-outline-variant px-3 py-2.5 focus:border-primary focus:outline-none" /></label>
                    </div>
                  </div>
                  <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant bg-surface-container-low px-6 py-4"><div className="flex gap-2">{selectedTheoryAnswers.map((answer, index) => <button key={answer.id} type="button" onClick={() => setSelectedQuestionIndex(index)} aria-label={`Open theory question ${index + 1}`} className={`size-8 rounded text-xs font-bold ${index === selectedQuestionIndex ? 'bg-primary text-white' : answer.tutor_score !== null ? 'bg-green-100 text-green-800' : 'bg-white text-on-surface-variant'}`}>{index + 1}</button>)}</div><div className="flex gap-3"><button type="button" onClick={() => void saveGrade(selectedAnswer)} disabled={savingAnswerId === selectedAnswer.id} className="rounded-md border border-outline-variant bg-white px-4 py-2 text-sm font-semibold text-on-surface disabled:opacity-50">Save grade</button><button type="button" onClick={() => void saveGrade(selectedAnswer, true)} disabled={savingAnswerId === selectedAnswer.id} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{selectedQuestionIndex < selectedTheoryAnswers.length - 1 ? 'Save & next question' : 'Complete & next'} <span aria-hidden>→</span></button></div></footer>
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center p-10 text-center text-on-surface-variant">This submission has no theory answers to grade.</div>
              )}
            </main>
          )}
        </div>
      )}
    </div>
  )
}
