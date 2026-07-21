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
        const response = await fetch(`${apiUrl}/payments/status/${encodeURIComponent(reference)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not check payment status");
        if (cancelled) return;

        if (body.data.status === "successful") {
          setState("success");
          setMessage("Payment confirmed. Your class access is ready.");
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
          ? "Paystack is still confirming the payment. You can leave this page and check again later."
          : "Payment received. We’re waiting for Paystack’s confirmation…");
        if (attempts < 20) window.setTimeout(check, 3_000);
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
        <Link href="/" className="mt-7 inline-flex rounded-xl bg-kv-blue px-6 py-3 font-semibold text-white hover:opacity-90">
          Return home
        </Link>
      </section>
    </main>
  );
}
