import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { OnboardingPreview } from './onboarding-preview'

export const metadata: Metadata = {
  title: 'Onboarding preview | Kanvise',
  robots: { index: false, follow: false },
}

/**
 * Dev-only preview of the Kavi onboarding chat (02 ONB-01 to ONB-11). A 404
 * unless NEXT_PUBLIC_ENABLE_DESIGN_PREVIEW=1. Saving has no API behind it, so
 * the last answer shows the "could not save" state (ONB-08), which is the
 * state worth reviewing. The screenshot script drives the chat by clicking.
 */
export default function OnboardingPreviewPage() {
  if (process.env.NEXT_PUBLIC_ENABLE_DESIGN_PREVIEW !== '1') notFound()
  return <OnboardingPreview />
}
