import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { DesignSystemCatalog } from './catalog'

export const metadata: Metadata = {
  title: 'Design system | Kanvise',
  robots: { index: false, follow: false },
}

/**
 * Dev-only component catalog (standard 07 "Verification and governance").
 * It is a 404 unless NEXT_PUBLIC_ENABLE_DESIGN_PREVIEW=1 at build time, so
 * staging and production never expose it.
 */
export default function DesignSystemPage() {
  if (process.env.NEXT_PUBLIC_ENABLE_DESIGN_PREVIEW !== '1') notFound()
  return (
    <Suspense fallback={null}>
      <DesignSystemCatalog />
    </Suspense>
  )
}
