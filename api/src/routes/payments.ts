import { Hono } from "hono";
import { supabase } from "../lib/supabase";
import { jwtVerificationMiddleware, profileResolutionMiddleware } from "../middleware/auth";
import {
  calculatePaymentBreakdown,
  checkoutCallbackUrl,
  createPaystackReference,
  isUuid,
  parseCheckoutTarget,
} from "../payments/checkout";

type Variables = {
  user: any;
};

export const paymentsRouter = new Hono<{ Variables: Variables }>();

paymentsRouter.use("*", jwtVerificationMiddleware, profileResolutionMiddleware);

// Middleware to enforce Admin role
const enforceAdmin = async (c: any, next: any) => {
  const profile = c.get("user");
  if (profile.role !== "admin") {
    return c.json({ error: "Only admins can perform this action", code: "FORBIDDEN" }, 403);
  }
  await next();
};

// GET /payments/summary — Fetch subaccount config and Kanvise subscription status
paymentsRouter.get("/summary", enforceAdmin, async (c) => {
  try {
    const profile = c.get("user");

    // Fetch Subaccount
    const { data: subaccount } = await supabase
      .from("paystack_subaccounts")
      .select("*")
      .eq("school_id", profile.school_id)
      .single();

    // Fetch Subscription
    const { data: subscription } = await supabase
      .from("kanvise_subscriptions")
      .select("*")
      .eq("school_id", profile.school_id)
      .single();

    return c.json({ data: { subaccount, subscription } });
  } catch (error: any) {
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

// POST /checkout — Initiate a Paystack payment for a student
paymentsRouter.post("/checkout", async (c) => {
  try {
    const user = c.get("user");
    if (user.role !== "student") {
      return c.json({ error: "Only students can checkout", code: "FORBIDDEN" }, 403);
    }

    const body = await c.req.json();
    const checkoutTarget = parseCheckoutTarget(body);
    if (!checkoutTarget) {
      return c.json({ error: "Exactly one enrolment target is required", code: "INVALID_ENROLMENT_TARGET" }, 400);
    }

    const idempotencyKey = c.req.header("Idempotency-Key") || "";
    if (!isUuid(idempotencyKey)) {
      return c.json({ error: "A valid Idempotency-Key header is required", code: "INVALID_IDEMPOTENCY_KEY" }, 400);
    }

    if (!user.email) {
      return c.json({ error: "Your account needs an email address before checkout", code: "EMAIL_REQUIRED" }, 400);
    }

    const existingCheckoutQuery = () => supabase
      .from("payments")
      .select("id, paystack_reference, paystack_authorization_url, amount, status, programme_id, sub_programme_id, course_id, kanvise_fee")
      .eq("student_id", user.id)
      .eq("checkout_idempotency_key", idempotencyKey)
      .maybeSingle();

    const { data: existingCheckout } = await existingCheckoutQuery();
    if (existingCheckout) {
      if (existingCheckout.paystack_authorization_url && existingCheckout.status === "pending") {
        return c.json({ data: {
          payment_id: existingCheckout.id,
          paystack_reference: existingCheckout.paystack_reference,
          payment_url: existingCheckout.paystack_authorization_url,
          amount: existingCheckout.amount,
          breakdown: { programme_price: existingCheckout.amount, kanvise_fee: existingCheckout.kanvise_fee },
        } });
      }
      return c.json({
        error: "Checkout is still being initialized",
        code: "PAYMENT_INITIALIZING",
        data: { paystack_reference: existingCheckout.paystack_reference, status: existingCheckout.status },
      }, 409);
    }

    // 1. Fetch Target & Price
    const targetFields: string = checkoutTarget.column === "programme_id"
      ? "id, name, price, school_id, is_published"
      : "id, name, price, school_id, is_published, is_available_separately";
    const { data: rawTarget, error: targetError } = await supabase
      .from(checkoutTarget.table)
      .select(targetFields)
      .eq("id", checkoutTarget.id)
      .single();
    const target = rawTarget as any;

    if (targetError || !target) {
      return c.json({ error: "Target not found", code: "TARGET_NOT_FOUND" }, 404);
    }

    if (!target.is_published || (checkoutTarget.column !== "programme_id" && !(target as any).is_available_separately)) {
      return c.json({ error: "This item is not available for separate purchase", code: "NOT_AVAILABLE_SEPARATELY" }, 400);
    }

    // Check if already enrolled
    const { data: existingEnrolment } = await supabase
      .from("enrolments")
      .select("id")
      .eq("student_id", user.id)
      .eq(checkoutTarget.column, checkoutTarget.id)
      .maybeSingle();

    if (existingEnrolment) {
      return c.json({ error: "Already enrolled", code: "ALREADY_ENROLLED" }, 409);
    }

    // 2. Resolve subaccount for the school
    const { data: subaccount } = await supabase
      .from("paystack_subaccounts")
      .select("subaccount_code, percentage_charge")
      .eq("school_id", target.school_id)
      .single();

    if (!subaccount) {
      return c.json({ error: "School payments not configured" }, 400);
    }

    let breakdown;
    try {
      breakdown = calculatePaymentBreakdown(Number(target.price), Number(subaccount.percentage_charge));
    } catch {
      return c.json({ error: "Invalid payment configuration", code: "INVALID_PAYMENT_CONFIGURATION" }, 500);
    }

    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    const frontendUrl = process.env.FRONTEND_URL;
    if (!paystackSecret || !frontendUrl) {
      return c.json({ error: "Payments are not configured", code: "PAYMENTS_NOT_CONFIGURED" }, 503);
    }

    const reference = createPaystackReference();
    const targetColumns = {
      programme_id: checkoutTarget.column === "programme_id" ? checkoutTarget.id : null,
      sub_programme_id: checkoutTarget.column === "sub_programme_id" ? checkoutTarget.id : null,
      course_id: checkoutTarget.column === "course_id" ? checkoutTarget.id : null,
    };

    // Record the intent before contacting Paystack so a successful initialization
    // can always be reconciled by its reference.
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        school_id: target.school_id,
        student_id: user.id,
        amount: Number(target.price),
        paystack_reference: reference,
        checkout_idempotency_key: idempotencyKey,
        status: "pending",
        ...targetColumns,
        kanvise_fee: breakdown.kanviseFee,
        centre_amount: breakdown.centreAmount,
      })
      .select()
      .single();

    if (paymentError) {
      if (paymentError.code === "23505") {
        return c.json({ error: "Checkout is already being initialized", code: "PAYMENT_INITIALIZING" }, 409);
      }
      console.error("[payments/checkout] Failed to record payment:", paymentError);
      return c.json({ error: "Failed to record payment", code: "PAYMENT_RECORD_FAILED" }, 500);
    }

    let paystackData: any;
    try {
      const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: { Authorization: `Bearer ${paystackSecret}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          email: user.email,
          amount: breakdown.amountInKobo,
          currency: "NGN",
          reference,
          callback_url: checkoutCallbackUrl(frontendUrl),
          subaccount: subaccount.subaccount_code,
          transaction_charge: Math.round(breakdown.kanviseFee * 100),
          metadata: JSON.stringify({ student_id: user.id, school_id: target.school_id, ...targetColumns }),
        }),
      });
      paystackData = await paystackRes.json();
      if (!paystackRes.ok || !paystackData.status || !paystackData.data?.authorization_url || !paystackData.data?.access_code) {
        throw new Error(paystackData.message || "Invalid response from Paystack");
      }
    } catch (error: any) {
      await supabase.from("payments").update({ status: "failed" }).eq("id", payment.id);
      return c.json({ error: "Payment initiation failed", code: "PAYSTACK_INITIALIZATION_FAILED" }, 502);
    }

    const { error: updateError } = await supabase
      .from("payments")
      .update({
        paystack_authorization_url: paystackData.data.authorization_url,
        paystack_access_code: paystackData.data.access_code,
      })
      .eq("id", payment.id);
    if (updateError) {
      return c.json({ error: "Checkout was created but could not be finalized", code: "CHECKOUT_RECORD_UPDATE_FAILED" }, 500);
    }

    return c.json({
      data: {
        payment_id: payment.id,
        paystack_reference: reference,
        payment_url: paystackData.data.authorization_url,
        amount: Number(target.price),
        breakdown: {
          programme_price: Number(target.price),
          kanvise_fee: breakdown.kanviseFee,
        }
      }
    }, 201);

  } catch (error: any) {
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

// GET /payments/status/:reference — The return page polls this; it never grants access.
paymentsRouter.get("/status/:reference", async (c) => {
  const user = c.get("user");
  if (user.role !== "student") {
    return c.json({ error: "Only students can view checkout status", code: "FORBIDDEN" }, 403);
  }

  const reference = c.req.param("reference");
  const { data, error } = await supabase
    .from("payments")
    .select("paystack_reference, status, amount, paid_at")
    .eq("paystack_reference", reference)
    .eq("student_id", user.id)
    .maybeSingle();

  if (error) return c.json({ error: "Could not load payment status" }, 500);
  if (!data) return c.json({ error: "Payment not found", code: "PAYMENT_NOT_FOUND" }, 404);
  return c.json({ data });
});

// GET /payments — List all transactions for the school
paymentsRouter.get("/", enforceAdmin, async (c) => {
  try {
    const profile = c.get("user");
    const studentId = c.req.query("student_id");

    let query = supabase
      .from("payments")
      .select(`
        id,
        paystack_reference,
        amount,
        kanvise_fee,
        centre_amount,
        status,
        paid_at,
        created_at,
        student_id,
        user_profiles!payments_student_id_fkey (first_name, last_name, email),
        programmes (id, name),
        sub_programmes (id, name),
        courses (id, name)
      `)
      .eq("school_id", profile.school_id);
    if (studentId) query = query.eq("student_id", studentId);
    const { data: payments, error } = await query
      // School admins need a record of money actually received. Failed and
      // abandoned checkout attempts are operational diagnostics, not income.
      .eq("status", "successful")
      .order("paid_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;

    return c.json({ data: payments });
  } catch (error: any) {
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

// GET /payments/banks — Fetch supported Nigerian banks from Paystack
paymentsRouter.get("/banks", enforceAdmin, async (c) => {
  try {
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecret) return c.json({ error: "Payments are not configured" }, 503);
    const response = await fetch("https://api.paystack.co/bank?country=nigeria", {
      headers: { Authorization: `Bearer ${paystackSecret}` },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`Paystack error: ${response.statusText}`);
    }

    const data = await response.json();
    return c.json({ data: data.data });
  } catch (error: any) {
    return c.json({ error: error.message || "Failed to fetch banks" }, 500);
  }
});

// POST /payments/subaccount/resolve — Resolve account number with Paystack
paymentsRouter.post("/subaccount/resolve", enforceAdmin, async (c) => {
  try {
    const { account_number, bank_code } = await c.req.json();

    if (!/^\d{10}$/.test(account_number || "") || !/^\d{2,10}$/.test(bank_code || "")) {
      return c.json({ error: "A valid account number and bank code are required" }, 400);
    }
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecret) return c.json({ error: "Payments are not configured" }, 503);

    const params = new URLSearchParams({ account_number, bank_code });
    const response = await fetch(`https://api.paystack.co/bank/resolve?${params}`, {
      headers: { Authorization: `Bearer ${paystackSecret}` },
      signal: AbortSignal.timeout(15_000),
    });

    const data = await response.json();

    if (!data.status) {
      return c.json({ error: data.message || "Could not resolve account name" }, 400);
    }

    return c.json({ data: data.data }); // { account_name, account_number }
  } catch (error: any) {
    return c.json({ error: error.message || "Failed to resolve account" }, 500);
  }
});

// POST /payments/subaccount — Create Subaccount on Paystack and save to DB
paymentsRouter.post("/subaccount", enforceAdmin, async (c) => {
  try {
    const profile = c.get("user");
    const { business_name, bank_code, account_number } = await c.req.json();

    if (typeof business_name !== "string" || business_name.trim().length < 2 ||
        !/^\d{2,10}$/.test(bank_code || "") || !/^\d{10}$/.test(account_number || "")) {
      return c.json({ error: "Valid business, bank, and account details are required" }, 400);
    }

    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecret) return c.json({ error: "Payments are not configured" }, 503);

    const { data: existingSubaccount } = await supabase
      .from("paystack_subaccounts")
      .select("subaccount_code")
      .eq("school_id", profile.school_id)
      .maybeSingle();

    // Update the existing Paystack destination instead of leaking a new
    // subaccount every time an administrator edits their payout details.
    const paystackUrl = existingSubaccount?.subaccount_code
      ? `https://api.paystack.co/subaccount/${encodeURIComponent(existingSubaccount.subaccount_code)}`
      : "https://api.paystack.co/subaccount";
    const paystackRes = await fetch(paystackUrl, {
      method: existingSubaccount?.subaccount_code ? "PUT" : "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        business_name: business_name.trim(),
        ...(existingSubaccount?.subaccount_code ? { bank_code } : { settlement_bank: bank_code }),
        account_number,
        percentage_charge: 10.0,
      }),
    });

    const paystackData = await paystackRes.json();

    if (!paystackRes.ok || !paystackData.status || !paystackData.data?.subaccount_code) {
      return c.json({ error: paystackData.message || "Failed to save Paystack subaccount" }, 502);
    }

    const subaccount_code = paystackData.data.subaccount_code;

    // 2. Upsert in our DB
    const { data, error } = await supabase
      .from("paystack_subaccounts")
      .upsert({
        school_id: profile.school_id,
        subaccount_code,
        business_name,
        bank_code,
        account_number,
        percentage_charge: 10.0,
      }, { onConflict: "school_id" })
      .select()
      .single();

    if (error) throw error;

    return c.json({ data });
  } catch (error: any) {
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});
