import type { Metadata } from 'next'
import { UnsubscribeView, type UnsubscribePreview } from './unsubscribe-view'

export const metadata: Metadata = {
  title: 'Email settings | Kanvise',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

const previewStates: UnsubscribePreview[] = ['loading', 'confirm', 'busy', 'success', 'undone', 'expired', 'error']

/**
 * The page an email's Unsubscribe link opens (18 NTF-04, NTF-08). Public: it
 * works without signing in. It never changes anything on load, because mail
 * scanners open links; the person presses Unsubscribe first.
 *
 * With NEXT_PUBLIC_ENABLE_DESIGN_PREVIEW=1, ?preview=<state> shows a fixture
 * state without calling the API (for screenshots), and ?label= changes the
 * row label.
 */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
  const requested = one(params.preview)
  const preview = process.env.NEXT_PUBLIC_ENABLE_DESIGN_PREVIEW === '1' && previewStates.includes(requested as UnsubscribePreview)
    ? requested as UnsubscribePreview
    : undefined
  return <UnsubscribeView preview={preview} previewLabel={preview ? one(params.label) : undefined} />
}
