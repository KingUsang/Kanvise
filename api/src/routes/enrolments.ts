import { Hono } from "hono";
import { z } from "zod";
import { supabase } from "../lib/supabase";
import {
  accountContextMiddleware,
  jwtVerificationMiddleware,
  profileResolutionMiddleware,
  requireMembershipRole,
} from "../middleware/auth";
import type { AccountContext } from "../types";

type Variables = {
  user: any;
  account: AccountContext;
};

export const enrolmentsRouter = new Hono<{ Variables: Variables }>();

const accountUserProjection = async (c: any, next: any) => {
  const user = c.get("user");
  const account = c.get("account") as AccountContext | undefined;
  if (!account) {
    return c.json({ error: "Tutoring account context is required", code: "ACCOUNT_CONTEXT_REQUIRED" }, 400);
  }
  c.set("user", {
    ...user,
    school_id: account.id,
    role: account.role === "learner" ? "student" : account.role,
  });
  await next();
};

enrolmentsRouter.use(
  "*",
  jwtVerificationMiddleware,
  profileResolutionMiddleware,
  accountContextMiddleware,
  accountUserProjection,
);

const enforceAdmin = requireMembershipRole("admin");

// Bounded, validated list contract (DEV-ENR-002).
const listQuerySchema = z.object({
  student_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
});

// GET /enrolments: account-scoped enrolments, newest first, optionally for one Learner.
enrolmentsRouter.get("/", enforceAdmin, async (c) => {
  const parsed = listQuerySchema.safeParse({
    student_id: c.req.query("student_id") || undefined,
    limit: c.req.query("limit") || undefined,
    offset: c.req.query("offset") || undefined,
  });
  if (!parsed.success) return c.json({ error: "Invalid enrolment filters", code: "VALIDATION_ERROR" }, 400);
  const { student_id: studentId, limit, offset } = parsed.data;
  const account = c.get("account");

  let query = supabase
    .from("enrolments")
    .select(`
      id,
      student_id,
      programme_id,
      sub_programme_id,
      course_id,
      enrolled_at,
      programmes!enrolments_programme_id_fkey (id, name),
      sub_programmes!enrolments_sub_programme_id_fkey (id, name),
      courses!enrolments_course_id_fkey (id, name)
    `)
    .eq("school_id", account.id);

  if (studentId) query = query.eq("student_id", studentId);

  // Fetch one extra row to report has_more without a count query.
  const { data, error } = await query
    .order("enrolled_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit);

  if (error) return c.json({ error: "Enrolments are temporarily unavailable", code: "ENROLMENTS_UNAVAILABLE" }, 500);

  const rows = data || [];
  return c.json({ data: rows.slice(0, limit), pagination: { limit, offset, has_more: rows.length > limit } });
});
