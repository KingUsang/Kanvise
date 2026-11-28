import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ShellPreview, type PreviewOptions } from './shell-preview'

export const metadata: Metadata = {
  title: 'Shell preview | Kanvise',
  robots: { index: false, follow: false },
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

/**
 * Dev-only preview of the app shell with sample data (00-decisions section
 * 13), for screenshots without a network. A 404 unless
 * NEXT_PUBLIC_ENABLE_DESIGN_PREVIEW=1. It is outside /dashboard, so the auth
 * proxy never redirects it.
 *
 * Query: role=admin|tutor|independent, open=more|help|account-menu|switcher|
 * whats-new|feedback|sign-out-confirm|phone-menu, page=not-available|admin-only|
 * error|loading, rail=1, path=/dashboard/..., long=1, badge=<n>|failed, read=1, pending=<n>,
 * search=empty|results|no-results|error|offline|loading (opens the search palette, SH-05).
 */
export default async function ShellPreviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NEXT_PUBLIC_ENABLE_DESIGN_PREVIEW !== '1') notFound()
  const params = await searchParams
  const options: PreviewOptions = {
    role: one(params.role) === 'tutor' ? 'tutor' : one(params.role) === 'independent' ? 'independent' : 'admin',
    open: one(params.open),
    page: one(params.page),
    rail: one(params.rail) === '1',
    path: one(params.path),
    long: one(params.long) === '1',
    badge: one(params.badge),
    read: one(params.read) === '1',
    pending: Number(one(params.pending)) || 0,
    search: one(params.search),
    signedOut: one(params.open) === 'signed-out',
  }
  return <ShellPreview options={options} />
}
