'use client'

import { AlertTriangle, Calculator, Check, ChevronLeft, ChevronRight, CloudOff, Flag, Keyboard, Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getApiUrl } from '@/config/api'
import { QuestionContent } from '@/components/questions/question-content'
import { ExamCalculator } from './exam-calculator'
import { startNavigationProgress } from '@/components/navigation/NavigationProgress'

type SavedAnswer = {
  selected_option_version_id: string | null
  theory_answer_text: string | null
  is_flagged: boolean
}

type SaveState = 'idle' | 'saving' | 'saved' | 'offline' | 'error'
type AttemptQuestion = {
  id: string; section_title: string; marks: number; question_type: 'mcq' | 'theory';
  plain_text: string; content_blocks: never[]; stimulus?: { title?: string; plain_text?: string; content_blocks: never[] } | null;
  options: Array<{ id: string; plain_text: string; content_blocks: never[] }>
}
type AttemptData = {
  server_now: string
  attempt: { id: string; deadline_at: string | null }
  mock: { title: string; calculator_mode: 'none' | 'basic' | 'scientific'; [key: string]: unknown }
  questions: AttemptQuestion[]
  answers: Array<{ mock_version_question_id: string; selected_option_version_id: string | null; theory_answer_text: string | null; is_flagged: boolean }>
}

function queuedAnswerKey(attemptId: string, questionId: string) {
  return `kanvise-attempt-${attemptId}-${questionId}`
}

