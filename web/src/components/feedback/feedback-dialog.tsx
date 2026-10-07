'use client'

import { useId, useState } from 'react'
import * as Sentry from '@sentry/nextjs'
import { MessageCircle, X } from 'lucide-react'
import { authenticatedApiFetch } from '@/lib/authenticated-fetch'
import { getApiUrl } from '@/config/api'

type Screenshot = { name: string; content_type: string; data: string }

const inputClassName = 'mt-1.5 w-full rounded-lg border border-[#cfc9d2] bg-white px-3 py-2.5 text-sm text-[#25202d] placeholder:text-[#817b87] outline-none focus:border-[#2e2877] focus:ring-2 focus:ring-[#2e2877]/15'

export function FeedbackDialog() {
  const descriptionId = useId()
  const attemptedId = useId()
  const severityId = useId()
  const screenshotId = useId()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<'bug' | 'feature'>('bug')
  const [description, setDescription] = useState('')
  const [attempted, setAttempted] = useState('')
  const [severity, setSeverity] = useState('major')
  const [screenshot, setScreenshot] = useState<Screenshot | null>(null)
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function pick(file?: File) {
    if (!file) return
    if (file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setState('error')
      return
    }
    const bytes = new Uint8Array(await file.arrayBuffer())
    let binary = ''
    bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
    setScreenshot({ name: file.name, content_type: file.type, data: btoa(binary) })
    setState('idle')
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setState('sending')
    try {
      const response = await authenticatedApiFetch(`${getApiUrl()}/feedback`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, description, attempted_action: attempted, severity: kind === 'bug' ? severity : undefined, page_url: window.location.href, sentry_event_id: Sentry.lastEventId() || undefined, screenshot }),
      })
      if (!response.ok) throw new Error('Feedback submission failed')
      setState('sent')
      setDescription('')
      setAttempted('')
      setScreenshot(null)
    } catch {
      setState('error')
    }
  }

  return <>
    <button type="button" onClick={() => { setOpen(true); setState('idle') }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/72 hover:bg-white/8 hover:text-white"><MessageCircle size={18} /> Report a problem</button>
    {open && <div className="fixed inset-0 z-[100] grid place-items-center bg-[#17132e]/60 p-4">
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white p-5 text-[#25202d] shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-[#25202d]">Help improve Kanvise</h2><p className="mt-1 text-sm leading-5 text-[#625d69]">Tell us what happened or what you would like us to build.</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-lg p-1.5 text-[#625d69] hover:bg-[#f3f0f5]"><X size={20} /></button></div>
        <div className="mt-5 flex gap-2 rounded-xl bg-[#f5f2f7] p-1"><button type="button" onClick={() => setKind('bug')} className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${kind === 'bug' ? 'bg-[#2e2877] text-white shadow-sm' : 'text-[#514c58] hover:bg-white'}`}>Report a problem</button><button type="button" onClick={() => setKind('feature')} className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${kind === 'feature' ? 'bg-[#2e2877] text-white shadow-sm' : 'text-[#514c58] hover:bg-white'}`}>Suggest a feature</button></div>
        <div className="mt-5 space-y-4">
          {kind === 'bug' && <label htmlFor={severityId} className="block text-sm font-semibold text-[#3d3843]">How serious is it?<select id={severityId} value={severity} onChange={(event) => setSeverity(event.target.value)} className={inputClassName}><option value="blocking">Blocking me</option><option value="major">Major</option><option value="minor">Minor</option></select></label>}
          <label htmlFor={descriptionId} className="block text-sm font-semibold text-[#3d3843]">{kind === 'bug' ? 'What happened?' : 'What would make Kanvise better?'}<textarea id={descriptionId} required value={description} onChange={(event) => setDescription(event.target.value)} maxLength={4000} className={`${inputClassName} min-h-28`} placeholder={kind === 'bug' ? 'Describe the problem as clearly as you can.' : 'Tell us what would help you.'} /></label>
          {kind === 'bug' && <label htmlFor={attemptedId} className="block text-sm font-semibold text-[#3d3843]">What were you trying to do? <span className="font-normal text-[#716c76]">(optional)</span><textarea id={attemptedId} value={attempted} onChange={(event) => setAttempted(event.target.value)} maxLength={2000} className={`${inputClassName} min-h-20`} placeholder="For example, I was trying to join a live class." /></label>}
          <label htmlFor={screenshotId} className="block text-sm font-semibold text-[#3d3843]">Screenshot <span className="font-normal text-[#716c76]">(optional, PNG, JPG or WebP; up to 5 MB)</span><input id={screenshotId} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void pick(event.target.files?.[0])} className="mt-1.5 block w-full rounded-lg border border-[#cfc9d2] bg-white px-3 py-2 text-sm text-[#514c58] file:mr-3 file:rounded-md file:border-0 file:bg-[#eeeafb] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[#2e2877]" /></label>
        </div>
        {screenshot && <p className="mt-2 text-xs text-[#514c58]">Attached: {screenshot.name}</p>}
        {state === 'sent' && <p role="status" className="mt-4 rounded-lg bg-[#e8f5ea] px-3 py-2 text-sm text-[#176b35]">Received. We have sent you a confirmation email.</p>}
        {state === 'error' && <p role="alert" className="mt-4 rounded-lg bg-[#fff0ef] px-3 py-2 text-sm text-[#a6241d]">We could not send that report. Please try again.</p>}
        <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-[#514c58] hover:bg-[#f3f0f5]">Cancel</button><button disabled={state === 'sending'} className="rounded-lg bg-[#2e2877] px-4 py-2 text-sm font-semibold text-white hover:bg-[#211c60] disabled:cursor-not-allowed disabled:opacity-60">{state === 'sending' ? 'Sending…' : 'Send report'}</button></div>
      </form>
    </div>}
  </>
}
