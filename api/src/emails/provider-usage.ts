import { supabase } from '../lib/supabase'
import type { EmailProviderName } from './config'

export type ProviderCapacity = {
  allowed: boolean
  reason: 'reserved' | 'threshold' | 'cooldown' | string
  threshold: number
  used: number
}

export type EmailProviderUsageStore = {
  reserve(input: {
    dailyLimit: number
    provider: EmailProviderName
    recipientCount: number
    thresholdPercent: number
  }): Promise<ProviderCapacity>
  record(input: {
    cooldownUntil?: Date
    error?: string
    provider: EmailProviderName
    quotaFailure: boolean
    recipientCount: number
    succeeded: boolean
  }): Promise<void>
}

export const supabaseEmailProviderUsageStore: EmailProviderUsageStore = {
  async reserve(input) {
    const { data, error } = await (supabase as any).rpc('reserve_email_provider_capacity', {
      p_provider: input.provider,
      p_daily_limit: input.dailyLimit,
      p_threshold_percent: input.thresholdPercent,
      p_recipient_count: input.recipientCount,
    })
    if (error) throw error
    return data as ProviderCapacity
  },
  async record(input) {
    const { error } = await (supabase as any).rpc('record_email_provider_result', {
      p_provider: input.provider,
      p_recipient_count: input.recipientCount,
      p_succeeded: input.succeeded,
      p_quota_failure: input.quotaFailure,
      p_cooldown_until: input.cooldownUntil?.toISOString() || null,
      p_error: input.error?.slice(0, 500) || null,
    })
    if (error) throw error
  },
}
