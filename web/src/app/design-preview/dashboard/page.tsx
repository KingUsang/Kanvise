import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DashboardPreview } from './dashboard-preview'

export const metadata: Metadata = {
  title: 'Dashboard preview | Kanvise',
  robots: { index: false, follow: false },
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

/**
 * Dev-only preview of the dashboard (03) with sample data, for screenshots
 * without a network. A 404 unless NEXT_PUBLIC_ENABLE_DESIGN_PREVIEW=1.
 *
 * Query: role=independent|tutor|admin, data=populated|empty|quiet-today|loading,
 * setup=1 (shows the sidebar setup card), mine=1 (admin, Mine only on).
 */
export default async function DashboardPreviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NEXT_PUBLIC_ENABLE_DESIGN_PREVIEW !== '1') notFound()
  const params = await searchParams
  const role = one(params.role) === 'tutor' ? 'tutor' : one(params.role) === 'independent' ? 'independent' : 'admin'
  const data = one(params.data)
  return (
    <DashboardPreview
      role={role}
      data={data === 'empty' || data === 'quiet-today' || data === 'loading' ? data : 'populated'}
      setup={one(params.setup) === '1'}
      mine={one(params.mine) === '1'}
    />
  )
}
