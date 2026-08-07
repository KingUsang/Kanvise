"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PaymentState = "loading" | "pending" | "success" | "failed" | "error";

export default function PaymentReturnStatus({ reference }: { reference: string }) {
  const [state, setState] = useState<PaymentState>(reference ? "loading" : "error");
  const [message, setMessage] = useState(reference ? "Confirming your payment…" : "This payment reference is missing.");
  const [telegramPaidAccess, setTelegramPaidAccess] = useState(false);
  const [telegramCode, setTelegramCode] = useState("");
  const [telegramBusy, setTelegramBusy] = useState(false);

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
        let response = await fetch(`${apiUrl}/marketplace/orders/${encodeURIComponent(reference)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        if (response.status === 404) response = await fetch(`${apiUrl}/payments/status/${encodeURIComponent(reference)}`, {
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
          setTelegramPaidAccess(Boolean(body.data.telegram_paid_access_available));
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

  async function startTelegramAccess() {
    setTelegramBusy(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sign in to connect Telegram.");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await fetch(`${apiUrl}/telegram/paid-access/challenges`, { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not start Telegram access.");
      window.open(body.data.start_url, "_blank", "noopener,noreferrer");
      setMessage("Telegram opened. Tap Start, then enter the six-digit code from the bot below.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not start Telegram access."); }
    finally { setTelegramBusy(false); }
  }

  async function confirmTelegramAccess() {
    if (!/^\d{6}$/.test(telegramCode)) { setMessage("Enter the six-digit code from the Telegram bot."); return; }
    setTelegramBusy(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sign in to connect Telegram.");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await fetch(`${apiUrl}/telegram/paid-access/confirm`, { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ code: telegramCode }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not confirm Telegram access.");
      setTelegramCode(""); setMessage("Telegram connected. The bot has sent your private class join request link.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not confirm Telegram access."); }
    finally { setTelegramBusy(false); }
  }

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
        {state === "success" && telegramPaidAccess && <div className="mt-6 rounded-2xl bg-kv-soft p-5 text-left"><p className="font-semibold text-kv-dark">Your tutorial teaches in a paid Telegram class</p><p className="mt-1 text-sm text-on-surface-variant">Connect the Telegram account you will use for class. The bot will approve only your paid account.</p><button disabled={telegramBusy} onClick={() => void startTelegramAccess()} className="mt-4 rounded-xl bg-kv-blue px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Connect Telegram class</button><div className="mt-3 flex gap-2"><input value={telegramCode} onChange={(event) => setTelegramCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="Six-digit bot code" className="min-w-0 flex-1 rounded-xl border border-outline bg-white px-3 text-sm"/><button disabled={telegramBusy} onClick={() => void confirmTelegramAccess()} className="rounded-xl border border-kv-blue px-3 text-sm font-semibold text-kv-blue disabled:opacity-50">Confirm</button></div></div>}
        {reference && <p className="mt-5 break-all text-xs text-outline">Reference: {reference}</p>}
        <Link href="/dashboard/student/purchases" className="mt-7 inline-flex rounded-xl bg-kv-blue px-6 py-3 font-semibold text-white hover:opacity-90">
          View purchases
        </Link>
      </section>
    </main>
  );
}
