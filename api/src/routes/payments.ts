import { Hono } from "hono";
import { supabase } from "../lib/supabase";
import { jwtVerificationMiddleware, profileResolutionMiddleware, tenantMiddleware } from "../middleware/auth";

export const paymentsRouter = new Hono<{ Variables: { user: any; jwt_payload?: any } }>();

// Require authentication and tenant context for all payment queries
paymentsRouter.use("*", jwtVerificationMiddleware);
paymentsRouter.use("*", profileResolutionMiddleware);
paymentsRouter.use("*", tenantMiddleware);

// ---------------------------------------------------------------------------
// 1. GET / - List Payments (Admin views all in school; Student views own)
// ---------------------------------------------------------------------------
paymentsRouter.get("/", async (c) => {
  const user = c.get("user");
  const statusFilter = c.req.query("status");
  const studentFilter = c.req.query("student_id");
  const page = Number(c.req.query("page")) || 1;
  const limit = Number(c.req.query("limit")) || 20;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("payments")
    .select(`
      *,
      student:user_profiles!student_id(id, first_name, last_name, email, kanvise_user_id),
      programme:programmes(id, name),
      sub_programme:sub_programmes(id, name),
      course:courses(id, name)
    `, { count: "exact" })
    .eq("school_id", user.school_id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // Role-based filtering
  if (user.role === "student") {
    // Students can only ever see their own payments
    query = query.eq("student_id", user.id);
  } else if (user.role === "admin" && studentFilter) {
    // Admins can filter by specific student
    query = query.eq("student_id", studentFilter);
  }

  // Status filter
  if (statusFilter && ["pending", "successful", "failed"].includes(statusFilter)) {
    query = query.eq("status", statusFilter);
  }

  const { data: payments, error, count } = await query;

  if (error) return c.json({ error: error.message }, 500);

  return c.json({
    data: payments || [],
    meta: {
      total: count || 0,
      page,
      limit
    }
  }, 200);
});

// ---------------------------------------------------------------------------
// 2. GET /:id - Get Single Payment Details
// ---------------------------------------------------------------------------
paymentsRouter.get("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  let query = supabase
    .from("payments")
    .select(`
      *,
      student:user_profiles!student_id(id, first_name, last_name, email, kanvise_user_id),
      programme:programmes(id, name),
      sub_programme:sub_programmes(id, name),
      course:courses(id, name)
    `)
    .eq("id", id)
    .eq("school_id", user.school_id);

  if (user.role === "student") {
    query = query.eq("student_id", user.id);
  }

  const { data: payment, error } = await query.single();

  if (error || !payment) {
    return c.json({ error: "Payment transaction not found", code: "NOT_FOUND" }, 404);
  }

  return c.json({ data: payment }, 200);
});
