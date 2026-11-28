import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SetupPreview } from './setup-preview'

export const metadata: Metadata = {
  title: 'Setup preview | Kanvise',
  robots: { index: false, follow: false },
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

/**
 * Dev-only preview of /dashboard/setup (02 SET-01 to SET-03) with sample data.
 * A 404 unless NEXT_PUBLIC_ENABLE_DESIGN_PREVIEW=1. The preview raises the
 * shipped step so every row shows; the real SETUP_SHIPPED_STEP is not changed.
 *
 * Query: role=independent|admin, state=fresh|some|done|skipped, banner=1
 * (the "We used the default settings" notice), loading=1 (the loading state).
 */
export default async function SetupPreviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NEXT_PUBLIC_ENABLE_DESIGN_PREVIEW !== '1') notFound()
  const params = await searchParams
  const state = one(params.state)
  return (
    <SetupPreview
      role={one(params.role) === 'independent' ? 'independent' : 'admin'}
      state={state === 'some' || state === 'done' || state === 'skipped' ? state : 'fresh'}
      banner={one(params.banner) === '1'}
      loading={one(params.loading) === '1'}
    />
  )
}
