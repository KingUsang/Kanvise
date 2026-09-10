'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Copy, ExternalLink, Link2, Loader2, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { getBrowserAppUrl } from '@/config/app'
import { getApiUrl } from '@/config/api'

type MockOffer = {
  id: string
  slug: string
  access_mode: string
  price_kobo: number
  is_active: boolean
}

type MockVersion = {
  id: string
  version_number: number
  total_questions: number
}

type OffersResponse = {
  data: MockOffer[]
  versions: MockVersion[]
}

export function nextOfferSlug(offers: MockOffer[], mockId: string) {
  const used = new Set(offers.map((offer) => offer.slug))
  const seed = offers.at(-1)?.slug.replace(/-\d+$/, '') || `mock-${mockId.slice(0, 8)}`
  if (!used.has(seed)) return seed
  let suffix = 2
  while (used.has(`${seed}-${suffix}`)) suffix += 1
  return `${seed}-${suffix}`
}

export function MockOffersManager({ mockId, token }: { mockId: string; token: string }) {
  const [data, setData] = useState<OffersResponse>({ data: [], versions: [] })
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [slug, setSlug] = useState('')
  const [mode, setMode] = useState('free_claim')
  const [price, setPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const [copiedOfferId, setCopiedOfferId] = useState<string | null>(null)
  const appUrl = useMemo(() => getBrowserAppUrl(), [])

  async function load() {
    const response = await fetch(`${getApiUrl()}/mocks/${mockId}/offers`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await response.json().catch(() => null)
    if (!response.ok) throw new Error(body?.error || 'Could not load share links')
    setData({ data: body?.data || [], versions: body?.versions || [] })
    return body as OffersResponse
  }

  useEffect(() => {
    void load()
      .then((body) => {
        if (!(body?.data || []).length) {
          setSlug(nextOfferSlug([], mockId))
          setShowCreate(true)
        }
      })
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false))
  }, [])

  function openCreateForm() {
    setSlug(nextOfferSlug(data.data, mockId))
    setMode('free_claim')
    setPrice('')
    setShowCreate(true)
  }

  async function copyOffer(offer: MockOffer) {
    const url = `${appUrl}/mock/${offer.slug}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedOfferId(offer.id)
      toast.success('Link copied')
      window.setTimeout(() => setCopiedOfferId((current) => current === offer.id ? null : current), 2500)
    } catch {
      toast.error('Could not copy the link', { description: 'Press and hold the link to copy it.' })
    }
  }

  async function create(event: React.FormEvent) {
    event.preventDefault()
    const version = data.versions[0]
    if (!version) {
      toast.error('Publish this mock before creating a share link')
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`${getApiUrl()}/mocks/${mockId}/offers`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mock_exam_version_id: version.id,
          slug,
          audience_scope: 'public_link',
          access_mode: mode,
          price_kobo: mode === 'paid' ? Math.round(Number(price) * 100) : 0,
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || 'Could not create share link')
      toast.success('Another mock link is ready')
      await load()
      setShowCreate(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create share link')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 pb-24 sm:px-6 sm:py-8">
      <Link href="/dashboard/mocks" className="inline-flex min-h-10 items-center text-sm font-semibold text-[#2e2877]">← Back to mocks</Link>

      <header className="mt-3">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#994704]">Share mock</p>
        <h1 className="mt-1 text-2xl font-semibold text-[#1b1c1c] sm:text-3xl">{loading || data.data.length ? 'Your mock links' : 'Create a share link'}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#716c76]">Anyone you send an active link to can open the mock. They do not have to join your centre.</p>
      </header>

      {loading ? (
        <div className="mt-7 flex min-h-28 items-center justify-center rounded-2xl border border-[#e3ded9] bg-white text-sm text-[#716c76]" role="status">
          <Loader2 className="mr-2 animate-spin" size={18} /> Loading your link…
        </div>
      ) : (
        <section aria-label="Mock share links" className="mt-7 space-y-3">
          {data.data.map((offer, index) => {
            const url = `${appUrl}/mock/${offer.slug}`
            return (
              <article key={offer.id} className="rounded-2xl border border-[#e3ded9] bg-white p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#1b1c1c]">{index === 0 ? 'Latest link' : `Link ${data.data.length - index}`}</p>
                    <p className="mt-1 text-xs text-[#716c76]">
                      {offer.access_mode === 'paid' ? `Paid · ₦${(offer.price_kobo / 100).toLocaleString()}` : 'Free'} · {offer.is_active ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${offer.is_active ? 'bg-[#e8f5ec] text-[#196b37]' : 'bg-[#f1efed] text-[#716c76]'}`}>{offer.is_active ? 'Ready to share' : 'Turned off'}</span>
                </div>

                <div className="mt-4 flex min-w-0 items-center gap-2 rounded-xl bg-[#f7f5f3] p-3">
                  <Link2 className="shrink-0 text-[#716c76]" size={17} />
                  <a href={url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm font-medium text-[#2e2877] underline underline-offset-2">{url}</a>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => void copyOffer(offer)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#2e2877] px-4 text-sm font-semibold text-white">
                    <Copy size={16} />{copiedOfferId === offer.id ? 'Copied' : 'Copy link'}
                  </button>
                  <a href={url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#cfc9c4] px-4 text-sm font-semibold text-[#2e2877]">
                    <ExternalLink size={16} />Open
                  </a>
                </div>
              </article>
            )
          })}
        </section>
      )}

      {!loading && !showCreate && (
        <button type="button" onClick={openCreateForm} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#cfc9c4] bg-white px-4 text-sm font-semibold text-[#2e2877] sm:w-auto">
          <Plus size={17} />Create another link
        </button>
      )}

      {!loading && showCreate && (
        <form onSubmit={create} className="mt-6 rounded-2xl border border-[#e3ded9] bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-[#1b1c1c]">{data.data.length ? 'Create another link' : 'Link settings'}</h2>
              <p className="mt-1 text-xs leading-5 text-[#716c76]">The suggested address is ready to use. Change it only if you need a different ending.</p>
            </div>
            {!!data.data.length && <button type="button" onClick={() => setShowCreate(false)} aria-label="Close link form" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#716c76] hover:bg-[#f7f5f3]"><X size={18} /></button>}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label htmlFor="offer-slug" className="text-sm font-medium text-[#1b1c1c]">
              Link ending
              <input id="offer-slug" required value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} className="mt-1.5 w-full rounded-lg border border-[#d8d2cc] px-3 py-3" />
            </label>
            <label htmlFor="offer-access" className="text-sm font-medium text-[#1b1c1c]">
              Student access
              <select id="offer-access" value={mode} onChange={(event) => setMode(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#d8d2cc] bg-white px-3 py-3">
                <option value="free_claim">Free</option>
                <option value="paid">Paid</option>
              </select>
            </label>
            {mode === 'paid' && (
              <label htmlFor="offer-price" className="text-sm font-medium text-[#1b1c1c]">
                Price (₦)
                <input id="offer-price" required min="1" inputMode="decimal" type="number" value={price} onChange={(event) => setPrice(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#d8d2cc] px-3 py-3" />
              </label>
            )}
          </div>
          <button disabled={saving || !slug} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#994704] px-4 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto">
            {saving && <Loader2 className="animate-spin" size={17} />}{saving ? 'Creating…' : 'Create link'}
          </button>
        </form>
      )}
    </main>
  )
}
