import { Hono } from 'hono'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../lib/database.types'
import { supabase } from '../lib/supabase'

type WaitlistSignup = Pick<Database['public']['Tables']['waitlist_signups']['Row'], 'id' | 'created_at'>
type WaitlistInsert = Pick<Database['public']['Tables']['waitlist_signups']['Insert'],
  'contact_name' | 'contact_email' | 'centre_name' | 'contact_phone' |
  'estimated_student_count' | 'wants_beta_testing' | 'status'>
type StoreError = { code?: string; message?: string } | null

export interface WaitlistStore {
  findByEmail(email: string): Promise<{ data: WaitlistSignup | null; error: StoreError }>
  countThrough(createdAt: string): Promise<{ count: number | null; error: StoreError }>
  insert(signup: WaitlistInsert): Promise<{ data: WaitlistSignup | null; error: StoreError }>
}

export function createSupabaseWaitlistStore(client: SupabaseClient<Database>): WaitlistStore {
  return {
    async findByEmail(email) {
      const { data, error } = await client.from('waitlist_signups').select('id, created_at').ilike('contact_email', email).maybeSingle()
      return { data, error }
    },
    async countThrough(createdAt) {
      const { count, error } = await client.from('waitlist_signups').select('*', { count: 'exact', head: true }).lte('created_at', createdAt)
      return { count, error }
    },
    async insert(signup) {
      const { data, error } = await client.from('waitlist_signups').insert([signup]).select('id, created_at').single()
      return { data, error }
    },
  }
}

function isObjectBody(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function parseStudentCount(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'number') return value
  if (typeof value !== 'string' || value.trim() === '') return Number.NaN
  return Number(value)
}

function duplicateResponse(position: number | null) {
  return { message: "You're already on the list!", position: position || 1, already_joined: true }
}

export function createWaitlistRouter(store: WaitlistStore) {
  const router = new Hono()

  router.post('/waitlist', async (c) => {
    try {
      let rawBody: unknown
      try {
        rawBody = await c.req.json()
      } catch {
        return c.json({ error: 'Invalid JSON payload' }, 400)
      }
      if (!isObjectBody(rawBody)) return c.json({ error: 'Invalid waitlist payload' }, 400)

      const body = rawBody
      const requiredFields = ['contact_name', 'contact_email', 'centre_name'] as const
      if (requiredFields.some((field) => body[field] !== undefined && typeof body[field] !== 'string')) {
        return c.json({ error: 'Invalid waitlist details' }, 400)
      }
      if (body.contact_phone !== undefined && body.contact_phone !== null && typeof body.contact_phone !== 'string') {
        return c.json({ error: 'Invalid waitlist details' }, 400)
      }
      if (body.estimated_student_count !== undefined && body.estimated_student_count !== null
        && typeof body.estimated_student_count !== 'number' && typeof body.estimated_student_count !== 'string') {
        return c.json({ error: 'Invalid estimated student count' }, 400)
      }
      if (body.wants_beta_testing !== undefined && typeof body.wants_beta_testing !== 'boolean') {
        return c.json({ error: 'Invalid waitlist details' }, 400)
      }

      const contactName = typeof body.contact_name === 'string' ? body.contact_name.trim() : ''
      const contactEmail = typeof body.contact_email === 'string' ? body.contact_email.trim().toLowerCase() : ''
      const centreName = typeof body.centre_name === 'string' ? body.centre_name.trim() : ''
      const contactPhone = typeof body.contact_phone === 'string' ? body.contact_phone.trim().slice(0, 40) || null : null
      const parsedStudentCount = parseStudentCount(body.estimated_student_count)
      const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)

      if (!contactEmail || !contactName || !centreName) return c.json({ error: 'Missing required fields' }, 400)
      if (!emailLooksValid || contactEmail.length > 320 || contactName.length > 120 || centreName.length > 160) return c.json({ error: 'Invalid waitlist details' }, 400)
      if (parsedStudentCount !== null && (!Number.isFinite(parsedStudentCount) || parsedStudentCount < 0 || parsedStudentCount > 1_000_000)) return c.json({ error: 'Invalid estimated student count' }, 400)

      const { data: existingUser, error: checkError } = await store.findByEmail(contactEmail)
      if (existingUser) {
        const { count } = await store.countThrough(existingUser.created_at)
        return c.json(duplicateResponse(count), 409)
      }
      if (checkError) {
        console.error('Error checking duplicate:', checkError)
        return c.json({ error: 'Failed to verify email.' }, 500)
      }

      const { data: signup, error: insertError } = await store.insert({
        contact_name: contactName,
        contact_email: contactEmail,
        centre_name: centreName,
        contact_phone: contactPhone,
        estimated_student_count: parsedStudentCount,
        wants_beta_testing: body?.wants_beta_testing ? true : false,
        status: 'pending',
      })

      if (insertError) {
        if (insertError.code === '23505') {
          const { data: duplicate } = await store.findByEmail(contactEmail)
          if (duplicate) {
            const { count } = await store.countThrough(duplicate.created_at)
            return c.json(duplicateResponse(count), 409)
          }
        }
        console.error('Error inserting waitlist signup:', insertError)
        return c.json({ error: 'Failed to join waitlist. Please try again.' }, 500)
      }
      if (!signup) return c.json({ error: 'Failed to join waitlist. Please try again.' }, 500)

      const { count, error: countError } = await store.countThrough(signup.created_at)
      if (countError) console.error('Error calculating waitlist position:', countError)
      return c.json({ message: 'Successfully joined the waitlist!', position: count || 1, already_joined: false }, 201)
    } catch (error) {
      console.error('Waitlist endpoint error:', error)
      return c.json({ error: 'Internal server error' }, 500)
    }
  })

  return router
}

export const waitlistRouter = createWaitlistRouter(createSupabaseWaitlistStore(supabase))
