import crypto from 'crypto'
import { Hono } from 'hono'
import { isUnsafeSecret } from '../config/payment-secrets'
import { ensurePaymentConfirmationEmail } from '../emails/ensure-payment-confirmation'
import { supabase } from '../lib/supabase'

export const internalPaymentsRouter = new Hono()

function secretsMatch(provided: string, expected: string): boolean {
  const left = Buffer.from(provided)
  const right = Buffer.from(expected)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

internalPaymentsRouter.post('/confirm', async (c) => {
  const expectedSecret = process.env.KANVISE_INTERNAL_SECRET
  if (isUnsafeSecret(expectedSecret)) {
    return c.json({ error: 'Internal payment confirmation is not configured' }, 503)
  }

  const providedSecret = c.req.header('X-Kanvise-Internal-Secret') || ''
  if (!secretsMatch(providedSecret, expectedSecret!)) {
    return c.json({ error: 'Unauthorised internal request' }, 401)
  }

  const { paystack_reference, paystack_transaction_id } = await c.req.json()
  if (!paystack_reference || !paystack_transaction_id) {
    return c.json({ error: 'paystack_reference and paystack_transaction_id are required' }, 400)
  }

  const paystackSecret = process.env.PAYSTACK_SECRET_KEY
  if (isUnsafeSecret(paystackSecret)) {
    return c.json({ error: 'Paystack verification is not configured' }, 503)
  }

  let verifyResponse: Response
  let verification: any
  try {
    verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(paystack_reference)}`,
      {
        headers: { Authorization: `Bearer ${paystackSecret}` },
        signal: AbortSignal.timeout(15_000),
      },
    )
    verification = await verifyResponse.json()
  } catch {
    return c.json({ error: 'Paystack verification is temporarily unavailable', retryable: true }, 503)
  }
  if (!verifyResponse.ok || !verification.status || verification.data?.status !== 'success') {
    return c.json({ error: 'Paystack transaction is not successful' }, 422)
  }
  if (verification.data.reference !== paystack_reference || String(verification.data.id) !== String(paystack_transaction_id)) {
    return c.json({ error: 'Paystack transaction details do not match the webhook' }, 422)
  }
  if (verification.data.currency !== 'NGN' || !Number.isInteger(verification.data.amount) || verification.data.amount <= 0) {
    return c.json({ error: 'Paystack transaction currency or amount is invalid' }, 422)
  }

  const { data, error } = await supabase.rpc('confirm_student_payment', {
    p_paystack_reference: paystack_reference,
    p_paystack_transaction_id: String(paystack_transaction_id),
    p_amount_kobo: verification.data.amount,
  })

  if (error) {
    if (error.message?.includes('PAYMENT_NOT_FOUND')) return c.json({ error: 'Payment not found' }, 404)
    if (error.message?.includes('PAYMENT_AMOUNT_MISMATCH')) return c.json({ error: 'Payment amount mismatch' }, 409)
    if (error.message?.includes('PAYMENT_ALREADY_FAILED')) return c.json({ error: 'Payment was already marked as failed' }, 409)
    return c.json({ error: 'Payment confirmation failed' }, 500)
  }

  const result = data as unknown as {
    payment_id: string
    enrolment_id: string | null
    already_processed: boolean
    school_id: string
    student_auth_id: string | null
    student_school_id: string | null
    currency: string | null
    amount: number | string
    student_email: string
    student_first_name: string
    school_name: string
    target_name: string
    paystack_reference: string
    paid_at: string
  } | null
  if (!result) return c.json({ error: 'Payment confirmation failed' }, 500)

  // Keep the JWT fast-path claims in sync: the student's first centre enrolment
  // sets user_profiles.school_id, so app_metadata must carry the same school or
  // the API keeps treating them as marketplace-only until token refresh.
  if (result.student_auth_id && result.student_school_id) {
    const { error: metadataError } = await supabase.auth.admin.updateUserById(result.student_auth_id, {
      app_metadata: { school_id: result.student_school_id },
    })
    if (metadataError) {
      console.error('[internal-payments] Failed to sync school_id claim:', metadataError)
      // Retryable: the RPC is idempotent, so Paystack redelivery re-runs this sync.
      return c.json({ error: 'Payment confirmed, but account update failed', retryable: true }, 503)
    }
  }

  const frontendUrl = process.env.FRONTEND_URL
  if (!frontendUrl) return c.json({ error: 'Payment confirmed, but email configuration is incomplete' }, 503)

  const amount = new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: result.currency || 'NGN', currencyDisplay: 'symbol',
  }).format(Number(result.amount))
  const email = await ensurePaymentConfirmationEmail({
    paymentId: result.payment_id,
    recipientEmail: result.student_email,
    firstName: result.student_first_name,
    schoolName: result.school_name,
    targetName: result.target_name,
    amount,
    paymentReference: result.paystack_reference,
    paidAt: result.paid_at,
    dashboardUrl: `${frontendUrl.replace(/\/$/, '')}/dashboard`,
  })

  if (!email.sent) {
    // Returning a retryable error lets Paystack redeliver without duplicating DB effects.
    return c.json({ error: 'Payment confirmed, but receipt delivery failed', retryable: true }, 503)
  }

  return c.json({
    message: 'Enrolment created and access granted',
    data: {
      payment_id: result.payment_id,
      enrolment_id: result.enrolment_id,
      already_processed: result.already_processed,
      email_sent: true,
      email_id: email.id,
      email_already_sent: email.alreadySent,
    },
  })
})

// Marketplace orders use their own immutable order/entitlement ledger. This is
// intentionally an internal verified-webhook endpoint; a browser callback can
// only poll order status and can never grant a mock.
internalPaymentsRouter.post('/marketplace-confirm', async (c) => {
  const expectedSecret = process.env.KANVISE_INTERNAL_SECRET
  if (isUnsafeSecret(expectedSecret)) return c.json({ error: 'Internal payment confirmation is not configured' }, 503)
  const providedSecret = c.req.header('X-Kanvise-Internal-Secret') || ''
  if (!secretsMatch(providedSecret, expectedSecret!)) return c.json({ error: 'Unauthorised internal request' }, 401)
  const { paystack_reference, paystack_transaction_id } = await c.req.json()
  if (!paystack_reference || !paystack_transaction_id) return c.json({ error: 'paystack_reference and paystack_transaction_id are required' }, 400)
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY
  if (isUnsafeSecret(paystackSecret)) return c.json({ error: 'Paystack verification is not configured' }, 503)
  let verification: any
  let verifyResponse: Response
  try {
    verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(paystack_reference)}`, {
      headers: { Authorization: `Bearer ${paystackSecret}` }, signal: AbortSignal.timeout(15_000),
    })
    verification = await verifyResponse.json()
  } catch { return c.json({ error: 'Paystack verification is temporarily unavailable', retryable: true }, 503) }
  if (!verifyResponse.ok || !verification.status || verification.data?.status !== 'success'
    || verification.data.reference !== paystack_reference || String(verification.data.id) !== String(paystack_transaction_id)
    || verification.data.currency !== 'NGN' || !Number.isInteger(verification.data.amount)) {
    return c.json({ error: 'Paystack transaction details do not match this marketplace order' }, 422)
  }
  const { data, error } = await supabase.rpc('confirm_marketplace_payment', {
    p_paystack_reference: paystack_reference, p_paystack_transaction_id: String(paystack_transaction_id),
    p_amount_kobo: verification.data.amount, p_now: new Date().toISOString(),
  })
  if (error) {
    const code = String(error.message || '')
    if (code.includes('MARKETPLACE_ORDER_NOT_FOUND')) return c.json({ error: 'Marketplace order not found' }, 404)
    return c.json({ error: code.includes('AMOUNT_MISMATCH') ? 'Payment amount does not match this order' : 'Marketplace payment confirmation failed' }, code.includes('AMOUNT_MISMATCH') ? 409 : 500)
  }
  const order: any = data?.[0] || data
  const frontendUrl = process.env.FRONTEND_URL
  if (!frontendUrl || !order?.student_email) return c.json({ error: 'Payment confirmed but receipt delivery is not configured', retryable: true }, 503)
  const amount = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(verification.data.amount / 100)
  const email = await ensurePaymentConfirmationEmail({
    paymentId: order.order_id, recipientEmail: order.student_email, firstName: order.student_first_name || 'there', schoolName: 'Kanvise Marketplace',
    targetName: order.listing_title, amount, paymentReference: paystack_reference, paidAt: new Date().toISOString(),
    dashboardUrl: `${frontendUrl.replace(/\/$/, '')}/dashboard/student/mocks`,
  })
  if (!email.sent) return c.json({ error: 'Payment confirmed but receipt delivery failed', retryable: true }, 503)
  return c.json({ data: { order_id: order.order_id, entitlement_id: order.entitlement_id, already_processed: order.already_processed, email_sent: true } })
})
