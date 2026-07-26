import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), ensureEmail: vi.fn(), updateUserById: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc: mocks.rpc, auth: { admin: { updateUserById: mocks.updateUserById } } } }))
vi.mock('../emails/ensure-payment-confirmation', () => ({ ensurePaymentConfirmationEmail: mocks.ensureEmail }))

import { internalPaymentsRouter } from './internal-payments'

const internalSecret = '9dff4bf1e998ea69922c6d21f782ef35'
const paystackSecret = 'paystack-test-secret-abcdefghijklmnopqrstuvwxyz'

describe('POST /internal/payments/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('KANVISE_INTERNAL_SECRET', internalSecret)
    vi.stubEnv('PAYSTACK_SECRET_KEY', paystackSecret)
    vi.stubEnv('FRONTEND_URL', 'https://kanvise.com')
  })

  it('rejects requests without the internal secret before contacting Paystack', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const response = await internalPaymentsRouter.request('/confirm', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    })
    expect(response.status).toBe(401)
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('confirms the transaction and returns delivery state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      status: true,
      data: { status: 'success', reference: 'PAY-1', id: 12345, amount: 2500000, currency: 'NGN' },
    }), { status: 200 }))
    mocks.rpc.mockResolvedValue({ data: {
      payment_id: 'payment-1', enrolment_id: 'enrolment-1', already_processed: false,
      school_id: 'school-1', student_auth_id: 'auth-1', student_school_id: 'school-1',
      currency: 'NGN', amount: 25000, student_email: 'student@example.com', student_first_name: 'Ada',
      school_name: 'Bright Minds', target_name: 'WAEC Physics', paystack_reference: 'PAY-1', paid_at: '2026-07-20T12:00:00Z',
    }, error: null })
    mocks.ensureEmail.mockResolvedValue({ sent: true, id: 'email-1', alreadySent: false })
    mocks.updateUserById.mockResolvedValue({ data: {}, error: null })

    const response = await internalPaymentsRouter.request('/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Kanvise-Internal-Secret': internalSecret },
      body: JSON.stringify({ paystack_reference: 'PAY-1', paystack_transaction_id: '12345' }),
    })
    const body = await response.json() as any

    expect(response.status).toBe(200)
    expect(body.data).toMatchObject({ payment_id: 'payment-1', enrolment_id: 'enrolment-1', email_sent: true })
    expect(mocks.rpc).toHaveBeenCalledWith('confirm_student_payment', expect.objectContaining({ p_amount_kobo: 2500000 }))
    expect(mocks.updateUserById).toHaveBeenCalledWith('auth-1', { app_metadata: { school_id: 'school-1' } })
    expect(mocks.ensureEmail).toHaveBeenCalledWith(expect.objectContaining({ targetName: 'WAEC Physics' }))
  })

  it('returns a retryable error when the school claim sync fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      status: true,
      data: { status: 'success', reference: 'PAY-1', id: 12345, amount: 2500000, currency: 'NGN' },
    }), { status: 200 }))
    mocks.rpc.mockResolvedValue({ data: {
      payment_id: 'payment-1', enrolment_id: 'enrolment-1', already_processed: false,
      school_id: 'school-1', student_auth_id: 'auth-1', student_school_id: 'school-1',
      currency: 'NGN', amount: 25000, student_email: 'student@example.com', student_first_name: 'Ada',
      school_name: 'Bright Minds', target_name: 'WAEC Physics', paystack_reference: 'PAY-1', paid_at: '2026-07-20T12:00:00Z',
    }, error: null })
    mocks.updateUserById.mockResolvedValue({ data: null, error: { message: 'auth unavailable' } })

    const response = await internalPaymentsRouter.request('/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Kanvise-Internal-Secret': internalSecret },
      body: JSON.stringify({ paystack_reference: 'PAY-1', paystack_transaction_id: '12345' }),
    })
    const body = await response.json() as any

    expect(response.status).toBe(503)
    expect(body.retryable).toBe(true)
    expect(mocks.ensureEmail).not.toHaveBeenCalled()
  })

  it('rejects a successful transaction in the wrong currency', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      status: true,
      data: { status: 'success', reference: 'PAY-1', id: 12345, amount: 2500000, currency: 'USD' },
    }), { status: 200 }))

    const response = await internalPaymentsRouter.request('/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Kanvise-Internal-Secret': internalSecret },
      body: JSON.stringify({ paystack_reference: 'PAY-1', paystack_transaction_id: '12345' }),
    })

    expect(response.status).toBe(422)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
