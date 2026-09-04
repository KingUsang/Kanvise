import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { requireWebhookSecrets } from "@/lib/server/payment-config";

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-paystack-signature");
    let secrets;
    try {
      secrets = requireWebhookSecrets();
    } catch {
      console.error("[Paystack Webhook] Required webhook secrets are not configured");
      return NextResponse.json(
        { error: "Webhook configuration error" },
        { status: 500 },
      );
    }
    const { paystackSecret: secret, internalSecret } = secrets;

    const rawBody = await req.text();

    const hash = crypto
      .createHmac("sha512", secret)
      .update(rawBody)
      .digest("hex");

    const supplied = Buffer.from(signature || '');
    const expected = Buffer.from(hash);
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
      console.error("[Paystack Webhook] Signature mismatch");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    console.log(`[Paystack Webhook] Received event: ${event.event}`);

    // Process charge.success events
    if (event.event === "charge.success" && event.data) {
      const { reference, id: transactionId } = event.data;

      // Forward to Hono backend API internal confirmation endpoint
      const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

      let confirmRes = await fetch(`${apiUrl}/internal/payments/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Kanvise-Internal-Secret": internalSecret
        },
        signal: AbortSignal.timeout(20_000),
        body: JSON.stringify({
          paystack_reference: reference,
          paystack_transaction_id: transactionId ? String(transactionId) : null
        })
      });

      // A reference belongs to either an existing course/programme checkout or
      // a standalone mock order. Both paths re-verify server-side.
      if (confirmRes.status === 404) {
        confirmRes = await fetch(`${apiUrl}/internal/payments/mock-confirm`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Kanvise-Internal-Secret": internalSecret
          },
          signal: AbortSignal.timeout(20_000),
          body: JSON.stringify({
            paystack_reference: reference,
            paystack_transaction_id: transactionId ? String(transactionId) : null
          })
        });
      }

      if (!confirmRes.ok) {
        const errText = await confirmRes.text();
        console.error(`[Paystack Webhook] Hono API confirmation failed (${confirmRes.status}):`, errText);
        // Return 500 to tell Paystack to retry this webhook delivery later
        return NextResponse.json({ error: "Backend confirmation failed", details: errText }, { status: 500 });
      }

      console.log(`[Paystack Webhook] Successfully confirmed payment for reference: ${reference}`);
    }

    // Always return 200 OK immediately to acknowledge receipt to Paystack
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: unknown) {
    console.error("[Paystack Webhook] Fatal error processing event:", error);
    return NextResponse.json({ error: "Internal webhook processing error" }, { status: 500 });
  }
}
