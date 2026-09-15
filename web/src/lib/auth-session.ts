'use client'

import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

type SessionState = { session: Session | null; ready: Promise<void> }

const states = new WeakMap<SupabaseClient, SessionState>()

function stateFor(supabase: SupabaseClient): SessionState {
  const existing = states.get(supabase)
  if (existing) return existing

  let resolveReady!: () => void
  const ready = new Promise<void>((resolve) => { resolveReady = resolve })
  const state: SessionState = { session: null, ready }
  states.set(supabase, state)

  if (typeof supabase.auth.getSession === 'function') {
    void supabase.auth.getSession().then(({ data }) => {
      state.session = data.session
      resolveReady()
    }, resolveReady)
  } else {
    resolveReady()
  }
  if (typeof supabase.auth.onAuthStateChange === 'function') {
    supabase.auth.onAuthStateChange((_event, nextSession) => {
      state.session = nextSession
    })
  }
  return state
}

export function getBrowserAuthClient() {
  return createClient()
}

export async function getCurrentAccessToken(supabase: SupabaseClient) {
  const state = stateFor(supabase)
  await state.ready
  return state.session?.access_token ?? null
}

export async function refreshAccessToken(supabase: SupabaseClient) {
  const state = stateFor(supabase)
  const { data, error } = await supabase.auth.refreshSession()
  if (error || !data.session) {
    state.session = null
    return null
  }
  state.session = data.session
  return data.session.access_token
}
