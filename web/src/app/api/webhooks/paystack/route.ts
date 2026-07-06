import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-paystack-signature");
    const secret = process.env.PAYSTACK_SECRET_KEY || "placeholder_key";
    const rawBody = await req.text();

    // Verify HMAC SHA512 signature if secret is configured in environment
    if (secret && secret !== "placeholder_key" && !secret.includes("placeholder")) {
      const hash = crypto
        .createHmac("sha512", secret)
        .update(rawBody)
        .digest("hex");

      if (hash !== signature) {
        console.error("[Paystack Webhook] Signature mismatch");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const event = JSON.parse(rawBody);
    console.log(`[Paystack Webhook] Received event: ${event.event}`);

    // Process charge.success events
    if (event.event === "charge.success" && event.data) {
      const { reference, id: transactionId } = event.data;

      // Forward to Hono backend API internal confirmation endpoint
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const internalSecret = process.env.KANVISE_INTERNAL_SECRET || "kanvise_internal_dev_secret";

      const confirmRes = await fetch(`${apiUrl}/enrolments/internal/payments/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Kanvise-Internal-Secret": internalSecret
        },
        body: JSON.stringify({
          paystack_reference: reference,
          paystack_transaction_id: transactionId ? String(transactionId) : null
        })
      });

      if (!confirmRes.ok) {
        const errText = await confirmRes.text();
        console.error(`[Paystack Webhook] Hono API confirmation failed (${confirmRes.status}):`, errText);
        // Return 500 to tell Paystack to retry this webhook delivery later
        return NextResponse.json({ error: "Backend confirmation failed", details: errText }, { status: 500 });
      }

      console.log(`[Paystack Webhook] Successfully confirmed enrolment for reference: ${reference}`);
    }

    // Always return 200 OK immediately to acknowledge receipt to Paystack
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error("[Paystack Webhook] Fatal error processing event:", error);
    return NextResponse.json({ error: "Internal webhook processing error" }, { status: 500 });
  }
}
