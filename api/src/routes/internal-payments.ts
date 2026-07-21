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

  const frontendUrl = process.env.FRONTEND_URL
  if (!frontendUrl) return c.json({ error: 'Payment confirmed, but email configuration is incomplete' }, 503)

  const amount = new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: data.currency || 'NGN', currencyDisplay: 'symbol',
  }).format(Number(data.amount))
  const email = await ensurePaymentConfirmationEmail({
    paymentId: data.payment_id,
    recipientEmail: data.student_email,
    firstName: data.student_first_name,
    schoolName: data.school_name,
    targetName: data.target_name,
    amount,
    paymentReference: data.paystack_reference,
    paidAt: data.paid_at,
    dashboardUrl: `${frontendUrl.replace(/\/$/, '')}/dashboard`,
  })

  if (!email.sent) {
    // Returning a retryable error lets Paystack redeliver without duplicating DB effects.
    return c.json({ error: 'Payment confirmed, but receipt delivery failed', retryable: true }, 503)
  }

  return c.json({
    message: 'Enrolment created and access granted',
    data: {
      payment_id: data.payment_id,
      enrolment_id: data.enrolment_id,
      already_processed: data.already_processed,
      email_sent: true,
      email_id: email.id,
      email_already_sent: email.alreadySent,
    },
  })
})
