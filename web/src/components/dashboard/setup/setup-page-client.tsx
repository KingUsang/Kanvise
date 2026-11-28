'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { PageLoadingState } from '@/components/dashboard/async-states'
import { QueryErrorState } from '@/components/common/query-error-state'
import { onboardingQueryKeys, setStepSkipped, useOnboardingState, useSetupState } from '@/lib/onboarding-api'
import { useActiveAccountId } from '@/lib/account-preference'
import { useDashboardSession } from '@/lib/dashboard-session'
import { buildSetupChecklist, type SetupStepId } from '@/lib/setup-checklist'
import { SetupView } from './setup-view'

const helpUrl = process.env.NEXT_PUBLIC_HELP_URL || undefined

function storageFlag(key: string) {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}
function setStorageFlag(key: string) {
  try {
    window.localStorage.setItem(key, '1')
  } catch {
    // Private mode: the banner or celebration may show once more.
  }
}

/**
 * SET-01 to SET-03. Redirects to the dashboard when there is no checklist to
 * show: not the account owner, no rows shipped yet, or everything done and the
 * "all set" screen already seen.
 */
export function SetupPageClient() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const accountId = useActiveAccountId()
  const session = useDashboardSession()
  const setup = useSetupState()
  const onboarding = useOnboardingState()
  const [busyStep, setBusyStep] = useState<SetupStepId | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const doneKey = `kanvise:setup-done-seen:${accountId ?? 'account'}`
  const bannerKey = `kanvise:setup-defaults-banner:${accountId ?? 'account'}`

  // Read once the setup facts have loaded, which only happens in the browser.
  const doneSeen = setup.isSuccess && storageFlag(doneKey)
  const bannerHidden = bannerDismissed || (setup.isSuccess && storageFlag(bannerKey))

  const state = setup.data
  const checklist = state?.eligible
    ? buildSetupChecklist({ accountType: state.accountType, facts: state.facts, skippedSteps: state.skippedSteps })
    : null
  const nothingToShow = setup.isSuccess && (!checklist || checklist.total === 0 || (checklist.allDone && doneSeen))

  useEffect(() => {
    if (nothingToShow) router.replace('/dashboard')
  }, [nothingToShow, router])

  if (setup.isError) {
    return <QueryErrorState error={setup.error} onRetry={() => void setup.refetch()} retrying={setup.isFetching} fallback="We couldn't load your setup." />
  }
  if (!setup.isSuccess || nothingToShow || !checklist) return <PageLoadingState label="Loading your setup" />

  async function toggleSkip(id: SetupStepId, skipped: boolean) {
    if (id !== 'course_plan') return
    setBusyStep(id)
    setActionError(null)
    try {
      await setStepSkipped(id, skipped)
      await queryClient.invalidateQueries({ queryKey: onboardingQueryKeys.setup })
    } catch {
      setActionError("We couldn't update this step. Try again.")
    } finally {
      setBusyStep(null)
    }
  }

  return (
    <>
      {actionError ? <p role="alert" className="mb-4 text-sm text-dashboard-danger">{actionError}</p> : null}
    <SetupView
      firstName={session.data?.user.first_name ?? ''}
      checklist={checklist}
      helpUrl={helpUrl}
      showDefaultsBanner={Boolean(onboarding.data?.answers?.used_defaults) && !bannerHidden}
      onDismissBanner={() => {
        setStorageFlag(bannerKey)
        setBannerDismissed(true)
      }}
      onToggleSkip={(id, skipped) => void toggleSkip(id, skipped)}
      busyStep={busyStep}
      onFinish={() => {
        // The "all set" screen shows once; after this /setup goes to the dashboard (SET-03).
        setStorageFlag(doneKey)
        router.replace('/dashboard')
      }}
    />
    </>
  )
}
