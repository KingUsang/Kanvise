'use client'

import { ChevronLeft, ChevronRight, Monitor, Smartphone, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { QuestionContent, type ContentBlock } from '@/components/questions/question-content'

export type DraftPreviewQuestion = {
  id: string
  subject: string
  text: string
  marks: number
  type: 'mcq' | 'theory'
  contentBlocks?: ContentBlock[]
  options: Array<{ id: string; text: string; contentBlocks?: ContentBlock[] }>
}

export function MockDraftPreview({ title, description, questions, onClose }: { title: string; description: string; questions: DraftPreviewQuestion[]; onClose: () => void }) {
  const [current, setCurrent] = useState(0)
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const active = questions[current]
  const subjects = useMemo(() => [...new Set(questions.map((question) => question.subject))], [questions])
  const subjectQuestions = active ? questions.map((question, index) => ({ question, index })).filter(({ question }) => question.subject === active.subject) : []
  const localIndex = subjectQuestions.findIndex(({ index }) => index === current)

  return <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#e9e6e2]">
    <header className="sticky top-0 z-20 border-b border-[#d7d1cc] bg-white/95 px-4 py-3 backdrop-blur"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">Student preview · {title || 'Untitled mock'}</p><p className="text-xs text-[#716c76]">Draft answers are not saved</p></div><div className="flex items-center gap-2"><div className="hidden rounded-lg border border-[#d7d1cc] p-1 sm:flex"><button type="button" onClick={() => setViewport('desktop')} aria-label="Desktop preview" className={`rounded p-2 ${viewport === 'desktop' ? 'bg-[#eeeafe] text-[#2e2877]' : 'text-[#716c76]'}`}><Monitor size={17} /></button><button type="button" onClick={() => setViewport('mobile')} aria-label="Mobile preview" className={`rounded p-2 ${viewport === 'mobile' ? 'bg-[#eeeafe] text-[#2e2877]' : 'text-[#716c76]'}`}><Smartphone size={17} /></button></div><button type="button" onClick={onClose} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#d7d1cc] px-3 text-sm font-semibold"><X size={17} />Exit preview</button></div></div></header>
    <div className={`mx-auto min-h-[calc(100vh-65px)] bg-[#f8f7f5] shadow-xl transition-all ${viewport === 'mobile' ? 'max-w-[430px]' : 'max-w-[1500px]'}`}>
      {subjects.length > 1 && <nav aria-label="Preview subjects" className="border-b border-[#e2ddd8] bg-white p-3"><div className="flex gap-2 overflow-x-auto">{subjects.map((subject) => { const first = questions.findIndex((question) => question.subject === subject); return <button key={subject} type="button" onClick={() => setCurrent(first)} className={`min-w-max rounded-lg px-3 py-2 text-sm font-semibold ${active?.subject === subject ? 'bg-[#2e2877] text-white' : 'bg-[#f2efec] text-[#5f5964]'}`}>{subject}</button> })}</div></nav>}
      {!active ? <div className="p-10 text-center"><h2 className="text-lg font-semibold">No questions to preview yet</h2><p className="mt-2 text-sm text-[#716c76]">Return to the builder and add a question.</p></div> : <div className={`grid gap-5 p-4 sm:p-6 ${viewport === 'desktop' ? 'lg:grid-cols-[230px_minmax(0,1fr)]' : ''}`}>
        <aside className={viewport === 'desktop' ? '' : 'order-2'}><div className="rounded-2xl border border-[#e2ddd8] bg-white p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">{active.subject}</h2><span className="text-xs text-[#716c76]">{localIndex + 1}/{subjectQuestions.length}</span></div><div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-2">{subjectQuestions.map(({ question, index }, indexInSubject) => <button key={question.id} type="button" onClick={() => setCurrent(index)} className={`h-10 min-w-10 rounded-lg border text-xs font-semibold ${index === current ? 'border-[#2e2877] bg-[#2e2877] text-white' : answers[question.id] ? 'border-[#9bceb0] bg-[#edf8f1] text-[#276744]' : 'border-[#d9d3cf]'}`}>{indexInSubject + 1}</button>)}</div></div></aside>
        <main className="min-w-0"><article className="rounded-2xl border border-[#e2ddd8] bg-white p-5 sm:p-8"><p className="text-xs font-semibold uppercase tracking-wider text-[#994704]">{active.subject} · Question {localIndex + 1} of {subjectQuestions.length}</p><p className="mt-1 text-xs text-[#716c76]">{active.marks} mark{active.marks === 1 ? '' : 's'}</p>{description && current === 0 && <div className="mt-5 rounded-xl bg-[#faf7f3] p-4 text-sm leading-6 text-[#5f5964]">{description}</div>}<div className="mt-7"><QuestionContent plainText={active.text} blocks={active.contentBlocks || []} /></div>{active.type === 'mcq' ? active.options.length ? <div className="mt-7 space-y-3">{active.options.map((option, index) => <button key={option.id} type="button" onClick={() => setAnswers((currentAnswers) => ({ ...currentAnswers, [active.id]: option.id }))} className={`flex min-h-14 w-full items-start gap-3 rounded-xl border p-4 text-left ${answers[active.id] === option.id ? 'border-[#2e2877] bg-[#f0edff]' : 'border-[#ddd7d2]'}`}><span className="font-semibold text-[#2e2877]">{String.fromCharCode(65 + index)}.</span><QuestionContent plainText={option.text} blocks={option.contentBlocks || []} /></button>)}</div> : <div className="mt-7 rounded-xl border border-[#e8d7a5] bg-[#fffaf0] p-4 text-sm text-[#7a4b00]">Save the draft to load this question-bank item’s answer choices into preview.</div> : <textarea className="mt-7 min-h-48 w-full rounded-xl border border-[#d7d1cc] p-4 text-sm" placeholder="Student’s written answer…" />}<div className="mt-7 flex justify-between border-t border-[#eeeae6] pt-5"><button type="button" disabled={current === 0} onClick={() => setCurrent((value) => Math.max(0, value - 1))} className="inline-flex items-center gap-1 rounded-xl border border-[#d9d3cf] px-4 py-3 text-sm font-semibold disabled:opacity-40"><ChevronLeft size={17} />Previous</button><button type="button" disabled={current === questions.length - 1} onClick={() => setCurrent((value) => Math.min(questions.length - 1, value + 1))} className="inline-flex items-center gap-1 rounded-xl bg-[#2e2877] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">Next<ChevronRight size={17} /></button></div></article></main>
      </div>}
    </div>
  </div>
}
