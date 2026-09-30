'use client'

import { FormEvent, useEffect, useState } from 'react'

type Assignment = { title: string; description: string; deadline_at: string; tutor_name: string; logo_url: string | null }

export default function DirectAssignmentClient({ token }: { token: string }) {
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [response, setResponse] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const api = process.env.NEXT_PUBLIC_API_URL

  useEffect(() => { void fetch(`${api}/public/direct-assignments/${token}`).then(async r => {
    const body = await r.json().catch(() => null)
    if (!r.ok) throw new Error(body?.error || 'This assignment link is unavailable')
    setAssignment(body.data)
  }).catch(e => setError(e.message)) }, [api, token])

  async function submit(event: FormEvent) {
    event.preventDefault(); setSubmitting(true); setError('')
    try {
      const r = await fetch(`${api}/public/direct-assignments/${token}/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guest_name: name, guest_email: email, response_text: response }) })
      const body = await r.json().catch(() => null)
      if (!r.ok) throw new Error(body?.error || 'Could not submit your work')
      setDone(true)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not submit your work') } finally { setSubmitting(false) }
  }

  if (error && !assignment) return <main className="flex min-h-screen items-center justify-center bg-[#fbf9f8] p-5"><section className="max-w-md rounded-2xl bg-white p-7 text-center shadow-sm"><h1 className="text-xl font-bold text-[#180d62]">Assignment unavailable</h1><p className="mt-3 text-sm text-[#66616c]">{error}</p></section></main>
  if (!assignment) return <main className="flex min-h-screen items-center justify-center bg-[#fbf9f8] text-sm text-[#66616c]">Loading assignment…</main>
  if (done) return <main className="flex min-h-screen items-center justify-center bg-[#fbf9f8] p-5"><section className="max-w-md rounded-2xl bg-white p-7 text-center shadow-sm"><h1 className="text-xl font-bold text-[#180d62]">Work submitted</h1><p className="mt-3 text-sm leading-6 text-[#66616c]">Your tutor has received your response.</p></section></main>
  return <main className="min-h-screen bg-[#fbf9f8] px-4 py-10"><section className="mx-auto max-w-2xl rounded-2xl border border-[#e5e1dd] bg-white p-6 shadow-sm sm:p-9"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#994704]">Assignment from {assignment.tutor_name}</p><h1 className="mt-2 text-3xl font-bold text-[#180d62]">{assignment.title}</h1><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#474551]">{assignment.description}</p><p className="mt-5 rounded-xl bg-[#f8f6f4] px-4 py-3 text-sm text-[#474551]">Due {new Date(assignment.deadline_at).toLocaleString()}</p><form onSubmit={submit} className="mt-8 space-y-5"><label className="block text-sm font-semibold">Your name<input required value={name} onChange={e => setName(e.target.value)} className="mt-2 min-h-12 w-full rounded-lg border border-[#8b8580] px-3 font-normal" /></label><label className="block text-sm font-semibold">Email <span className="font-normal text-[#66616c]">(optional)</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-2 min-h-12 w-full rounded-lg border border-[#8b8580] px-3 font-normal" /></label><label className="block text-sm font-semibold">Your response<textarea required value={response} onChange={e => setResponse(e.target.value)} rows={8} className="mt-2 w-full rounded-lg border border-[#8b8580] p-3 font-normal" placeholder="Write your answer here…" /></label>{error && <p role="alert" className="text-sm text-[#ba1a1a]">{error}</p>}<button disabled={submitting} className="min-h-12 w-full rounded-xl bg-[#994704] px-5 text-sm font-semibold text-white disabled:opacity-50">{submitting ? 'Submitting…' : 'Submit work'}</button></form></section></main>
}
