import { Hono } from "hono";
import { supabase } from "../lib/supabase";
import { jwtVerificationMiddleware, profileResolutionMiddleware } from "../middleware/auth";

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

    const { programme_id, sub_programme_id, course_id } = await c.req.json();
    if (!programme_id && !sub_programme_id && !course_id) {
      return c.json({ error: "Target ID required", code: "INVALID_ENROLMENT_TARGET" }, 400);
    }

    // 1. Fetch Target & Price
    let table = "";
    let targetId = "";
    if (programme_id) { table = "programmes"; targetId = programme_id; }
    else if (sub_programme_id) { table = "sub_programmes"; targetId = sub_programme_id; }
    else if (course_id) { table = "courses"; targetId = course_id; }

    const { data: target, error: targetError } = await supabase
      .from(table)
      .select("id, name, price, school_id")
      .eq("id", targetId)
      .single();

    if (targetError || !target) {
      return c.json({ error: "Target not found", code: "TARGET_NOT_FOUND" }, 404);
    }

    // Check if already enrolled
    const { data: existingEnrolment } = await supabase
      .from("enrolments")
      .select("id")
      .eq("student_id", user.id)
      .eq(programme_id ? "programme_id" : sub_programme_id ? "sub_programme_id" : "course_id", targetId)
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

    // 3. Initialize Paystack Transaction
    const amountInKobo = Math.round(target.price * 100);
    const reference = `REF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        amount: amountInKobo,
        reference,
        subaccount: subaccount.subaccount_code,
        transaction_charge: Math.round(amountInKobo * (subaccount.percentage_charge / 100)), // Override global setting just in case
        metadata: {
          student_id: user.id,
          school_id: target.school_id,
          programme_id,
          sub_programme_id,
          course_id
        }
      }),
    });

    const paystackData = await paystackRes.json();
    if (!paystackData.status) {
      return c.json({ error: "Payment initiation failed", details: paystackData.message }, 500);
    }

    // 4. Create pending payment record
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        school_id: target.school_id,
        student_id: user.id,
        amount: target.price,
        paystack_reference: reference,
        status: "pending",
        programme_id,
        sub_programme_id,
        course_id,
        kanvise_fee: (target.price * (subaccount.percentage_charge / 100)),
        centre_amount: (target.price * (1 - (subaccount.percentage_charge / 100)))
      })
      .select()
      .single();

    if (paymentError) {
      return c.json({ error: "Failed to record payment" }, 500);
    }

    return c.json({
      data: {
        payment_id: payment.id,
        paystack_reference: reference,
        payment_url: paystackData.data.authorization_url,
        amount: target.price,
        breakdown: {
          programme_price: target.price,
          kanvise_fee: payment.kanvise_fee
        }
      }
    }, 201);

  } catch (error: any) {
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

// GET /payments — List all transactions for the school
paymentsRouter.get("/", enforceAdmin, async (c) => {
  try {
    const profile = c.get("user");

    const { data: payments, error } = await supabase
      .from("payments")
      .select(`
        id,
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
      .eq("school_id", profile.school_id)
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
    const response = await fetch("https://api.paystack.co/bank?country=nigeria", {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
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

    if (!account_number || !bank_code) {
      return c.json({ error: "account_number and bank_code are required" }, 400);
    }

    const response = await fetch(`https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
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

    if (!business_name || !bank_code || !account_number) {
      return c.json({ error: "business_name, bank_code, and account_number are required" }, 400);
    }

    // 1. Create on Paystack (Kanvise takes 10% fee)
    const paystackRes = await fetch("https://api.paystack.co/subaccount", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        business_name,
        settlement_bank: bank_code,
        account_number,
        percentage_charge: 10.0,
      }),
    });

    const paystackData = await paystackRes.json();

    if (!paystackData.status) {
      return c.json({ error: paystackData.message || "Failed to create Paystack subaccount" }, 400);
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
