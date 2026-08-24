"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { toast } from "sonner";

interface CheckoutButtonProps {
  schoolSlug: string;
  programmeSlug: string;
  programmeId?: string;
  courseId?: string;
  price: number;
}

export function CheckoutButton({ schoolSlug, programmeSlug, programmeId, courseId, price }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldAutoStartCheckout = searchParams.get("checkout") === "true";
  const supabase = createClient();
  const idempotencyKeyRef = useRef<string | null>(null);
  const autoStartTriggeredRef = useRef(false);

  const handleCheckout = async () => {
    setLoading(true);

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
        throw new Error("Please use a student account to enrol in this programme.");
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
        if (data.code !== "PAYMENT_INITIALIZING") idempotencyKeyRef.current = null;
        throw new Error(data.error || "Checkout failed");
      }

      if (data.data && data.data.payment_url) {
        // Redirect to Paystack
        window.location.href = data.data.payment_url;
      } else {
        throw new Error("No payment URL received");
      }

    } catch (err: any) {
      console.error("Checkout Error:", err);
      toast.error(err.message || "An error occurred during checkout.");
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

  return (
    <button
      onClick={handleCheckout}
      disabled={loading}
      className="w-full bg-secondary text-white py-5 rounded-xl font-bold text-lg hover:opacity-90 transform active:scale-[0.98] transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? "Processing..." : `Enrol Now • ₦${price.toLocaleString()}`}
      {!loading && <span className="material-symbols-outlined">payments</span>}
    </button>
  );
}