function formatRemaining(seconds: number) {
  const safe = Math.max(0, seconds)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const secs = safe % 60
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${minutes}:${String(secs).padStart(2, '0')}`
}

export function MockAttemptClient({ data, token }: { data: AttemptData; token: string }) {
  const router = useRouter()
  const questions = useMemo(() => data.questions || [], [data.questions])
  const initial = useMemo(() => new Map<string, SavedAnswer>((data.answers || []).map((answer): [string, SavedAnswer] => [answer.mock_version_question_id, {
    selected_option_version_id: answer.selected_option_version_id || null,
    theory_answer_text: answer.theory_answer_text || null,
    is_flagged: answer.is_flagged === true,
  }])), [data.answers])
  const [answers, setAnswers] = useState<Map<string, SavedAnswer>>(initial)
  const [saveStates, setSaveStates] = useState<Map<string, SaveState>>(new Map())
  const [current, setCurrent] = useState(0)
  const [calculatorOpen, setCalculatorOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [isOnline, setIsOnline] = useState(true)
  const serverOffset = useRef(new Date(data.server_now).getTime() - Date.now())
  const debounce = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const active = questions[current]
  const remaining = data.attempt.deadline_at
    ? Math.max(0, Math.ceil((new Date(data.attempt.deadline_at).getTime() - (now + serverOffset.current)) / 1000)) : null
  const answeredCount = questions.filter((question) => {
    const answer = answers.get(question.id)
    return Boolean(answer?.selected_option_version_id || answer?.theory_answer_text?.trim())
  }).length
  const unanswered = questions.length - answeredCount

  const save = useCallback(async (questionId: string, answer: SavedAnswer): Promise<boolean> => {
    if (!navigator.onLine) {
      localStorage.setItem(queuedAnswerKey(data.attempt.id, questionId), JSON.stringify(answer))
      setSaveStates(states => new Map(states).set(questionId, 'offline'))
      return false
    }
    setSaveStates(states => new Map(states).set(questionId, 'saving'))
    try {
      const response = await fetch(`${getApiUrl()}/attempts/${data.attempt.id}/answers/${questionId}`, {
        method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(answer),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || 'Could not save answer')
      localStorage.removeItem(queuedAnswerKey(data.attempt.id, questionId))
      setSaveStates(states => new Map(states).set(questionId, 'saved'))
      return true
    } catch (error) {
      localStorage.setItem(queuedAnswerKey(data.attempt.id, questionId), JSON.stringify(answer))
      const offline = !navigator.onLine
      setSaveStates(states => new Map(states).set(questionId, offline ? 'offline' : 'error'))
      if (!offline) toast.error(error instanceof Error ? error.message : 'Could not save answer')
      return false
    }
  }, [data.attempt.id, token])

  const changeAnswer = useCallback((questionId: string, patch: Partial<SavedAnswer>, delayed = false) => {
    const next = { selected_option_version_id: null, theory_answer_text: null, is_flagged: false, ...answers.get(questionId), ...patch }
    setAnswers(values => new Map(values).set(questionId, next))
    // Persist first so an app reload, browser crash, or sudden network loss
    // cannot discard the newest edit while the request is still in flight.
    localStorage.setItem(queuedAnswerKey(data.attempt.id, questionId), JSON.stringify(next))
    const pending = debounce.current.get(questionId)
    if (pending) clearTimeout(pending)
    if (delayed) debounce.current.set(questionId, setTimeout(() => void save(questionId, next), 700))
    else void save(questionId, next)
  }, [answers, save])

  const submit = useCallback(async () => {
    setSubmitting(true)
    try {
      for (const timer of debounce.current.values()) clearTimeout(timer)
      const persisted = await Promise.all([...answers.entries()].map(([questionId, answer]) => save(questionId, answer)))
      if (persisted.some((saved) => !saved)) {
        throw new Error('Your answers are safely queued on this device, but reconnect before submitting so they can reach the exam server.')
      }
      const response = await fetch(`${getApiUrl()}/attempts/${data.attempt.id}/submit`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || 'Could not submit mock')
      toast.success('Your mock has been submitted.')
      startNavigationProgress(); router.replace(`/dashboard/student/mocks/result/${data.attempt.id}`)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not submit mock') }
    finally { setSubmitting(false); setConfirming(false) }
  }, [answers, data.attempt.id, router, save, token])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const markOnline = () => setIsOnline(true)
    const markOffline = () => setIsOnline(false)
    markOnline()
    if (!navigator.onLine) markOffline()
    window.addEventListener('online', markOnline)
    window.addEventListener('offline', markOffline)
    return () => {
      window.removeEventListener('online', markOnline)
      window.removeEventListener('offline', markOffline)
    }
  }, [])
  const timedOut = remaining === 0
  const timeoutSubmitted = useRef(false)
  useEffect(() => {
    if (timedOut && !timeoutSubmitted.current) { timeoutSubmitted.current = true; void submit() }
  }, [submit, timedOut])

  useEffect(() => {
    async function retryQueued() {
      for (const question of questions) {
        const raw = localStorage.getItem(queuedAnswerKey(data.attempt.id, question.id))
        if (raw) {
          try {
            const answer = JSON.parse(raw) as SavedAnswer
            setAnswers(values => new Map(values).set(question.id, answer))
            await save(question.id, answer)
          } catch { localStorage.removeItem(queuedAnswerKey(data.attempt.id, question.id)) }
        }
      }
    }
    void retryQueued()
    window.addEventListener('online', retryQueued)
    return () => window.removeEventListener('online', retryQueued)
  }, [data.attempt.id, questions, save])

  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable || confirming) return
      if (event.key.toLowerCase() === 'n' || event.key === 'ArrowRight') setCurrent(value => Math.min(questions.length - 1, value + 1))
      if (event.key.toLowerCase() === 'p' || event.key === 'ArrowLeft') setCurrent(value => Math.max(0, value - 1))
      if (event.key === '?') setShortcutsOpen(value => !value)
      const optionIndex = 'abcdef'.indexOf(event.key.toLowerCase())
      if (optionIndex >= 0 && active?.question_type === 'mcq' && active.options[optionIndex]) {
        changeAnswer(active.id, { selected_option_version_id: active.options[optionIndex].id })
      }
    }
    window.addEventListener('keydown', keyboard)
    return () => window.removeEventListener('keydown', keyboard)
  }, [active, changeAnswer, confirming, questions.length])

  if (!active) return <main className="p-8 text-center">This mock has no questions.</main>
  const answer = answers.get(active.id) || { selected_option_version_id: null, theory_answer_text: null, is_flagged: false }
  const saveState = saveStates.get(active.id) || 'idle'

  return <main className="min-h-[calc(100vh-4rem)] bg-[#f8f7f5] pb-28 lg:pb-8">
    <header className="sticky top-16 z-20 border-b border-[#dfdad5] bg-white/95 px-4 py-3 backdrop-blur sm:px-6 lg:top-16 lg:px-10"><div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{data.mock.title}</p><p className="truncate text-xs text-[#716c76]">{active.section_title}</p></div><div className="flex items-center gap-2">{data.mock.calculator_mode !== 'none' && <button onClick={() => setCalculatorOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#d9d3cf] px-3 text-sm font-medium text-[#2e2877]"><Calculator size={16} /><span className="hidden sm:inline">Calculator</span></button>}<button onClick={() => setShortcutsOpen(true)} className="hidden min-h-10 items-center gap-2 rounded-lg border border-[#d9d3cf] px-3 text-sm text-[#716c76] sm:inline-flex"><Keyboard size={16} />Shortcuts</button>{remaining !== null && <span className={`min-w-[78px] rounded-lg px-3 py-2 text-center font-mono text-sm font-semibold ${remaining < 300 ? 'bg-[#fde8e4] text-[#a43522]' : 'bg-[#eeeafe] text-[#2e2877]'}`}>{formatRemaining(remaining)}</span>}</div></div></header>
    {!isOnline && <div role="status" className="border-b border-[#f0c8bb] bg-[#fff4ee] px-4 py-3 text-sm text-[#87351f] sm:px-6 lg:px-10"><div className="mx-auto flex max-w-[1440px] items-start gap-2"><CloudOff className="mt-0.5 shrink-0" size={17} /><p><strong>Connection lost.</strong> Keep working—your answers are stored on this device and will retry when you reconnect. The mock timer continues and answers received after time runs out cannot be accepted.</p></div></div>}
    <div className="mx-auto grid max-w-[1440px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:px-10">
      <aside className="order-2 lg:order-1"><div className="sticky top-36 rounded-2xl border border-[#e2ddd8] bg-white p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Questions</h2><span className="text-xs text-[#716c76]">{answeredCount}/{questions.length} answered</span></div><div className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-5 lg:overflow-visible">{questions.map((question, index) => { const saved = answers.get(question.id); const answered = Boolean(saved?.selected_option_version_id || saved?.theory_answer_text?.trim()); return <button key={question.id} onClick={() => setCurrent(index)} aria-label={`Question ${index + 1}${saved?.is_flagged ? ', flagged' : ''}${answered ? ', answered' : ''}`} className={`relative h-10 min-w-10 rounded-lg border text-xs font-semibold ${index === current ? 'border-[#2e2877] bg-[#2e2877] text-white' : answered ? 'border-[#9bceb0] bg-[#edf8f1] text-[#276744]' : 'border-[#d9d3cf] bg-white text-[#5f5964]'}`}>{index + 1}{saved?.is_flagged && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#c26627]" />}</button>})}</div><button onClick={() => setConfirming(true)} className="mt-5 hidden min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#994704] text-sm font-semibold text-white lg:flex"><Send size={16} />Review and submit</button></div></aside>
      <section className="order-1 min-w-0 lg:order-2"><article className="rounded-2xl border border-[#e2ddd8] bg-white p-5 sm:p-7 lg:p-9">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#994704]">Question {current + 1} of {questions.length}</p><p className="mt-1 text-xs text-[#716c76]">{active.marks} mark{Number(active.marks) === 1 ? '' : 's'}</p></div><button onClick={() => changeAnswer(active.id, { is_flagged: !answer.is_flagged })} className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium ${answer.is_flagged ? 'border-[#c26627] bg-[#fff4e8] text-[#994704]' : 'border-[#d9d3cf] text-[#716c76]'}`}><Flag size={16} fill={answer.is_flagged ? 'currentColor' : 'none'} />{answer.is_flagged ? 'Flagged' : 'Flag'}</button></div>
        {active.stimulus && <div className="mt-6 rounded-2xl border-l-4 border-[#c26627] bg-[#faf7f3] p-5"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#994704]">Read this passage</p>{active.stimulus.title && <h2 className="mb-2 font-semibold">{active.stimulus.title}</h2>}<QuestionContent plainText={active.stimulus.plain_text} blocks={active.stimulus.content_blocks} /></div>}
        <div className="mt-7"><QuestionContent plainText={active.plain_text} blocks={active.content_blocks} /></div>
        {active.question_type === 'mcq' ? <fieldset className="mt-7 space-y-3"><legend className="sr-only">Choose one answer</legend>{active.options.map((option, index) => { const selected = answer.selected_option_version_id === option.id; return <label key={option.id} className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${selected ? 'border-[#2e2877] bg-[#f0edff]' : 'border-[#ddd7d2] hover:border-[#aaa2b0]'}`}><input type="radio" name={active.id} checked={selected} onChange={() => changeAnswer(active.id, { selected_option_version_id: option.id, theory_answer_text: null })} className="mt-1 h-4 w-4 accent-[#2e2877]" /><span className="flex min-w-0 gap-2"><span className="font-semibold text-[#2e2877]">{String.fromCharCode(65 + index)}.</span><QuestionContent plainText={option.plain_text} blocks={option.content_blocks} /></span></label>})}</fieldset>
          : <div className="mt-7"><label className="text-sm font-semibold" htmlFor={`answer-${active.id}`}>Your answer</label><textarea id={`answer-${active.id}`} value={answer.theory_answer_text || ''} onChange={event => changeAnswer(active.id, { theory_answer_text: event.target.value, selected_option_version_id: null }, true)} maxLength={20000} className="mt-2 min-h-56 w-full rounded-xl border border-[#d7d1cc] p-4 text-sm leading-6 outline-none focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877]" placeholder="Type your answer here…" /><p className="mt-1 text-right text-xs text-[#8b858f]">{(answer.theory_answer_text || '').length.toLocaleString()} / 20,000</p></div>}
        <div className="mt-7 flex items-center justify-between border-t border-[#eeeae6] pt-5"><span className={`flex items-center gap-1.5 text-xs ${saveState === 'error' || saveState === 'offline' ? 'text-[#a43522]' : 'text-[#716c76]'}`}>{saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? <><Check size={14} />Saved</> : saveState === 'offline' ? <><CloudOff size={14} />Offline — change queued</> : saveState === 'error' ? <><AlertTriangle size={14} />Not saved — retrying</> : 'Changes save automatically'}</span><div className="flex gap-2"><button disabled={current === 0} onClick={() => setCurrent(value => value - 1)} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-[#d9d3cf] px-4 text-sm font-semibold disabled:opacity-40"><ChevronLeft size={17} />Previous</button><button onClick={() => current === questions.length - 1 ? setConfirming(true) : setCurrent(value => value + 1)} className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-[#2e2877] px-4 text-sm font-semibold text-white">{current === questions.length - 1 ? 'Review' : 'Next'}{current < questions.length - 1 && <ChevronRight size={17} />}</button></div></div>
      </article></section>
    </div>
    <button onClick={() => setConfirming(true)} className="fixed inset-x-4 bottom-4 z-20 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#994704] text-sm font-semibold text-white shadow-lg lg:hidden"><Send size={17} />Review and submit</button>
    {calculatorOpen && <ExamCalculator mode={data.mock.calculator_mode === 'scientific' ? 'scientific' : 'basic'} onClose={() => setCalculatorOpen(false)} />}
    {shortcutsOpen && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><button aria-label="Close shortcuts" onClick={() => setShortcutsOpen(false)} className="absolute inset-0 bg-black/35" /><section className="relative w-full max-w-md rounded-2xl bg-white p-6"><h2 className="text-lg font-semibold">Keyboard shortcuts</h2><dl className="mt-4 grid grid-cols-[90px_1fr] gap-3 text-sm"><dt className="font-semibold">A–F</dt><dd>Choose an MCQ option</dd><dt className="font-semibold">N / →</dt><dd>Next question</dd><dt className="font-semibold">P / ←</dt><dd>Previous question</dd><dt className="font-semibold">?</dt><dd>Open this guide</dd></dl><p className="mt-4 text-xs leading-5 text-[#716c76]">Shortcuts pause while you type a theory answer.</p><button onClick={() => setShortcutsOpen(false)} className="mt-5 min-h-11 w-full rounded-xl bg-[#2e2877] text-sm font-semibold text-white">Got it</button></section></div>}
    {confirming && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><button aria-label="Return to mock" onClick={() => !submitting && setConfirming(false)} className="absolute inset-0 bg-black/40" /><section className="relative w-full max-w-lg rounded-2xl bg-white p-6 sm:p-7"><h2 className="text-xl font-semibold">Submit your mock?</h2><p className="mt-2 text-sm leading-6 text-[#716c76]">You answered {answeredCount} of {questions.length} questions.{unanswered ? ` ${unanswered} question${unanswered === 1 ? ' is' : 's are'} still unanswered.` : ' Every question has an answer.'}</p>{unanswered > 0 && <button onClick={() => setConfirming(false)} className="mt-4 text-sm font-semibold text-[#2e2877]">Return and review unanswered questions</button>}<div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button disabled={submitting} onClick={() => setConfirming(false)} className="min-h-11 rounded-xl border border-[#d9d3cf] px-5 text-sm font-semibold">Keep working</button><button disabled={submitting} onClick={() => void submit()} className="min-h-11 rounded-xl bg-[#994704] px-5 text-sm font-semibold text-white disabled:opacity-50">{submitting ? 'Submitting…' : 'Submit final answers'}</button></div></section></div>}
  </main>
}
