import { Hono } from "hono";
import { z } from "zod";
import type { TablesUpdate } from "../lib/database.types";
import { supabase } from "../lib/supabase";
import { accountContextMiddleware, jwtVerificationMiddleware, profileResolutionMiddleware } from "../middleware/auth";
import { strictBooleanQuerySchema } from "../lib/api-contract";
import type { AccountContext } from "../types";

type Variables = { user: any; account: AccountContext; jwt_payload: any };

export const coursesRouter = new Hono<{ Variables: Variables }>();

// Subject routes use the current account membership, not the legacy profile
// school/role projection. The projection below keeps the older route body
// implementation and response contracts compatible while making every query
// use the account selected and verified by Hono.
const accountUserProjection = async (c: any, next: any) => {
  const user = c.get("user");
  const account = c.get("account") as AccountContext | undefined;
  if (!account) return c.json({ error: "Tutoring account context is required", code: "ACCOUNT_CONTEXT_REQUIRED" }, 400);
  c.set("user", {
    ...user,
    school_id: account.id,
    role: account.role === "learner" ? "student" : account.role,
  });
  await next();
};

coursesRouter.use("*", jwtVerificationMiddleware, profileResolutionMiddleware, accountContextMiddleware, accountUserProjection);

// Middleware to enforce Admin role
const enforceAdmin = async (c: any, next: any) => {
  const profile = c.get("user");
  if (profile.role !== "admin") {
    return c.json({ error: "Only admins can perform this action", code: "FORBIDDEN" }, 403);
  }
  await next();
};

// Middleware to enforce Admin or Tutor role
const enforceAdminOrTutor = async (c: any, next: any) => {
  const profile = c.get("user");
  if (profile.role !== "admin" && profile.role !== "tutor") {
    return c.json({ error: "Students cannot access curriculum management", code: "FORBIDDEN" }, 403);
  }
  await next();
};

