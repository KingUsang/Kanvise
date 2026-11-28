'use client'

import { useSyncExternalStore } from 'react'
import { OnboardingExperience } from '@/components/onboarding/onboarding-experience'
import { OnboardingSkeleton } from '@/components/onboarding/onboarding-skeleton'

const noSubscribe = () => () => undefined

export function OnboardingPreview() {
  // In the app the chat renders only in the browser, after the onboarding state
  // loads (OnboardingGate). Kavi reads the reduced-motion setting on first
  // render, so the preview renders on the client only as well.
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false)
  if (!mounted) return <OnboardingSkeleton />
  return <OnboardingExperience firstName="Chidi" />
}
