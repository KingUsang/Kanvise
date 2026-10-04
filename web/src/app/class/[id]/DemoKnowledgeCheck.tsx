'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { getApiUrl } from '@/config/api'

type Response = { status: 'Correct' | 'Incorrect' | 'No response'; studentId?: string }

const demoCheck = {
  question: "Which example best shows Newton's Third Law?",
  lessonContext: "Newton's Third Law · action and reaction forces",
  options: [
    { id: 'a', text: 'A rocket moves upward as it pushes exhaust gases downward.', correct: true },
    { id: 'b', text: 'A stationary book has balanced forces acting on it.', correct: false },
    { id: 'c', text: 'A car speeds up because its engine produces a forward force.', correct: false },
  ],
}

export default function DemoKnowledgeCheck({ classId, isHost, studentName, studentId }: { classId: string, isHost: boolean, studentName?: string, studentId?: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [classroomReady, setClassroomReady] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [draftQuestion, setDraftQuestion] = useState('')
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null)
  const [responses, setResponses] = useState<Record<string, Response>>({})
  const [insight, setInsight] = useState<any>(null)
  const [insightLoading, setInsightLoading] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const channel = supabase.channel(`class-${classId}`)
      
    channel.on('broadcast', { event: 'knowledge-check-start' }, (payload) => {
      setActiveQuestion(payload.payload.question)
      setIsOpen(true)
    })
    
    channel.on('broadcast', { event: 'knowledge-check-answer' }, (payload) => {
      if (isHost) {
        setResponses(prev => ({ ...prev, [payload.payload.student]: { status: payload.payload.isCorrect ? 'Correct' : 'Incorrect', studentId: payload.payload.studentId } }))
      }
    })

    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [classId, isHost, supabase])

  useEffect(() => {
    const markReady = () => setClassroomReady(true)
    if (window.__kanvisePlugNmeetReady) markReady()
    window.addEventListener('kanvise:plugnmeet-ready', markReady)
    return () => window.removeEventListener('kanvise:plugnmeet-ready', markReady)
  }, [])

  const sendQuestion = () => {
    const q = draftQuestion.trim()
    if (!q) return
    setActiveQuestion(q)
    setComposerOpen(false)
    // The pitch room contains the tutor plus these three learners. Keeping the
    // live check roster aligned with the room prevents unrelated demo accounts
    // from appearing as permanently "Waiting" in the recording.
    setResponses({
      Ada: { status: 'No response' },
      Tobi: { status: 'No response' },
      Emeka: { status: 'No response' },
    })
    supabase.channel(`class-${classId}`).send({
      type: 'broadcast',
      event: 'knowledge-check-start',
      payload: { question: q }
    })
  }

  const generateQuestion = () => {
    setGenerating(true)
    window.setTimeout(() => {
      setDraftQuestion(demoCheck.question)
      setGenerating(false)
      setComposerOpen(true)
    }, 1_200)
  }

  const submitAnswer = (isCorrect: boolean) => {
    setIsOpen(false)
    setActiveQuestion(null)
    supabase.channel(`class-${classId}`).send({
      type: 'broadcast',
      event: 'knowledge-check-answer',
      payload: { student: studentName, studentId, isCorrect }
    })
  }

  const loadInsight = async (sId: string) => {
    setInsightLoading(true)
    const { data: sessionData } = await supabase.auth.getSession()
    const res = await fetch(`${getApiUrl()}/demo/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session?.access_token || ''}` },
        body: JSON.stringify({ studentId: sId, classId })
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.data?.analysis) throw new Error(json?.error || 'Could not load the student insight')
    setInsight(json.data.analysis)
    setInsightLoading(false)
  }

  if (!isHost) {
    if (!isOpen || !activeQuestion) return null
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-xl p-6 shadow-2xl max-w-md w-full">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[#994704]">psychology</span>
            <div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#994704]">Quick check</p><h3 className="font-bold text-lg text-[#180d62]">Check your understanding</h3></div>
          </div>
          <p className="text-slate-700 mb-6 font-medium">{activeQuestion}</p>
          <div className="space-y-3">
            {demoCheck.options.map((option, index) => <button key={option.id} onClick={() => submitAnswer(option.correct)} className="w-full rounded-xl border border-slate-200 p-3 text-left transition-colors hover:border-[#994704] hover:bg-[#fff8f1]"><span className="mr-2 font-bold text-[#312783]">{String.fromCharCode(65 + index)}.</span>{option.text}</button>)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="pointer-events-auto fixed right-6 top-6 z-[2147483647] flex max-w-md flex-col items-end gap-4">
        {!classroomReady ? null : !activeQuestion && !composerOpen && !generating ? (
          <button onClick={generateQuestion} className="flex items-center gap-2 rounded-full bg-[#994704] px-5 py-3 font-semibold text-white shadow-xl transition-colors hover:bg-[#7f3a03]">
            <span className="material-symbols-outlined">psychology</span>
            Suggest a knowledge check
          </button>
        ) : generating ? (
          <div className="w-80 rounded-2xl border border-[#e4d7cb] bg-white px-5 py-4 shadow-2xl" role="status">
            <div className="flex items-center gap-3"><span className="material-symbols-outlined animate-spin text-[#994704]">progress_activity</span><div><p className="text-sm font-semibold text-[#180d62]">Creating a question</p><p className="mt-0.5 text-xs text-[#716c76]">Using what you have just taught…</p></div></div>
          </div>
        ) : composerOpen ? (
          <section className="w-full rounded-2xl border border-[#e4d7cb] bg-white p-5 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-wider text-[#994704]">Suggested from this lesson</p>
            <p className="mt-1 text-xs text-[#716c76]">{demoCheck.lessonContext}</p>
            <h2 className="mt-3 text-lg font-bold leading-6 text-[#180d62]">{draftQuestion}</h2>
            <div className="mt-4 space-y-2">{demoCheck.options.map((option, index) => <div key={option.id} className={`rounded-lg border px-3 py-2 text-sm ${option.correct ? 'border-[#b9dbc4] bg-[#f0faf3]' : 'border-[#e5e1dd]'}`}><span className="mr-2 font-bold text-[#312783]">{String.fromCharCode(65 + index)}.</span>{option.text}{option.correct ? <span className="ml-2 text-xs font-semibold text-[#1e6234]">Correct answer</span> : null}</div>)}</div>
            <div className="mt-4 flex justify-end gap-2"><button onClick={generateQuestion} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600">Try another</button><button onClick={sendQuestion} className="rounded-lg bg-[#994704] px-4 py-2 text-sm font-semibold text-white">Send to students</button></div>
          </section>
        ) : (
          <div className="bg-white rounded-xl shadow-2xl w-80 overflow-hidden border border-slate-200">
            <div className="bg-[#312783] p-4 text-white">
              <h3 className="font-bold text-sm opacity-80 uppercase tracking-wider mb-1">Live Results</h3>
              <p className="font-medium">{activeQuestion}</p>
            </div>
            <div className="p-2 max-h-64 overflow-y-auto">
              {Object.entries(responses).map(([name, response]) => (
                <div key={name} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg group">
                  <span className="text-sm font-medium text-slate-700">{name}</span>
                  <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                        response.status === 'Correct' ? 'bg-green-100 text-green-700' :
                        response.status === 'Incorrect' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {response.status === 'Correct' ? '✓ Correct' : response.status === 'Incorrect' ? '✗ Incorrect' : '— Waiting'}
                      </span>
                      {response.status === 'Incorrect' && name === 'Emeka' && response.studentId && (
                          <button onClick={() => void loadInsight(response.studentId!)} className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-1 rounded hover:bg-red-100">
                              Analyze
                          </button>
                      )}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-100">
              <button onClick={() => setActiveQuestion(null)} className="w-full text-center text-sm font-semibold text-slate-600 hover:text-slate-800">
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {insight && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
            <div className="p-6 border-b border-red-100 bg-red-50/50 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse"></span>
                  <h2 className="text-xl font-bold text-red-950">{insight.student} needs attention</h2>
                </div>
                <p className="text-sm font-semibold text-red-800 uppercase tracking-wide">{insight.topic} — {insight.topicScore}%</p>
              </div>
              <button onClick={() => setInsight(null)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="mb-6">
                 <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Topic Trend</h4>
                 <div className="flex h-28 items-end justify-between gap-2" aria-label={`${insight.topic} assessment trend`}>
                    {insight.history.map((score: number, i: number) => (
                        <div key={i} className="group relative flex h-full flex-1 flex-col items-center justify-end gap-2">
                            <div className={`flex w-full items-start justify-center rounded-t-sm pt-1 text-[10px] font-bold ${i === 3 ? 'bg-red-400 text-red-950' : 'bg-slate-200 text-slate-600'}`} style={{ height: `${Math.max(score, 10)}%` }}>
                              {score}%
                            </div>
                            <span className="text-xs font-semibold text-slate-500">{i === 3 ? 'Today' : `Mock ${i+1}`}</span>
                            <div className="absolute -top-8 bg-slate-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity">{score}%</div>
                        </div>
                    ))}
                 </div>
              </div>
              
              <div className="mb-6">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Cross-Signal Analysis</h4>
                <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                  {insight.student} has consistently struggled with {insight.topic} across four assessments. He also failed today's knowledge check on Newton's Third Law.
                  <br/><br/>
                  <span className="font-semibold">{insight.summary}</span>
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Suggested Action</h4>
                <div className="flex items-center justify-between rounded-xl border border-[#ead8ca] bg-[#fff8f1] p-4">
                   <span className="text-sm font-medium text-[#603016]">{insight.recommendation}</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setInsight(null)} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors">
                Dismiss
              </button>
              <button onClick={() => setInsight(null)} className="flex items-center gap-2 rounded-lg bg-[#994704] px-5 py-2 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#7f3a03] hover:shadow-lg">
                <span className="material-symbols-outlined text-[18px]">send</span>
                Send Support
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
