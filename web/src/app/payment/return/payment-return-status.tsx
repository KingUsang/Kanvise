"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getApiUrl } from '@/config/api'
import { authenticatedFetch } from '@/lib/authenticated-fetch'

type PaymentState = "loading" | "pending" | "success" | "failed" | "error";
type PurchaseKind = 'enrolment' | 'mock'

export default function PaymentReturnStatus({ reference }: { reference: string }) {
  const [state, setState] = useState<PaymentState>(reference ? "loading" : "error");
  const [message, setMessage] = useState(reference ? "Confirming your payment…" : "This payment reference is missing.");
  const [purchaseKind, setPurchaseKind] = useState<PurchaseKind>('enrolment')
  const [mockOfferId, setMockOfferId] = useState<string | null>(null)
  const [startingMock, setStartingMock] = useState(false)

  useEffect(() => {
    if (!reference) return;
    let cancelled = false;
    let attempts = 0;
    let recoveryAttempted = false;
    const supabase = createClient();

    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) {
          setState("error");
          setMessage("Sign in to check this payment.");
        }
        return;
      }

      try {
        const apiUrl = getApiUrl()
        let kind: PurchaseKind = 'enrolment'
        let response = await authenticatedFetch(supabase, `${apiUrl}/payments/status/${encodeURIComponent(reference)}`, session.access_token, {
          cache: "no-store",
        });
        // A reference can belong to a normal enrolment checkout or a direct
        // mock order. Neither path creates the other kind of access.
        if (response.status === 404) {
          kind = 'mock'
          response = await authenticatedFetch(supabase, `${apiUrl}/mock/orders/${encodeURIComponent(reference)}`, session.access_token, { cache: 'no-store' })
        }
        let body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not check payment status");
        if (cancelled) return;

        if (body.data.status === "pending" && !recoveryAttempted) {
          recoveryAttempted = true;
          const confirmationPath = kind === 'mock'
            ? `/mock/orders/${encodeURIComponent(reference)}/confirm`
            : `/payments/status/${encodeURIComponent(reference)}/confirm`
          const fallback = await authenticatedFetch(supabase, `${apiUrl}${confirmationPath}`, session.access_token, {
            method: "POST", cache: "no-store",
          });
          if (fallback.ok) body = await fallback.json();
        }

        if (body.data.status === "successful" || body.data.status === "paid") {
          // A first centre enrolment updates the school_id JWT claim server-side;
          // refresh so the dashboard renders the centre view immediately.
          await supabase.auth.refreshSession().catch(() => undefined);
          if (cancelled) return;
          setPurchaseKind(kind)
          if (kind === 'mock') setMockOfferId(body.data.offer_id || body.data.offer?.id || null)
          setState("success");
          setMessage(kind === 'mock' ? 'Payment confirmed. Your mock is ready when you are.' : 'Payment confirmed. Your programme access is ready.');
          return;
        }
        if (body.data.status === "failed") {
          setState("failed");
          setMessage("This payment was not completed. You can safely try again.");
          return;
        }

        attempts += 1;
        setState("pending");
        setMessage(attempts >= 20
          ? "Paystack is taking longer than usual. We’ll keep checking automatically—do not pay again."
          : "Payment received. We’re waiting for Paystack’s confirmation…");
        // Keep the student on the result page until the verified webhook has
        // updated the payment. The old 60-second cap left a stale “Checking”
        // screen even after the receipt and enrolment had completed.
        window.setTimeout(check, attempts >= 20 ? 10_000 : 3_000);
      } catch (error) {
        if (!cancelled) {
          setState("error");
          setMessage(error instanceof Error ? error.message : "Could not check payment status");
        }
      }
    };

    void check();
    return () => { cancelled = true; };
  }, [reference]);

  const startMock = async () => {
    if (!mockOfferId) return
    setStartingMock(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sign in to start this mock')
      const response = await authenticatedFetch(supabase, `${getApiUrl()}/mock/${mockOfferId}/attempts`, session.access_token, { method: 'POST' })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.data?.attempt_id) throw new Error(body?.error || 'Could not start this mock')
      window.location.assign(`/dashboard/student/mocks/attempt/${body.data.attempt_id}`)
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Could not start this mock')
      setStartingMock(false)
    }
  }

  const icon = state === "success" ? "check_circle" : state === "failed" || state === "error" ? "error" : "progress_activity";
  return (
    <main className="min-h-screen bg-kv-soft px-4 py-16 flex items-center justify-center">
      <section className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-[0_16px_60px_rgba(46,40,119,0.12)]">
        <span className={`material-symbols-outlined text-6xl ${state === "success" ? "text-green-600" : state === "failed" || state === "error" ? "text-error" : "text-kv-blue animate-spin"}`}>
          {icon}
        </span>
        <h1 className="mt-5 text-2xl font-bold text-kv-dark">
          {state === "success" ? (purchaseKind === 'mock' ? 'Mock unlocked' : 'You’re enrolled') : state === "failed" ? "Payment incomplete" : "Checking payment"}
        </h1>
        <p className="mt-3 text-on-surface-variant">{message}</p>
        {reference && <p className="mt-5 break-all text-xs text-outline">Reference: {reference}</p>}
        {state === 'success' && purchaseKind === 'mock' && mockOfferId ? (
          <button onClick={() => void startMock()} disabled={startingMock} className="mt-7 inline-flex rounded-xl bg-kv-blue px-6 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60">
            {startingMock ? 'Starting mock…' : 'Start mock'}
          </button>
        ) : (
          <Link href={purchaseKind === 'mock' ? '/dashboard/student/mocks?view=unlocked' : '/dashboard/student'} className="mt-7 inline-flex rounded-xl bg-kv-blue px-6 py-3 font-semibold text-white hover:opacity-90">
            {purchaseKind === 'mock' ? 'Go to mocks' : 'Go to my learning'}
          </Link>
        )}
      </section>
    </main>
  );
}
