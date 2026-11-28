import { useQuery } from '@tanstack/react-query'
import { getApiUrl } from '@/config/api'
import { authenticatedApiFetch } from '@/lib/authenticated-fetch'
import type { SetupAccountType, SetupFacts, SetupState } from '@/lib/setup-checklist'

export const onboardingQueryKeys = {
  state: ['onboarding-state'] as const,
  setup: ['onboarding-setup'] as const,
}

export type OnboardingSavedAnswers = {
  teaching_mode: 'solo' | 'team'
  audience: 'children_teens' | 'adults' | 'both'
  class_format: 'one_to_one' | 'small_groups' | 'both'
  subjects: string[]
  has_students: boolean
  used_defaults: boolean
  skipped_steps: string[]
}

export type OnboardingState = {
  isOwner: boolean
  accountType: SetupAccountType
  needsOnboarding: boolean
  answers: OnboardingSavedAnswers | null
  lessonMinutes: number | null
}

async function readJson(response: Response) {
  return response.json().catch(() => null)
}

export async function fetchOnboardingState(): Promise<OnboardingState> {
  const response = await authenticatedApiFetch(`${getApiUrl()}/onboarding`)
  const body = await readJson(response)
  if (!response.ok || !body?.data) throw new Error('Could not load your setup')
  const data = body.data
  return {
    isOwner: data.is_owner === true,
    accountType: data.account_type === 'independent' ? 'independent' : 'centre',
    needsOnboarding: data.needs_onboarding === true,
    answers: data.answers ?? null,
    lessonMinutes: typeof data.defaults?.lesson_minutes === 'number' ? data.defaults.lesson_minutes : null,
  }
}

/** ONB-08. Throws when the answers could not be saved. */
export async function saveOnboarding(payload: Record<string, unknown>): Promise<{ usedDefaults: boolean }> {
  const response = await authenticatedApiFetch(`${getApiUrl()}/onboarding`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await readJson(response)
  if (!response.ok) throw new Error(typeof body?.error === 'string' ? body.error : 'Could not save your answers')
  // The answers are saved but the agency rename failed. Throwing lets the owner retry; saving again is safe.
  if (body?.data?.name_saved === false) throw new Error("We couldn't save your agency name. Try again.")
  return { usedDefaults: body?.data?.used_defaults === true }
}

function toFact(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export async function fetchSetupState(): Promise<SetupState> {
  const response = await authenticatedApiFetch(`${getApiUrl()}/onboarding/setup`)
  const body = await readJson(response)
  if (!response.ok || !body?.data) throw new Error('Could not load your setup')
  const data = body.data
  if (data.eligible !== true) return { eligible: false }
  const facts: SetupFacts = {
    students: toFact(data.facts?.students),
    courses: toFact(data.facts?.courses),
    lessons: toFact(data.facts?.lessons),
    tutors: toFact(data.facts?.tutors),
  }
  return {
    eligible: true,
    accountType: data.account_type === 'independent' ? 'independent' : 'centre',
    skippedSteps: Array.isArray(data.skipped_steps) ? data.skipped_steps.filter((step: unknown): step is string => typeof step === 'string') : [],
    hasStudentsAnswer: data.has_students_answer === true,
    facts,
  }
}

export async function setStepSkipped(step: 'course_plan', skipped: boolean) {
  const response = await authenticatedApiFetch(`${getApiUrl()}/onboarding/setup/skip`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ step, skipped }),
  })
  if (!response.ok) throw new Error('Could not update this step')
}

/** The setup facts, shared by the /setup page and the sidebar card. */
export function useSetupState(enabled = true) {
  return useQuery({
    queryKey: onboardingQueryKeys.setup,
    queryFn: fetchSetupState,
    enabled,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useOnboardingState(enabled = true) {
  return useQuery({
    queryKey: onboardingQueryKeys.state,
    queryFn: fetchOnboardingState,
    enabled,
    staleTime: 60_000,
    retry: 1,
  })
}
