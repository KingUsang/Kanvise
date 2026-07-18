"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

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
  const supabase = createClient();

  const handleCheckout = async () => {
    setLoading(true);

    try {
      // Check auth state
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Not logged in: redirect to login/register with redirect context
        const redirectUrl = `/${schoolSlug}/${programmeSlug}?checkout=true`;
        router.push(`/auth/login?redirect=${encodeURIComponent(redirectUrl)}`);
        return;
      }

      // Check role - only students can enrol
      // The backend will enforce this, but let's assume it's valid for now.
      
      // Make checkout request
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${apiUrl}/payments/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          programme_id: programmeId,
          course_id: courseId
        })
      });

      const data = await res.json();

      if (!res.ok) {
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
      alert(err.message || "An error occurred during checkout.");
    } finally {
      setLoading(false);
    }
  };

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
