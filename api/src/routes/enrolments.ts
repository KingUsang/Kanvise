import { Hono } from "hono";
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

// GET /enrolments — List all enrolments for the school, optionally filtered by student_id
enrolmentsRouter.get("/", enforceAdmin, async (c) => {
  try {
    const profile = c.get("user");
    const studentId = c.req.query("student_id");

    let query = supabase
      .from("enrolments")
      .select(`
        id,
        student_id,
        programme_id,
        sub_programme_id,
        course_id,
        enrolled_at,
        programmes (id, name),
        sub_programmes (id, name),
        courses (id, name)
      `)
      .eq("school_id", profile.school_id);

    if (studentId) {
      query = query.eq("student_id", studentId);
    }

    const { data, error } = await query.order("enrolled_at", { ascending: false });

    if (error) throw error;

    return c.json({ data });
  } catch (error: any) {
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});