// Create a new course
coursesRouter.post("/", enforceAdmin, async (c) => {
  try {
    const profile = c.get("user");
    if (!profile.school_id) {
      return c.json({ error: "Admin has no school setup", code: "NO_SCHOOL" }, 400);
    }

    const body = await c.req.json();
    const { name, slug, description, price, currency, programme_id, sub_programme_id, is_available_separately, sort_order } = body;

    if (!name || !slug) {
      return c.json({ error: "Missing required fields", code: "BAD_REQUEST" }, 400);
    }

    if (programme_id && sub_programme_id) {
      return c.json({ error: "Cannot specify both programme and sub-programme", code: "INVALID_PARENT" }, 400);
    }
    const isStandalone = !programme_id && !sub_programme_id;
    const availableSeparately = isStandalone || Boolean(is_available_separately);
    if (availableSeparately && (price === '' || !Number.isFinite(parseFloat(price)) || parseFloat(price) < 0)) {
      return c.json({ error: "Choose a free option or enter a valid price", code: "PRICE_REQUIRED" }, 400);
    }

    // Verify parent belongs to school if provided
    if (programme_id) {
      const { data: progCheck } = await supabase
        .from("programmes")
        .select("id")
        .eq("id", programme_id)
        .eq("school_id", profile.school_id)
        .single();
      if (!progCheck) return c.json({ error: "Invalid programme", code: "INVALID_PARENT" }, 400);
    }

    if (sub_programme_id) {
      const { data: subProgCheck } = await supabase
        .from("sub_programmes")
        .select("id")
        .eq("id", sub_programme_id)
        .eq("school_id", profile.school_id)
        .single();
      if (!subProgCheck) return c.json({ error: "Invalid sub-programme", code: "INVALID_PARENT" }, 400);
    }

    // Check slug uniqueness
    const { data: existing, error: checkError } = await supabase
      .from("courses")
      .select("id")
      .eq("school_id", profile.school_id)
      .eq("slug", slug)
      .single();

    if (existing) {
      return c.json({ error: "Slug already in use", code: "SLUG_TAKEN" }, 409);
    }
    if (checkError && checkError.code !== "PGRST116") {
      throw checkError;
    }

    const { data, error } = await supabase
      .from("courses")
      .insert({
        school_id: profile.school_id,
        programme_id: programme_id || null,
        sub_programme_id: sub_programme_id || null,
        name,
        slug,
        description: description || null,
        price: availableSeparately ? parseFloat(price) : 0,
        is_available_separately: availableSeparately,
        currency: currency || "NGN",
        sort_order: Number.isInteger(sort_order) && sort_order >= 0 ? sort_order : 0,
        is_published: false,
        created_by: profile.id
      })
      .select()
      .single();

    if (error) throw error;

    return c.json({ data, message: "Subject created successfully" }, 201);
  } catch (error: any) {
    console.error("POST /courses error:", error);
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

// List all courses for the school
coursesRouter.get("/", enforceAdminOrTutor, async (c) => {
  try {
    const profile = c.get("user");
    if (!profile.school_id) {
      return c.json({ data: [] });
    }

    const programme_id = c.req.query("programme_id");
    const sub_programme_id = c.req.query("sub_programme_id");
    const standalone = c.req.query("standalone");
    const is_published = c.req.query("is_published");
    const parsedStandalone = strictBooleanQuerySchema.safeParse(standalone);
    const parsedIsPublished = strictBooleanQuerySchema.safeParse(is_published);
    if ((standalone !== undefined && !parsedStandalone.success)
      || (is_published !== undefined && !parsedIsPublished.success)) {
      return c.json({ error: "Boolean filters must be true or false", code: "VALIDATION_ERROR" }, 400);
    }

    let query = supabase
      .from("courses")
      .select("*, programme:programmes!courses_programme_id_fkey(name)")
      .eq("school_id", profile.school_id);

    if (programme_id) query = query.eq("programme_id", programme_id);
    if (sub_programme_id) query = query.eq("sub_programme_id", sub_programme_id);
    if (parsedStandalone.success && parsedStandalone.data === "true") {
      query = query.is("programme_id", null).is("sub_programme_id", null);
    }
    if (parsedIsPublished.success) {
      query = query.eq("is_published", parsedIsPublished.data === "true");
    }

    // If tutor, filter by assigned courses
    if (profile.role === "tutor") {
      const { data: assignments, error: assignmentError } = await supabase
        .from("tutor_course_assignments")
        .select("course_id")
        .eq("tutor_id", profile.id)
        .eq("school_id", profile.school_id);

      if (assignmentError) {
        return c.json({ error: "Could not resolve your subject access", code: "SUBJECT_ACCESS_FAILED" }, 500);
      }

      const courseIds = assignments?.map(a => a.course_id) || [];
      if (courseIds.length === 0) {
        return c.json({ data: [] });
      }

      query = query.in("id", courseIds as string[]);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) throw error;

    return c.json({ data });
  } catch (error: any) {
    console.error("GET /courses error:", error?.name || "unknown");
    return c.json({ error: "Could not load subjects", code: "SUBJECT_LIST_FAILED" }, 500);
  }
});

// Get single course (Admin, Tutor, Student if enrolled)
coursesRouter.get("/assignment-overview", enforceAdmin, async (c) => {
  try {
    const profile = c.get("user");
    const [{ data: courses, error: coursesError }, { data: assignments, error: assignmentsError }] = await Promise.all([
      supabase.from("courses").select("id, name, is_published").eq("school_id", profile.school_id).order("name"),
      supabase.from("tutor_course_assignments").select("course_id, tutor_id").eq("school_id", profile.school_id),
    ]);
    if (coursesError) throw coursesError;
    if (assignmentsError) throw assignmentsError;

    const tutorIds = [...new Set((assignments || []).map((assignment) => assignment.tutor_id))];
    let people: any[] = [];
    if (tutorIds.length > 0) {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, kanvise_user_id, first_name, last_name, email, role")
        .eq("school_id", profile.school_id)
        .in("id", tutorIds);
      if (error) throw error;
      people = data || [];
    }

    return c.json({
      data: (courses || []).map((course) => ({
        ...course,
        tutors: (assignments || [])
          .filter((assignment) => assignment.course_id === course.id)
          .map((assignment) => people.find((person) => person.id === assignment.tutor_id))
          .filter(Boolean),
      })),
    });
  } catch (error: any) {
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

// Get single course (Admin, Tutor, Student if enrolled)
coursesRouter.get("/:id", async (c) => {
  try {
    const profile = c.get("user");
    const id = c.req.param("id");

    const { data: course, error } = await supabase
      .from("courses")
      .select("*")
      .eq("id", id)
      .eq("school_id", profile.school_id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return c.json({ error: "Subject not found", code: "NOT_FOUND" }, 404);
      }
      return c.json({ error: "Could not load this subject", code: "SUBJECT_READ_FAILED" }, 500);
    }
    if (!course) return c.json({ error: "Subject not found", code: "NOT_FOUND" }, 404);

    // Access control checks
    if (profile.role === "tutor") {
      const { data: assignment, error: assignmentError } = await supabase
        .from("tutor_course_assignments")
        .select("id")
        .eq("course_id", id)
        .eq("tutor_id", profile.id)
        .eq("school_id", profile.school_id)
        .single();

      if (assignmentError && assignmentError.code !== "PGRST116") {
        return c.json({ error: "Could not verify your subject access", code: "SUBJECT_ACCESS_FAILED" }, 500);
      }
      if (!assignment) {
        return c.json({ error: "Not assigned to this subject", code: "FORBIDDEN" }, 403);
      }
    } else if (profile.role === "student") {
      let parentProgrammeId = course.programme_id;
      if (course.sub_programme_id) {
        const { data: subProgramme, error: subProgrammeError } = await supabase
          .from("sub_programmes")
          .select("programme_id")
          .eq("id", course.sub_programme_id)
          .eq("school_id", profile.school_id)
          .maybeSingle();
        if (subProgrammeError) {
          return c.json({ error: "Could not verify your subject access", code: "SUBJECT_ACCESS_FAILED" }, 500);
        }
        parentProgrammeId = subProgramme?.programme_id || null;
      }

      const targets = [`course_id.eq.${id}`];
      if (course.sub_programme_id) targets.push(`sub_programme_id.eq.${course.sub_programme_id}`);
      if (parentProgrammeId) targets.push(`programme_id.eq.${parentProgrammeId}`);
      const { data: enrolment, error: enrolmentError } = await supabase
        .from("enrolments")
        .select("id")
        .eq("student_id", profile.id)
        .eq("school_id", profile.school_id)
        .or(targets.join(","))
        .limit(1)
        .maybeSingle();

      if (enrolmentError) {
        return c.json({ error: "Could not verify your subject access", code: "SUBJECT_ACCESS_FAILED" }, 500);
      }
      if (!enrolment) return c.json({ error: "Not enrolled in this subject", code: "NOT_ENROLLED" }, 403);
    } else if (profile.role !== "admin") {
      return c.json({ error: "This role cannot access subjects", code: "INSUFFICIENT_ROLE" }, 403);
    }

    const [notes, assignments, mocks, liveClasses] = await Promise.all([
      supabase.from("notes").select("*", { count: "exact", head: true }).eq("course_id", id).eq("school_id", profile.school_id),
      supabase.from("assignments").select("*", { count: "exact", head: true }).eq("course_id", id).eq("school_id", profile.school_id),
      supabase.from("mock_exams").select("*", { count: "exact", head: true }).eq("course_id", id).eq("school_id", profile.school_id),
      supabase.from("live_classes").select("*", { count: "exact", head: true }).eq("course_id", id).eq("school_id", profile.school_id),
    ]);
    const countError = [notes.error, assignments.error, mocks.error, liveClasses.error].find(Boolean);
    if (countError) throw countError;

    const enhancedData = {
      ...course,
      notes_count: notes.count || 0,
      assignments_count: assignments.count || 0,
      mocks_count: mocks.count || 0,
      live_classes_count: liveClasses.count || 0,
    };

    return c.json({ data: enhancedData });
  } catch (error: any) {
    console.error("GET /courses/:id error:", error?.name || "unknown");
    return c.json({ error: "Could not load this subject", code: "SUBJECT_READ_FAILED" }, 500);
  }
});

// Columns a subject PATCH may change. school_id, id, created_by, is_published and
// timestamps are never client-writable (publishing has its own route).
const subjectUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(200),
  description: z.string().max(5000).nullable(),
  price: z.union([z.number().finite(), z.string().max(32)]),
  currency: z.string().trim().min(1).max(8),
  programme_id: z.string().uuid().nullable(),
  sub_programme_id: z.string().uuid().nullable(),
  is_available_separately: z.boolean(),
  sort_order: z.number().int().min(0).max(100000),
}).partial().strict();

// Update course
coursesRouter.patch("/:id", enforceAdmin, async (c) => {
  try {
    const profile = c.get("user");
    const id = c.req.param("id");
    const parsedUpdates = subjectUpdateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsedUpdates.success) {
      return c.json({ error: "Invalid subject update", code: "INVALID_SUBJECT_UPDATE" }, 400);
    }
    const updates: Record<string, any> = { ...parsedUpdates.data };
    if (updates.is_available_separately === false) updates.price = 0;
    if (updates.is_available_separately === true && (updates.price === '' || !Number.isFinite(parseFloat(updates.price)) || parseFloat(updates.price) < 0)) {
      return c.json({ error: "Choose a free option or enter a valid price", code: "PRICE_REQUIRED" }, 400);
    }

    if (updates.programme_id && updates.sub_programme_id) {
      return c.json({ error: "Cannot specify both programme and sub-programme", code: "INVALID_PARENT" }, 400);
    }
    // A new parent must belong to the same account.
    for (const [field, table] of [["programme_id", "programmes"], ["sub_programme_id", "sub_programmes"]] as const) {
      if (!updates[field]) continue;
      const { data: parent } = await supabase
        .from(table)
        .select("id")
        .eq("id", updates[field])
        .eq("school_id", profile.school_id)
        .single();
      if (!parent) return c.json({ error: "Invalid parent", code: "INVALID_PARENT" }, 400);
    }

    const { data, error } = await supabase
      .from("courses")
      .update(updates as TablesUpdate<"courses">)
      .eq("id", id)
      .eq("school_id", profile.school_id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return c.json({ error: "Subject not found", code: "NOT_FOUND" }, 404);

    return c.json({ data, message: "Subject updated" });
  } catch (error: any) {
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

// Publish course
coursesRouter.post("/:id/publish", enforceAdmin, async (c) => {
  try {
    const profile = c.get("user");
    const id = c.req.param("id");

    // Guardrail: Check if at least one tutor is assigned
    const { count, error: countError } = await supabase
      .from("tutor_course_assignments")
      .select("*", { count: "exact", head: true })
      .eq("course_id", id)
      .eq("school_id", profile.school_id);

    if (countError) throw countError;
    if (count === 0) {
      return c.json({ error: "Cannot publish a subject without an assigned tutor", code: "BAD_REQUEST" }, 400);
    }

    const { data, error } = await supabase
      .from("courses")
      .update({ is_published: true })
      .eq("id", id)
      .eq("school_id", profile.school_id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return c.json({ error: "Subject not found", code: "NOT_FOUND" }, 404);

    return c.json({ message: "Subject published" });
  } catch (error: any) {
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

// Soft-delete course
coursesRouter.delete("/:id", enforceAdmin, async (c) => {
  try {
    const profile = c.get("user");
    const id = c.req.param("id");

    const { error } = await supabase
      .from("courses")
      .delete()
      .eq("id", id)
      .eq("school_id", profile.school_id);

    if (error) throw error;

    return c.json({ message: "Subject deleted" });
  } catch (error: any) {
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

// Assign a tutor to a course
coursesRouter.post("/:id/tutors", enforceAdmin, async (c) => {
  try {
    const profile = c.get("user");
    const id = c.req.param("id");
    const { tutor_id } = await c.req.json();

    if (!tutor_id) return c.json({ error: "tutor_id is required", code: "BAD_REQUEST" }, 400);

    const { data: course } = await supabase
      .from("courses")
      .select("id")
      .eq("id", id)
      .eq("school_id", profile.school_id)
      .single();
    if (!course) return c.json({ error: "Subject not found in this school", code: "COURSE_NOT_FOUND" }, 404);

    // Course assignments store user_profiles.id. The dashboard sends that UUID
    // directly; retain Kanvise-ID support for older clients without trying to
    // compare a non-UUID value to the UUID primary-key column.
    const tutorIdentifier = tutor_id === 'self' ? profile.id : tutor_id;
    const isProfileId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tutorIdentifier);
    let tutorQuery = supabase
      .from("user_profiles")
      .select("id, role")
      .eq("school_id", profile.school_id);
    tutorQuery = isProfileId
      ? tutorQuery.eq("id", tutorIdentifier)
      : tutorQuery.eq("kanvise_user_id", tutorIdentifier);
    const { data: tutor } = await tutorQuery.single();

    if (!tutor) return c.json({ error: "Tutor not found in this school", code: "TUTOR_NOT_FOUND" }, 404);
    if (tutor.role !== "tutor" && tutor.role !== "admin") {
      return c.json({ error: "User is not a tutor", code: "NOT_A_TUTOR" }, 400);
    }

    const { error } = await supabase
      .from("tutor_course_assignments")
      .insert({
        school_id: profile.school_id,
        course_id: id,
        tutor_id: tutor.id,
        assigned_by: profile.id
      });

    if (error) {
      if (error.code === '23505') { // Unique violation
        return c.json({ error: "Tutor already assigned to this subject", code: "ALREADY_ASSIGNED" }, 409);
      }
      throw error;
    }

    return c.json({ message: "Tutor assigned to subject" }, 201);
  } catch (error: any) {
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

// Remove a tutor from a course
coursesRouter.delete("/:id/tutors/:tutorId", enforceAdmin, async (c) => {
  try {
    const profile = c.get("user");
    const courseId = c.req.param("id");
    const tutorId = c.req.param("tutorId");

    // Guardrail: If course is published, prevent removing the last tutor
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("is_published")
      .eq("id", courseId)
      .eq("school_id", profile.school_id)
      .single();

    if (courseError) throw courseError;

    if (course.is_published) {
      const { count, error: countError } = await supabase
        .from("tutor_course_assignments")
        .select("*", { count: "exact", head: true })
        .eq("course_id", courseId)
        .eq("school_id", profile.school_id);

      if (countError) throw countError;
      if (count === 1) {
        return c.json({ error: "Cannot remove the last tutor from a published course", code: "BAD_REQUEST" }, 400);
      }
    }

    const { error } = await supabase
      .from("tutor_course_assignments")
      .delete()
      .eq("course_id", courseId)
      .eq("tutor_id", tutorId)
      .eq("school_id", profile.school_id);

    if (error) throw error;

    return c.json({ message: "Tutor removed from subject" });
  } catch (error: any) {
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

// List all tutors assigned to a course
coursesRouter.get("/:id/tutors", enforceAdminOrTutor, async (c) => {
  try {
    const profile = c.get("user");
    const courseId = c.req.param("id");

    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .eq("school_id", profile.school_id)
      .single();
    if (courseError && courseError.code !== "PGRST116") {
      return c.json({ error: "Could not load this subject", code: "SUBJECT_READ_FAILED" }, 500);
    }
    if (!course) return c.json({ error: "Subject not found", code: "NOT_FOUND" }, 404);

    if (profile.role === "tutor") {
      const { data: assignment, error: assignmentError } = await supabase
        .from("tutor_course_assignments")
        .select("id")
        .eq("course_id", courseId)
        .eq("tutor_id", profile.id)
        .eq("school_id", profile.school_id)
        .single();
      if (assignmentError && assignmentError.code !== "PGRST116") {
        return c.json({ error: "Could not verify your subject access", code: "SUBJECT_ACCESS_FAILED" }, 500);
      }
      if (!assignment) return c.json({ error: "Subject not found", code: "NOT_FOUND" }, 404);
    }

    const { data, error } = await supabase
      .from("tutor_course_assignments")
      .select("tutor_id")
      .eq("course_id", courseId)
      .eq("school_id", profile.school_id);

    if (error) {
      return c.json({ error: "Could not load subject tutors", code: "SUBJECT_ASSIGNMENTS_FAILED" }, 500);
    }

    // In a real app we'd join this with user_profiles, but for now just return the assignment rows
    return c.json({ data });
  } catch (error: any) {
    console.error("GET /courses/:id/tutors error:", error?.name || "unknown");
    return c.json({ error: "Could not load subject tutors", code: "SUBJECT_ASSIGNMENTS_FAILED" }, 500);
  }
});
