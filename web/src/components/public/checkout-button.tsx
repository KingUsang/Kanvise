"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from 'lucide-react'

interface CheckoutButtonProps {
  schoolSlug: string;
  programmeSlug: string;
  programmeId?: string;
  courseId?: string;
  price: number;
}

export function CheckoutButton({ schoolSlug, programmeSlug, programmeId, courseId, price }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [alreadyEnrolled, setAlreadyEnrolled] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldAutoStartCheckout = searchParams.get("checkout") === "true";
  const supabase = createClient();
  const idempotencyKeyRef = useRef<string | null>(null);
  const autoStartTriggeredRef = useRef(false);
  const isFree = Number(price) === 0;
  const isProgramme = Boolean(programmeId)
  const actionLabel = isProgramme ? 'Join programme' : isFree ? 'Enrol for free' : `Enrol now · ₦${price.toLocaleString()}`

  const handleCheckout = async () => {
    if (alreadyEnrolled) {
      window.location.assign('/dashboard/student')
      return
    }
    setLoading(true);
    setError('')

    try {
      // Check auth state
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // The API issues a one-time student intent; redirect paths never assign roles.
        const redirectUrl = `/${schoolSlug}/${programmeSlug}?checkout=true`;
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        if (!apiUrl) throw new Error("Registration is temporarily unavailable");
        const intentResponse = await fetch(`${apiUrl}/auth/registration-intents/student`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ return_to: redirectUrl }) });
        const intent = await intentResponse.json().catch(() => null);
        if (!intentResponse.ok || !intent?.token) throw new Error(intent?.error || 'Could not start student registration');
        router.push(`/auth/register/student?intent=${encodeURIComponent(intent.token)}&return_to=${encodeURIComponent(redirectUrl)}`);
        return;
      }

      // A valid Supabase session is not enough: admins and tutors can also be
      // signed in, but only students may purchase a programme.
      const profileRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
        headers: { "Authorization": `Bearer ${session.access_token}` },
      });
      const profileBody = await profileRes.json().catch(() => null);
      if (!profileRes.ok) {
        throw new Error(profileBody?.error || "Could not verify your account");
      }
      if (profileBody?.user?.role !== "student") {
        throw new Error(isProgramme ? 'Please use a student account to join this class.' : 'Please use a student account to continue.');
      }

      // Check role - only students can enrol
      // The backend will enforce this, but let's assume it's valid for now.
      
      // Make checkout request
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) throw new Error("Checkout is temporarily unavailable");
      const idempotencyKey = idempotencyKeyRef.current || crypto.randomUUID();
      idempotencyKeyRef.current = idempotencyKey;
      const res = await fetch(`${apiUrl}/payments/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          programme_id: programmeId,
          course_id: courseId
        })
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === 'ALREADY_ENROLLED') {
          idempotencyKeyRef.current = null
          setAlreadyEnrolled(true)
          return
        }
        if (data.code !== "PAYMENT_INITIALIZING") idempotencyKeyRef.current = null;
        throw new Error(data.error || "Checkout failed");
      }

      if (data.data?.free) {
        // The enrolment adopts a standalone student into this centre. Refresh
        // Auth metadata before the dashboard decides which student home to show.
        await supabase.auth.refreshSession().catch(() => undefined);
        window.location.assign("/dashboard/student");
      } else if (data.data && data.data.payment_url) {
        // Redirect to Paystack
        window.location.href = data.data.payment_url;
      } else {
        throw new Error("No payment URL received");
      }

    } catch (err: any) {
      console.error("Checkout Error:", err);
      const message = err.message || (isProgramme ? "We couldn't start joining this class. Try again." : 'We could not start enrolment. Try again.')
      setError(message)
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoStartTriggeredRef.current) return;
    if (!shouldAutoStartCheckout) return;
    autoStartTriggeredRef.current = true;
    void handleCheckout();
  }, [shouldAutoStartCheckout]);

  return (<div>
    <button
      onClick={handleCheckout}
      disabled={loading}
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#994704] px-5 text-sm font-semibold text-white transition hover:bg-[#7d3903] focus:outline-none focus:ring-4 focus:ring-[#994704]/20 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? <><Loader2 size={17} className="animate-spin"/>{isProgramme && isFree ? 'Joining…' : isFree ? 'Enrolling…' : 'Opening checkout…'}</> : <>{alreadyEnrolled ? 'Open class' : actionLabel}<ArrowRight size={16}/></>}
    </button>
    {alreadyEnrolled ? <p className="mt-3 text-center text-sm text-[#17653a]">You’re already enrolled in this class.</p> : error ? <p role="alert" className="mt-3 text-center text-sm leading-5 text-[#a33a2b]">{error}</p> : null}
  </div>);
}
