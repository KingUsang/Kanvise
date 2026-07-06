import { Hono } from "hono";
import { supabase } from "../lib/supabase";
import { jwtVerificationMiddleware, profileResolutionMiddleware, tenantMiddleware } from "../middleware/auth";
import crypto from "crypto";

export const enrolmentsRouter = new Hono<{ Variables: { user: any; jwt_payload?: any } }>();

// ---------------------------------------------------------------------------
// 1. POST /internal/payments/confirm - Internal Webhook Confirmation
// Note: This endpoint is unauthenticated by JWT, but verified via Internal-Secret header
// ---------------------------------------------------------------------------
enrolmentsRouter.post("/internal/payments/confirm", async (c) => {
  const internalSecret = c.req.header("X-Kanvise-Internal-Secret");
  const expectedSecret = process.env.KANVISE_INTERNAL_SECRET || "kanvise_internal_dev_secret";

  if (internalSecret !== expectedSecret) {
    return c.json({ error: "Unauthorized internal call", code: "UNAUTHORIZED_INTERNAL" }, 401);
  }

  const body = await c.req.json();
  const { paystack_reference, paystack_transaction_id } = body;

  if (!paystack_reference) {
    return c.json({ error: "paystack_reference is required", code: "MISSING_PARAMS" }, 400);
  }

  // 1. Find the pending payment
  const { data: payment, error: payErr } = await supabase
    .from("payments")
    .select("*")
    .eq("paystack_reference", paystack_reference)
    .single();

  if (payErr || !payment) {
    return c.json({ error: "Payment record not found", code: "PAYMENT_NOT_FOUND" }, 404);
  }

  // If already successful, idempotent return
  if (payment.status === "successful") {
    return c.json({ message: "Enrolment already created and access granted" }, 200);
  }

  // 2. Update payment status to successful
  const now = new Date().toISOString();
  await supabase
    .from("payments")
    .update({
      status: "successful",
      paid_at: now,
      paystack_transaction_id: paystack_transaction_id ? String(paystack_transaction_id) : null
    })
    .eq("id", payment.id);

  // 3. Create the enrolment record
  const { error: enrolErr } = await supabase
    .from("enrolments")
    .insert({
      school_id: payment.school_id,
      student_id: payment.student_id,
      programme_id: payment.programme_id || null,
      sub_programme_id: payment.sub_programme_id || null,
      course_id: payment.course_id || null,
      payment_id: payment.id,
      enrolled_at: now
    });

  if (enrolErr && enrolErr.code !== "23505") { // Ignore unique constraint duplicate if any
    console.error("Error creating enrolment from webhook:", enrolErr);
    return c.json({ error: enrolErr.message }, 500);
  }

  // 4. Send notification to student
  await supabase
    .from("notifications")
    .insert({
      school_id: payment.school_id,
      user_id: payment.student_id,
      type: "enrolment_confirmed",
      title: "Enrolment Confirmed 🎉",
      body: `Your payment of NGN ${payment.amount} was successful. Welcome to your course!`,
      is_read: false,
      related_entity_type: payment.programme_id ? "programme" : (payment.sub_programme_id ? "sub_programme" : "course"),
      related_entity_id: payment.programme_id || payment.sub_programme_id || payment.course_id
    });

  return c.json({ message: "Enrolment created and access granted" }, 200);
});

// All other enrolment endpoints require student or user authentication
enrolmentsRouter.use("*", jwtVerificationMiddleware);
enrolmentsRouter.use("*", profileResolutionMiddleware);
enrolmentsRouter.use("*", tenantMiddleware);

