"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PaymentState = "loading" | "pending" | "success" | "failed" | "error";

export default function PaymentReturnStatus({ reference }: { reference: string }) {
  const [state, setState] = useState<PaymentState>(reference ? "loading" : "error");
  const [message, setMessage] = useState(reference ? "Confirming your payment…" : "This payment reference is missing.");

  useEffect(() => {
    if (!reference) return;
    let cancelled = false;
    let attempts = 0;
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
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        if (!apiUrl) throw new Error("Payment status is unavailable");
        let response = await fetch(`${apiUrl}/payments/status/${encodeURIComponent(reference)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        // Marketplace orders are a legacy fallback only. Centre programme
        // payments are the normal Kanvise enrolment flow and must never be
        // sent to marketplace purchases.
        if (response.status === 404) response = await fetch(`${apiUrl}/marketplace/orders/${encodeURIComponent(reference)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store",
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not check payment status");
        if (cancelled) return;

        if (body.data.status === "successful" || body.data.status === "paid") {
          // A first centre enrolment updates the school_id JWT claim server-side;
          // refresh so the dashboard renders the centre view immediately.
          await supabase.auth.refreshSession().catch(() => undefined);
          if (cancelled) return;
          setState("success");
          setMessage("Payment confirmed. Your access is ready.");
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

  const icon = state === "success" ? "check_circle" : state === "failed" || state === "error" ? "error" : "progress_activity";
  return (
    <main className="min-h-screen bg-kv-soft px-4 py-16 flex items-center justify-center">
      <section className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-[0_16px_60px_rgba(46,40,119,0.12)]">
        <span className={`material-symbols-outlined text-6xl ${state === "success" ? "text-green-600" : state === "failed" || state === "error" ? "text-error" : "text-kv-blue animate-spin"}`}>
          {icon}
        </span>
        <h1 className="mt-5 text-2xl font-bold text-kv-dark">
          {state === "success" ? "You’re enrolled" : state === "failed" ? "Payment incomplete" : "Checking payment"}
        </h1>
        <p className="mt-3 text-on-surface-variant">{message}</p>
        {reference && <p className="mt-5 break-all text-xs text-outline">Reference: {reference}</p>}
        <Link href="/dashboard/student" className="mt-7 inline-flex rounded-xl bg-kv-blue px-6 py-3 font-semibold text-white hover:opacity-90">
          Go to my learning
        </Link>
      </section>
    </main>
  );
}
