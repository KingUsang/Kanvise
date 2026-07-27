import { Hono } from "hono";
import { supabase } from "../lib/supabase";
import { jwtVerificationMiddleware, profileResolutionMiddleware } from "../middleware/auth";
import { publicFileUrl } from "../storage/r2";

type Variables = {
  user: any;
};

export const usersRouter = new Hono<{ Variables: Variables }>();

usersRouter.use("*", jwtVerificationMiddleware, profileResolutionMiddleware);

// Middleware to enforce Admin role
const enforceAdmin = async (c: any, next: any) => {
  const profile = c.get("user");
  if (profile.role !== "admin") {
    return c.json({ error: "Only admins can perform this action", code: "FORBIDDEN" }, 403);
  }
  await next();
};

// GET /users/tutors — List tutors with their assigned courses
// Must be defined BEFORE /:id to avoid route collision
usersRouter.get("/tutors", enforceAdmin, async (c) => {
  try {
    const profile = c.get("user");

    // 1. Fetch everyone who can teach. An admin becomes a solo tutor only
    // when they have a course assignment, so include them for the assignment
    // join below and filter unassigned admins out of the teaching-team list.
    const { data: teachingPeople, error: tutorsError } = await supabase
      .from("user_profiles")
      .select("id, kanvise_user_id, first_name, last_name, email, bio, profile_photo_key, role")
      .eq("school_id", profile.school_id)
      .in("role", ["tutor", "admin"])
      .order("created_at", { ascending: false });

    if (tutorsError) throw tutorsError;
    if (!teachingPeople || teachingPeople.length === 0) return c.json({ data: [] });

    // 2. Fetch tutor_course_assignments for all these tutors
    // tutor_id in assignments is user_profiles.id (UUID)
    const tutorIds = teachingPeople.map((t) => t.id);
    const { data: assignments, error: assignError } = await supabase
      .from("tutor_course_assignments")
      .select("tutor_id, course_id")
      .eq("school_id", profile.school_id)
      .in("tutor_id", tutorIds);

    if (assignError) throw assignError;

    // 3. Fetch names for all assigned courses
    const courseIds = [...new Set((assignments || []).map((a) => a.course_id))];
    let courses: { id: string; name: string }[] = [];

    if (courseIds.length > 0) {
      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .select("id, name")
        .eq("school_id", profile.school_id)
        .in("id", courseIds);

      if (courseError) throw courseError;
      courses = courseData || [];
    }

    // 4. Join in JS
    const tutorsWithCourses = teachingPeople.map((tutor) => {
      const tutorAssignments = (assignments || []).filter((a) => a.tutor_id === tutor.id);
      const tutorCourses = tutorAssignments
        .map((a) => courses.find((c) => c.id === a.course_id))
        .filter((c): c is { id: string; name: string } => Boolean(c));
      return { ...tutor, courses: tutorCourses };
    }).filter((person) => person.role === "tutor" || person.courses.length > 0);

    return c.json({ data: tutorsWithCourses });
  } catch (error: any) {
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

// GET /users/students — List students with their active enrolments
usersRouter.get("/students", enforceAdmin, async (c) => {
  try {
    const profile = c.get("user");

    // 1. Fetch all students in this school
    const { data: students, error: studentsError } = await supabase
      .from("user_profiles")
      .select("id, kanvise_user_id, first_name, last_name, email, profile_photo_key, role")
      .eq("school_id", profile.school_id)
      .eq("role", "student")
      .order("created_at", { ascending: false });

    if (studentsError) throw studentsError;
    if (!students || students.length === 0) return c.json({ data: [] });

    // 2. Fetch enrolments for all these students
    const studentIds = students.map((s) => s.id);
    const { data: enrolments, error: enrolmentsError } = await supabase
      .from("enrolments")
      .select(`
        id, 
        student_id,
        enrolled_at,
        programmes (id, name),
        sub_programmes (id, name),
        courses (id, name)
      `)
      .eq("school_id", profile.school_id)
      .in("student_id", studentIds);

    if (enrolmentsError) throw enrolmentsError;

    // 3. Join in JS
    const studentsWithEnrolments = students.map((student) => {
      const studentEnrolments = (enrolments || []).filter((e) => e.student_id === student.id);
      let profilePhotoUrl: string | null = null;
      if (student.profile_photo_key && process.env.R2_PUBLIC_BASE_URL) {
        profilePhotoUrl = publicFileUrl(student.profile_photo_key);
      }
      return {
        ...student,
        profile_photo_url: profilePhotoUrl,
        enrolments: studentEnrolments,
      };
    });

    return c.json({ data: studentsWithEnrolments });
  } catch (error: any) {
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

// GET /users — List all users in the school, filterable by role
usersRouter.get("/", enforceAdmin, async (c) => {
  try {
    const profile = c.get("user");
    const role = c.req.query("role");
    const rolesParam = c.req.query("roles");

    let query = supabase
      .from("user_profiles")
      .select("id, kanvise_user_id, role, first_name, last_name, email, profile_photo_key")
      .eq("school_id", profile.school_id);

    if (rolesParam) {
      const rolesArray = rolesParam.split(",");
      query = query.in("role", rolesArray);
    } else if (role) {
      query = query.eq("role", role);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) throw error;

    return c.json({ data });
  } catch (error: any) {
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

// DELETE /users/:id — Soft-remove a user from the school (sets school_id = null)
usersRouter.delete("/:id", enforceAdmin, async (c) => {
  try {
    const profile = c.get("user");
    const id = c.req.param("id");

    // Guard: admin cannot remove themselves
    if (id === profile.id) {
      return c.json({ error: "You cannot remove yourself from the school", code: "CANNOT_REMOVE_SELF" }, 403);
    }

    // Verify the user belongs to this school
    const { data: target, error: fetchError } = await supabase
      .from("user_profiles")
      .select("id, role, first_name, last_name, school_id")
      .eq("id", id)
      .eq("school_id", profile.school_id)
      .single();

    if (fetchError || !target) {
      return c.json({ error: "User not found in this school", code: "USER_NOT_FOUND" }, 404);
    }

    // Soft-delete: strip school linkage, preserving all historical rows
    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({ school_id: null })
      .eq("id", id)
      .eq("school_id", profile.school_id); // tenant-safe double-check

    if (updateError) throw updateError;

    return c.json({ message: "User removed from school" });
  } catch (error: any) {
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});