// ---------------------------------------------------------------------------
// 2. POST /initiate - Initiate Course/Programme Enrolment & Checkout
// ---------------------------------------------------------------------------
enrolmentsRouter.post("/initiate", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const { programme_id, sub_programme_id, course_id } = body;

  // Enrolment Scope Constraint: Exactly one target must be provided
  const targetCount = [programme_id, sub_programme_id, course_id].filter(Boolean).length;
  if (targetCount !== 1) {
    return c.json({
      error: "Exactly one of programme_id, sub_programme_id, or course_id must be provided.",
      code: "INVALID_ENROLMENT_TARGET"
    }, 400);
  }

  // 1. Check if user is already enrolled
  let checkQuery = supabase
    .from("enrolments")
    .select("id")
    .eq("student_id", user.id)
    .eq("school_id", user.school_id);

  if (programme_id) checkQuery = checkQuery.eq("programme_id", programme_id);
  if (sub_programme_id) checkQuery = checkQuery.eq("sub_programme_id", sub_programme_id);
  if (course_id) checkQuery = checkQuery.eq("course_id", course_id);

  const { data: existingEnrol } = await checkQuery.single();
  if (existingEnrol) {
    return c.json({
      error: "You are already enrolled in this offering.",
      code: "ALREADY_ENROLLED"
    }, 409);
  }

  // 2. Fetch the target offering details & price
  let targetTable = "courses";
  let targetId = course_id;
  if (programme_id) { targetTable = "programmes"; targetId = programme_id; }
  else if (sub_programme_id) { targetTable = "sub_programmes"; targetId = sub_programme_id; }

  const { data: offering, error: offErr } = await supabase
    .from(targetTable)
    .select("id, name, price, school_id, currency")
    .eq("id", targetId)
    .single();

  if (offErr || !offering) {
    return c.json({ error: "Enrolment target not found.", code: "TARGET_NOT_FOUND" }, 404);
  }

  const price = Number(offering.price) || 0;
  const now = new Date().toISOString();

  // -------------------------------------------------------------------------
  // PATH A: FREE COURSE (price === 0)
  // Instant enrolment without hitting payment gateway
  // -------------------------------------------------------------------------
  if (price === 0) {
    const freeRef = `FREE-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    // Create a zero-amount successful payment record to satisfy FK constraint
    const { data: payment, error: payErr } = await supabase
      .from("payments")
      .insert({
        school_id: offering.school_id,
        student_id: user.id,
        programme_id: programme_id || null,
        sub_programme_id: sub_programme_id || null,
        course_id: course_id || null,
        amount: 0,
        kanvise_fee: 0,
        centre_amount: 0,
        currency: offering.currency || "NGN",
        paystack_reference: freeRef,
        status: "successful",
        paid_at: now
      })
      .select()
      .single();

    if (payErr) return c.json({ error: payErr.message }, 500);

    // Create active enrolment record
    const { data: enrolment, error: enrolErr } = await supabase
      .from("enrolments")
      .insert({
        school_id: offering.school_id,
        student_id: user.id,
        programme_id: programme_id || null,
        sub_programme_id: sub_programme_id || null,
        course_id: course_id || null,
        payment_id: payment.id,
        enrolled_at: now
      })
      .select()
      .single();

    if (enrolErr) return c.json({ error: enrolErr.message }, 500);

    // Send instant confirmation notification
    await supabase
      .from("notifications")
      .insert({
        school_id: offering.school_id,
        user_id: user.id,
        type: "enrolment_confirmed",
        title: "Enrolment Confirmed 🎉",
        body: `You have successfully enrolled in the free course: ${offering.name}.`,
        is_read: false,
        related_entity_type: targetTable.replace("s", ""), // e.g. "course"
        related_entity_id: targetId
      });

    return c.json({
      status: "enrolled",
      message: "Enrolment successful for free course",
      data: {
        enrolment,
        payment_reference: freeRef
      }
    }, 201);
  }

  // -------------------------------------------------------------------------
  // PATH B: PAID COURSE (price > 0)
  // Initialize Paystack split payment with subaccount
  // -------------------------------------------------------------------------
  const reference = `KV-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

  // Check if school has a configured Paystack subaccount for split payment
  const { data: subaccount } = await supabase
    .from("paystack_subaccounts")
    .select("subaccount_code, percentage_charge")
    .eq("school_id", offering.school_id)
    .single();

  // Calculate platform split (default 5% if subaccount percentage not specified)
  const percentageCharge = subaccount?.percentage_charge ? Number(subaccount.percentage_charge) : 5.0;
  const kanviseFee = Number((price * (percentageCharge / 100)).toFixed(2));
  const centreAmount = Number((price - kanviseFee).toFixed(2));

  // Record pending payment in database
  const { data: pendingPayment, error: payErr } = await supabase
    .from("payments")
    .insert({
      school_id: offering.school_id,
      student_id: user.id,
      programme_id: programme_id || null,
      sub_programme_id: sub_programme_id || null,
      course_id: course_id || null,
      amount: price,
      kanvise_fee: kanviseFee,
      centre_amount: centreAmount,
      currency: offering.currency || "NGN",
      paystack_reference: reference,
      status: "pending"
    })
    .select()
    .single();

  if (payErr) return c.json({ error: payErr.message }, 500);

  // Initialize Paystack transaction
  let paystackUrl = `https://checkout.paystack.com/pay/${reference}`;
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;

  if (paystackSecret && paystackSecret !== "placeholder_key" && !paystackSecret.includes("placeholder")) {
    try {
      const paystackPayload: any = {
        email: user.email || `${user.kanvise_user_id || "student"}@kanvise.ng`,
        amount: Math.round(price * 100), // Convert NGN to Kobo
        reference: reference,
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/student/my-courses?enrolment=success`,
        metadata: {
          student_id: user.id,
          school_id: offering.school_id,
          programme_id: programme_id || null,
          sub_programme_id: sub_programme_id || null,
          course_id: course_id || null,
          payment_id: pendingPayment.id
        }
      };

      // Add split subaccount if available
      if (subaccount?.subaccount_code) {
        paystackPayload.subaccount = subaccount.subaccount_code;
        paystackPayload.transaction_charge = Math.round(kanviseFee * 100); // Kanvise fee in kobo
      }

      const res = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(paystackPayload)
      });

      if (res.ok) {
        const pData = await res.json() as any;
        if (pData.status && pData.data?.authorization_url) {
          paystackUrl = pData.data.authorization_url;
        }
      } else {
        console.warn("[Paystack] API call failed during initialization:", await res.text());
      }
    } catch (err) {
      console.error("[Paystack] Error connecting to Paystack API:", err);
    }
  }

  return c.json({
    status: "payment_required",
    data: {
      payment_id: pendingPayment.id,
      paystack_reference: reference,
      payment_url: paystackUrl,
      amount: price,
      breakdown: {
        programme_price: centreAmount,
        kanvise_fee: kanviseFee
      }
    }
  }, 201);
});

// ---------------------------------------------------------------------------
// 3. GET / - List Current Student's Enrolments
// ---------------------------------------------------------------------------
enrolmentsRouter.get("/", async (c) => {
  const user = c.get("user");

  const { data: enrolments, error } = await supabase
    .from("enrolments")
    .select(`
      id,
      enrolled_at,
      programme_id,
      sub_programme_id,
      course_id,
      programme:programmes(id, name, slug, thumbnail_url),
      sub_programme:sub_programmes(id, name, slug),
      course:courses(id, name, slug, description),
      payment:payments(amount, paid_at, status)
    `)
    .eq("student_id", user.id)
    .eq("school_id", user.school_id)
    .order("enrolled_at", { ascending: false });

  if (error) return c.json({ error: error.message }, 500);

  // Transform to clean frontend schema
  const formatted = (enrolments || []).map((e: any) => ({
    id: e.id,
    enrolled_at: e.enrolled_at,
    type: e.programme_id ? "programme" : (e.sub_programme_id ? "sub_programme" : "course"),
    programme: e.programme || null,
    sub_programme: e.sub_programme || null,
    course: e.course || null,
    payment: e.payment || null
  }));

  return c.json({ data: formatted }, 200);
});
