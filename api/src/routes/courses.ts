import { Hono } from "hono";
import { supabase } from "../lib/supabase";
import { jwtVerificationMiddleware, profileResolutionMiddleware } from "../middleware/auth";

type Variables = {
  user: any;
};

export const coursesRouter = new Hono<{ Variables: Variables }>();

// Apply authentication middleware
coursesRouter.use("*", jwtVerificationMiddleware, profileResolutionMiddleware);

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
    const { name, slug, description, price, currency, programme_id, sub_programme_id } = body;

    if (!name || !slug) {
      return c.json({ error: "Missing required fields", code: "BAD_REQUEST" }, 400);
    }

    if (programme_id && sub_programme_id) {
      return c.json({ error: "Cannot specify both programme and sub-programme", code: "INVALID_PARENT" }, 400);
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
        price: parseFloat(price) || 0,
        currency: currency || "NGN",
        is_published: false,
        created_by: profile.id
      })
      .select()
      .single();

    if (error) throw error;

    return c.json({ data, message: "Course created successfully" }, 201);
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

    let query = supabase
      .from("courses")
      .select("*")
      .eq("school_id", profile.school_id);

    if (programme_id) query = query.eq("programme_id", programme_id);
    if (sub_programme_id) query = query.eq("sub_programme_id", sub_programme_id);
    if (standalone === "true") {
      query = query.is("programme_id", null).is("sub_programme_id", null);
    }
    if (is_published !== undefined) {
      query = query.eq("is_published", is_published === "true");
    }

    // If tutor, filter by assigned courses
    if (profile.role === "tutor") {
      const { data: assignments } = await supabase
        .from("tutor_course_assignments")
        .select("course_id")
        .eq("tutor_id", profile.kanvise_user_id || profile.id)
        .eq("school_id", profile.school_id);
      
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
    console.error("GET /courses error:", error);
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

    if (error || !course) {
      return c.json({ error: "Course not found", code: "NOT_FOUND" }, 404);
    }

    // Access control checks
    if (profile.role === "tutor") {
      const { data: assignment } = await supabase
        .from("tutor_course_assignments")
        .select("id")
        .eq("course_id", id)
        .eq("tutor_id", profile.kanvise_user_id || profile.id)
        .eq("school_id", profile.school_id)
        .single();
        
      if (!assignment) {
        return c.json({ error: "Not assigned to this course", code: "FORBIDDEN" }, 403);
      }
    } else if (profile.role === "student") {
      // TODO: Check enrolments table once mapped
      // For now, block students from direct curriculum fetch until enrolled table exists
      return c.json({ error: "Not enrolled in this course", code: "NOT_ENROLLED" }, 403);
    }

    // Mock content summaries for now since other tables aren't mapped
    const enhancedData = {
      ...course,
      notes_count: 0,
      assignments_count: 0,
      mocks_count: 0,
      live_classes_count: 0
    };

    return c.json({ data: enhancedData });
  } catch (error: any) {
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

// Update course
coursesRouter.patch("/:id", enforceAdmin, async (c) => {
  try {
    const profile = c.get("user");
    const id = c.req.param("id");
    const updates = await c.req.json();
    
    // Prevent spoofing
    delete updates.school_id;
    delete updates.id;

    const { data, error } = await supabase
      .from("courses")
      .update(updates)
      .eq("id", id)
      .eq("school_id", profile.school_id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return c.json({ error: "Course not found", code: "NOT_FOUND" }, 404);

    return c.json({ data, message: "Course updated" });
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
      return c.json({ error: "Cannot publish a course without an assigned tutor", code: "BAD_REQUEST" }, 400);
    }

    const { data, error } = await supabase
      .from("courses")
      .update({ is_published: true })
      .eq("id", id)
      .eq("school_id", profile.school_id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return c.json({ error: "Course not found", code: "NOT_FOUND" }, 404);

    return c.json({ message: "Course published" });
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
    
    return c.json({ message: "Course deleted" });
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

    // Verify tutor exists in this school
    const { data: tutorCheck } = await supabase
      .from("user_profiles")
      .select("id, role")
      .eq("kanvise_user_id", tutor_id) // Or id if they are passing uuid directly, assuming frontend passes kanvise_user_id or id
      .eq("school_id", profile.school_id)
      .single();

    // The query above might fail if tutor_id is UUID but we search against kanvise_user_id which is a string KNV-TUT-...
    // Let's do an OR query
    let tutorQueryId = tutor_id;
    if (tutor_id === 'self') {
      tutorQueryId = profile.id;
    }

    const { data: tutor } = await supabase
      .from("user_profiles")
      .select("id, role")
      .or(`id.eq.${tutorQueryId},kanvise_user_id.eq.${tutorQueryId}`)
      .eq("school_id", profile.school_id)
      .single();

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
        return c.json({ error: "Tutor already assigned to this course", code: "ALREADY_ASSIGNED" }, 409);
      }
      throw error;
    }

    return c.json({ message: "Tutor assigned to course" }, 201);
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
    
    return c.json({ message: "Tutor removed from course" });
  } catch (error: any) {
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

// List all tutors assigned to a course
coursesRouter.get("/:id/tutors", enforceAdminOrTutor, async (c) => {
  try {
    const profile = c.get("user");
    const courseId = c.req.param("id");

    const { data, error } = await supabase
      .from("tutor_course_assignments")
      .select("tutor_id")
      .eq("course_id", courseId)
      .eq("school_id", profile.school_id);

    if (error) throw error;
    
    // In a real app we'd join this with user_profiles, but for now just return the assignment rows
    return c.json({ data });
  } catch (error: any) {
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});
