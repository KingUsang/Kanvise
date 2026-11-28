'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useOnboardingState } from '@/lib/onboarding-api'
import { OnboardingExperience } from './onboarding-experience'
import { OnboardingSkeleton } from './onboarding-skeleton'

/**
 * Shows onboarding only to the person who created the account and has not
 * answered yet (02 Permissions). Everyone else goes to the dashboard.
 */
export function OnboardingGate({ firstName }: { firstName: string }) {
  const router = useRouter()
  const query = useOnboardingState()
  const leave = query.isSuccess && !query.data.needsOnboarding

  useEffect(() => {
    if (leave) router.replace('/dashboard')
  }, [leave, router])

  if (query.isError) {
    return (
      <div className="mx-auto max-w-[560px] space-y-4 px-4 py-16 text-center">
        <p role="alert" className="text-dashboard-foreground">We couldn&apos;t load this page. Try again.</p>
        <Button onClick={() => void query.refetch()}>Try again</Button>
      </div>
    )
  }
  if (!query.isSuccess || leave) return <OnboardingSkeleton />
  return <OnboardingExperience firstName={firstName} />
}
