import { Calculator, Clock3, FileQuestion } from 'lucide-react'
import { MockOfferActions } from '@/components/mock-access/mock-offer-actions'
import { getApiUrl } from '@/config/api'

export const dynamic = 'force-dynamic'

async function getOffer(slug: string) {
  const response = await fetch(`${getApiUrl()}/mock/${encodeURIComponent(slug)}`, { cache: 'no-store' })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error || 'Mock not found')
  return body.data
}

export default async function MockOfferPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const offer = await getOffer(slug); const mock = offer.mock
  const price = offer.access_mode === 'paid' ? new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(offer.price_kobo / 100) : 'Free'
  return <main className="mx-auto max-w-5xl px-4 py-10 pb-24 sm:px-6 lg:py-14"><section className="overflow-hidden rounded-3xl border border-[#e3ded9] bg-white"><header className="bg-[#2e2877] px-6 py-8 text-white sm:px-10 sm:py-11"><p className="text-sm text-white/70">Practice mock</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{mock.title}</h1>{mock.description && <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">{mock.description}</p>}</header><div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_300px]"><div><h2 className="text-xl font-semibold">Ready when you are</h2><p className="mt-3 text-sm leading-7 text-[#5f5964]">Sign in, unlock this mock, and start immediately. Buying or attempting it never changes your programme enrolment or centre memberships.</p></div><aside className="rounded-2xl bg-[#f7f4f1] p-5"><p className={`text-2xl font-semibold ${offer.access_mode === 'paid' ? 'text-[#29262f]' : 'text-[#29724b]'}`}>{price}</p><dl className="mt-5 space-y-4 text-sm"><div className="flex justify-between gap-3"><dt className="flex items-center gap-2 text-[#716c76]"><FileQuestion size={16}/>Questions</dt><dd className="font-semibold">{offer.version.total_questions}</dd></div><div className="flex justify-between gap-3"><dt className="flex items-center gap-2 text-[#716c76]"><Clock3 size={16}/>Time</dt><dd className="font-semibold">{mock.time_limit_minutes ? `${mock.time_limit_minutes} mins` : 'Untimed'}</dd></div><div className="flex justify-between gap-3"><dt className="flex items-center gap-2 text-[#716c76]"><Calculator size={16}/>Calculator</dt><dd className="font-semibold capitalize">{mock.calculator_mode}</dd></div><div className="flex justify-between gap-3"><dt className="text-[#716c76]">Attempts</dt><dd className="font-semibold">{offer.attempts_included}</dd></div></dl><div className="mt-6"><MockOfferActions offerId={offer.id} slug={offer.slug} accessMode={offer.access_mode} /></div></aside></div></section></main>
}
