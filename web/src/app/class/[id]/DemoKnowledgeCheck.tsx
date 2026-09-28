'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { getApiUrl } from '@/config/api'

type Response = { status: 'Correct' | 'Incorrect' | 'No response'; studentId?: string }

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
    setResponses({
      Ada: { status: 'No response' }, Tobi: { status: 'No response' }, David: { status: 'No response' },
      Favour: { status: 'No response' }, Emeka: { status: 'No response' }, Sarah: { status: 'No response' },
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
      setDraftQuestion("Which situation best demonstrates Newton's Third Law?")
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
    const res = await fetch(`${getApiUrl()}/demo/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
            <span className="material-symbols-outlined text-purple-600">psychology</span>
            <h3 className="font-bold text-lg text-slate-800">Knowledge Check</h3>
          </div>
          <p className="text-slate-700 mb-6 font-medium">{activeQuestion}</p>
          <div className="space-y-3">
            <button onClick={() => submitAnswer(true)} className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-purple-500 hover:bg-purple-50 transition-colors">
              A block resting on a table experiencing a normal force equal to its weight.
            </button>
            <button onClick={() => submitAnswer(false)} className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-purple-500 hover:bg-purple-50 transition-colors">
              A car accelerating forward when the driver presses the gas pedal.
            </button>
            <button onClick={() => submitAnswer(false)} className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-purple-500 hover:bg-purple-50 transition-colors">
              A rocket propelling upward by expelling exhaust gases downward.
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="pointer-events-auto fixed right-6 top-6 z-[2147483647] flex max-w-md flex-col items-end gap-4">
        {!classroomReady ? null : !activeQuestion && !composerOpen && !generating ? (
          <button onClick={generateQuestion} className="bg-purple-600 text-white px-5 py-3 rounded-full shadow-xl font-semibold flex items-center gap-2 hover:bg-purple-700 transition-colors">
            <span className="material-symbols-outlined">psychology</span>
            Generate knowledge check
          </button>
        ) : generating ? (
          <div className="rounded-2xl border border-purple-200 bg-white px-5 py-4 shadow-2xl" role="status">
            <p className="text-sm font-semibold text-purple-800">Generating a question from today’s lesson…</p>
          </div>
        ) : composerOpen ? (
          <section className="w-full rounded-2xl border border-purple-200 bg-white p-5 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-wider text-purple-700">Knowledge check</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">Ask the class a question</h2>
            <p className="mt-1 text-sm text-slate-600">Use something you have just taught to check understanding.</p>
            <textarea value={draftQuestion} onChange={(event) => setDraftQuestion(event.target.value)} aria-label="Knowledge check question" autoFocus rows={4} placeholder="Type a question for your learners…" className="mt-4 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900 outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100" />
            <div className="mt-3 flex justify-end gap-2"><button onClick={() => setComposerOpen(false)} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600">Cancel</button><button disabled={!draftQuestion.trim()} onClick={sendQuestion} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Send to learners</button></div>
          </section>
        ) : (
          <div className="bg-white rounded-xl shadow-2xl w-80 overflow-hidden border border-slate-200">
            <div className="bg-purple-600 text-white p-4">
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
                 <div className="flex justify-between items-end h-24 gap-2">
                    {insight.history.map((score: number, i: number) => (
                        <div key={i} className="flex-1 flex flex-col items-center justify-end gap-2 group relative">
                            <div className={`w-full rounded-t-sm transition-all ${i === 3 ? 'bg-red-400' : 'bg-slate-200'}`} style={{ height: `${Math.max(score, 10)}%` }}></div>
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
                <div className="flex items-center justify-between bg-purple-50 p-4 rounded-xl border border-purple-100">
                   <span className="text-sm text-purple-900 font-medium">{insight.recommendation}</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setInsight(null)} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors">
                Dismiss
              </button>
              <button onClick={() => setInsight(null)} className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 shadow-md hover:shadow-lg transition-all flex items-center gap-2">
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
