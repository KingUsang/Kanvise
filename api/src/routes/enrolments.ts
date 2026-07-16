import { Hono } from "hono";
import { supabase } from "../lib/supabase";
import { jwtVerificationMiddleware, profileResolutionMiddleware } from "../middleware/auth";

type Variables = {
  user: any;
};

export const enrolmentsRouter = new Hono<{ Variables: Variables }>();

enrolmentsRouter.use("*", jwtVerificationMiddleware, profileResolutionMiddleware);

// Middleware to enforce Admin role
const enforceAdmin = async (c: any, next: any) => {
  const profile = c.get("user");
  if (profile.role !== "admin") {
    return c.json({ error: "Only admins can perform this action", code: "FORBIDDEN" }, 403);
  }
  await next();
};

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
        course_id,
        enrolled_at,
        programmes (id, name),
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
