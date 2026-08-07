'use client'

import { Copy, Loader2, Send } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { getApiUrl } from '@/config/api'

export function TelegramSetupClient({ token }: { token: string }) {
  const [connecting, setConnecting] = useState(false)
  const [code, setCode] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [paid, setPaid] = useState(false)

  async function createCode(purpose: 'teaching' | 'paid_teaching') {
    setConnecting(true)
    try {
      const response = await fetch(`${getApiUrl()}/telegram/connection-codes/group`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ purpose }) })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || 'Could not create a Telegram connection code.')
      setCode(body.data.code); setExpiresAt(body.data.expires_at); setPaid(purpose === 'paid_teaching')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not connect Telegram') }
    finally { setConnecting(false) }
  }

  const command = code ? `${paid ? '/connect-paid' : '/connect'} ${code}` : null
  return <main className="mx-auto max-w-3xl px-4 py-7 pb-24 sm:px-6 lg:px-10 lg:py-10">
    <header><p className="text-sm font-medium text-[#994704]">Teaching companion</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Connect Telegram</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#716c76]">Keep teaching in your Telegram group. Kanvise will send lesson announcements, private student reminders, payment receipts, and optional check-in attendance.</p></header>
    <section className="mt-6 rounded-2xl border border-[#e3ded9] bg-white p-5 sm:p-7"><div className="flex items-start gap-3"><span className="rounded-xl bg-[#f0edff] p-2.5 text-[#2e2877]"><Send size={20} /></span><div><h2 className="font-semibold">Connect a Telegram teaching chat</h2><p className="mt-1 text-sm leading-6 text-[#716c76]">Add the Kanvise bot as an administrator, then use a one-time code. A paid chat admits only students with a linked, paid Kanvise enrolment.</p></div></div>{!command ? <div className="mt-5 flex flex-wrap gap-3"><button disabled={connecting} onClick={() => void createCode('teaching')} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#d9d3cf] px-4 text-sm font-semibold text-[#2e2877] disabled:opacity-50">{connecting ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />}Connect teaching group</button><button disabled={connecting} onClick={() => void createCode('paid_teaching')} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#2e2877] px-4 text-sm font-semibold text-white disabled:opacity-50">{connecting ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />}Connect paid class chat</button></div> : <div className="mt-5 rounded-xl bg-[#faf8f5] p-4"><p className="text-sm font-medium">Send this in the Telegram chat within 15 minutes:</p><div className="mt-3 flex flex-wrap items-center gap-3"><code className="rounded-lg bg-white px-3 py-2 text-sm text-[#2e2877] shadow-sm">{command}</code><button onClick={() => { void navigator.clipboard.writeText(command); toast.success('Connection command copied.') }} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#d9d3cf] px-3 text-sm font-semibold text-[#2e2877]"><Copy size={16} />Copy</button></div><p className="mt-3 text-xs text-[#716c76]">Expires {expiresAt ? new Intl.DateTimeFormat('en-NG', { hour: 'numeric', minute: '2-digit' }).format(new Date(expiresAt)) : 'soon'}.</p></div>}</section>
  </main>
}
