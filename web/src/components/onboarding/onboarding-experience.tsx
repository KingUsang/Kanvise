'use client'

import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { buildOnboardingPayload, DEFAULTS_PAYLOAD, type OnboardingAnswers } from '@/lib/onboarding-script'
import { onboardingQueryKeys, saveOnboarding } from '@/lib/onboarding-api'
import { OnboardingChat } from './onboarding-chat'
import { OnboardingForm } from './onboarding-form'

export const SETUP_PATH = '/dashboard/setup'

type Save = 'idle' | 'saving' | 'failed'

/**
 * ONB-01 to ONB-11: the full-page onboarding with no sidebar. Saves the
 * answers and opens /setup straight away (ONB-08). Skip setup applies the
 * ONB-09 defaults.
 */
export function OnboardingExperience({ firstName }: { firstName: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'chat' | 'form'>('chat')
  const [save, setSave] = useState<Save>('idle')
  const lastPayload = useRef<Record<string, unknown>>({})

  async function persist(payload: Record<string, unknown>) {
    lastPayload.current = payload
    setSave('saving')
    try {
      await saveOnboarding(payload)
      await queryClient.invalidateQueries({ queryKey: onboardingQueryKeys.state })
      await queryClient.invalidateQueries({ queryKey: onboardingQueryKeys.setup })
      router.replace(SETUP_PATH)
    } catch {
      setSave('failed')
    }
  }

  const submit = (answers: OnboardingAnswers) => void persist(buildOnboardingPayload(answers))
  const useDefaults = () => void persist({ ...DEFAULTS_PAYLOAD })

  return (
    <div className="min-h-dvh bg-dashboard-page">
      <header className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <span className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand mark */}
          <img src="/kanvise_logo.jpeg" alt="" className="size-7 rounded-md object-cover" />
          <span className="text-lg font-bold tracking-tight text-dashboard-primary">Kanvise</span>
        </span>
        <button type="button" disabled={save === 'saving'} onClick={useDefaults} className="inline-flex min-h-11 items-center text-sm font-medium text-dashboard-muted underline underline-offset-2 hover:text-dashboard-foreground disabled:opacity-60">
          Skip setup
        </button>
      </header>
      <main id="main-content" className="mx-auto w-full max-w-[560px] px-4 pb-16 pt-6">
        {mode === 'chat' ? (
          <OnboardingChat
              firstName={firstName}
              saving={save === 'saving'}
              saveError={save === 'failed'}
              onSubmit={submit}
              onRetry={() => void persist(lastPayload.current)}
              onUseDefaults={useDefaults}
              onUseForm={() => setMode('form')}
            />
        ) : (
          <OnboardingForm saving={save === 'saving'} saveError={save === 'failed'} onSubmit={submit} onUseDefaults={useDefaults} />
        )}
      </main>
    </div>
  )
}
