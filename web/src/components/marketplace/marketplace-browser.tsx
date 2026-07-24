'use client'

import Link from 'next/link'
import { Clock3, FileQuestion, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { MarketplaceListing } from '@/lib/marketplace'

function price(listing: MarketplaceListing) {
  return listing.pricing_type === 'free' ? 'Free' : new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(listing.price_kobo / 100)
}

export function MarketplaceBrowser({ listings }: { listings: MarketplaceListing[] }) {
  const [query, setQuery] = useState('')
  const [pricing, setPricing] = useState<'all' | 'free' | 'paid'>('all')
  const visible = useMemo(() => listings.filter(listing => {
    const text = `${listing.title} ${listing.examination || ''} ${listing.subjects.join(' ')}`.toLowerCase()
    return (!query.trim() || text.includes(query.trim().toLowerCase())) && (pricing === 'all' || listing.pricing_type === pricing)
  }), [listings, pricing, query])
  return <main className="mx-auto max-w-[1280px] px-4 py-10 pb-24 sm:px-6 lg:px-10">
    <header className="max-w-3xl"><p className="text-sm font-semibold text-[#994704]">Kanvise mock marketplace</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#29262f] sm:text-4xl">Practise with mocks from trusted tutors</h1><p className="mt-3 text-sm leading-6 text-[#716c76] sm:text-base">Find a mock that fits what you are preparing for. See the time, number of questions, calculator rules, and attempts before you claim or buy it.</p></header>
    <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center"><label className="relative block flex-1"><Search size={18} className="absolute left-3 top-3 text-[#8b858f]" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search JAMB, WAEC, Physics…" className="w-full rounded-xl border border-[#ddd7d2] bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#2e2877]" /></label><div className="flex rounded-xl bg-[#eeeae6] p-1">{(['all', 'free', 'paid'] as const).map(value => <button key={value} onClick={() => setPricing(value)} className={`rounded-lg px-4 py-2 text-sm font-medium ${pricing === value ? 'bg-white text-[#2e2877] shadow-sm' : 'text-[#716c76]'}`}>{value === 'all' ? 'All mocks' : value === 'free' ? 'Free' : 'Paid'}</button>)}</div></div>
    {visible.length ? <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map(listing => <article key={listing.id} className="flex min-h-72 flex-col rounded-2xl border border-[#e4dfda] bg-white p-5 shadow-[0_1px_2px_rgba(35,31,38,0.04)]"><div className="flex items-center justify-between gap-3"><span className="rounded-full bg-[#f0edff] px-3 py-1 text-[11px] font-semibold text-[#2e2877]">{listing.examination || listing.subjects[0] || 'Practice mock'}</span><span className={`text-sm font-semibold ${listing.pricing_type === 'free' ? 'text-[#29724b]' : 'text-[#29262f]'}`}>{price(listing)}</span></div><h2 className="mt-4 text-lg font-semibold leading-6 text-[#29262f]">{listing.title}</h2><p className="mt-2 line-clamp-3 text-sm leading-6 text-[#716c76]">{listing.short_description || 'A timed practice mock from a Kanvise tutor.'}</p><div className="mt-5 grid grid-cols-2 gap-3 text-xs text-[#716c76]"><span className="flex items-center gap-1.5"><FileQuestion size={14}/>{listing.question_count} questions</span><span className="flex items-center gap-1.5"><Clock3 size={14}/>{listing.duration_minutes ? `${listing.duration_minutes} mins` : 'Untimed'}</span></div><p className="mt-4 text-xs text-[#716c76]">By {listing.creator_school?.name || 'a Kanvise tutor'}</p><Link href={`/mocks/${listing.slug}`} className="mt-auto inline-flex min-h-11 items-center justify-center rounded-xl bg-[#2e2877] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#211b68]">View mock</Link></article>)}</section> : <section className="mt-7 rounded-2xl border border-[#e5e1dd] bg-white px-5 py-14 text-center"><h2 className="text-lg font-semibold">No mocks match that search</h2><p className="mt-2 text-sm text-[#716c76]">Try a subject name or clear the filter.</p></section>}
  </main>
}
