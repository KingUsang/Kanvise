import { Hono } from "hono";
import { supabase } from "../lib/supabase";
import { jwtVerificationMiddleware, profileResolutionMiddleware } from "../middleware/auth";

type Variables = {
  user: any;
};

export const subProgrammesRouter = new Hono<{ Variables: Variables }>();

// Apply authentication middleware
subProgrammesRouter.use("*", jwtVerificationMiddleware, profileResolutionMiddleware);

// Middleware to enforce Admin role for modifying routes
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

// Create a new sub-programme
subProgrammesRouter.post("/", enforceAdmin, async (c) => {
  try {
    const profile = c.get("user");
    if (!profile.school_id) {
      return c.json({ error: "Admin has no school setup", code: "NO_SCHOOL" }, 400);
    }

    const body = await c.req.json();
    const { name, slug, description, price, currency, programme_id, is_available_separately } = body;

    if (!name || !slug || !programme_id) {
      return c.json({ error: "Missing required fields", code: "BAD_REQUEST" }, 400);
    }
    if (is_available_separately && !(parseFloat(price) > 0)) {
      return c.json({ error: "Enter a price before allowing separate purchase", code: "PRICE_REQUIRED" }, 400);
    }

    // Verify programme exists and belongs to school
    const { data: progCheck, error: progError } = await supabase
      .from("programmes")
      .select("id")
      .eq("id", programme_id)
      .eq("school_id", profile.school_id)
      .single();
      
    if (!progCheck || progError) {
      return c.json({ error: "Invalid programme", code: "INVALID_PARENT" }, 400);
    }

    // Check slug uniqueness within school
    const { data: existing, error: checkError } = await supabase
      .from("sub_programmes")
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
      .from("sub_programmes")
      .insert({
        school_id: profile.school_id,
        programme_id,
        name,
        slug,
        description: description || null,
        price: is_available_separately ? parseFloat(price) || 0 : 0,
        is_available_separately: Boolean(is_available_separately),
        currency: currency || "NGN",
        is_published: false,
        created_by: profile.id
      })
      .select()
      .single();

    if (error) throw error;

    return c.json({ data, message: "Sub-programme created successfully" }, 201);
  } catch (error: any) {
    console.error("POST /sub-programmes error:", error);
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

// List all sub-programmes for the school
subProgrammesRouter.get("/", enforceAdminOrTutor, async (c) => {
  try {
    const profile = c.get("user");
    if (!profile.school_id) {
      return c.json({ data: [] });
    }

    const programme_id = c.req.query("programme_id");
    let query = supabase
      .from("sub_programmes")
      .select("*, courses(id, name)")
      .eq("school_id", profile.school_id);
      
    if (programme_id) {
      query = query.eq("programme_id", programme_id);
    }

    // If tutor, filter by assigned courses
    if (profile.role === "tutor") {
      const { data: assignments } = await supabase
        .from("tutor_course_assignments")
        .select("course_id")
        .eq("tutor_id", profile.id)
        .eq("school_id", profile.school_id);
      
      const courseIds = assignments?.map(a => a.course_id) || [];
      if (courseIds.length === 0) {
        return c.json({ data: [] });
      }
      
      const { data: courses } = await supabase
        .from("courses")
        .select("sub_programme_id")
        .in("id", courseIds)
        .not("sub_programme_id", "is", null);
        
      const subProgIds = [...new Set(courses?.map(c => c.sub_programme_id).filter(Boolean))];
      
      if (subProgIds.length === 0) {
        return c.json({ data: [] });
      }
      
      query = query.in("id", subProgIds as string[]);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) throw error;

    return c.json({ data });
  } catch (error: any) {
    console.error("GET /sub-programmes error:", error);
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

// Update sub-programme
subProgrammesRouter.patch("/:id", enforceAdmin, async (c) => {
  try {
    const profile = c.get("user");
    const id = c.req.param("id");
    const updates = await c.req.json();
    
    // Ensure school_id cannot be spoofed
    delete updates.school_id;
    delete updates.id;
    if (updates.is_available_separately === false) updates.price = 0;
    if (updates.is_available_separately === true && !(parseFloat(updates.price) > 0)) {
      return c.json({ error: "Enter a price before allowing separate purchase", code: "PRICE_REQUIRED" }, 400);
    }

    const { data, error } = await supabase
      .from("sub_programmes")
      .update(updates)
      .eq("id", id)
      .eq("school_id", profile.school_id) // Tenant isolation
      .select()
      .single();

    if (error) throw error;
    if (!data) return c.json({ error: "Sub-programme not found", code: "NOT_FOUND" }, 404);

    return c.json({ data, message: "Sub-programme updated" });
  } catch (error: any) {
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

// Publish sub-programme
subProgrammesRouter.post("/:id/publish", enforceAdmin, async (c) => {
  try {
    const profile = c.get("user");
    const id = c.req.param("id");

    const { data, error } = await supabase
      .from("sub_programmes")
      .update({ is_published: true })
      .eq("id", id)
      .eq("school_id", profile.school_id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return c.json({ error: "Sub-programme not found", code: "NOT_FOUND" }, 404);

    return c.json({ message: "Sub-programme published" });
  } catch (error: any) {
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

// Delete a sub-programme only when doing so cannot remove enrolled content.
subProgrammesRouter.delete("/:id", enforceAdmin, async (c) => {
  try {
    const profile = c.get("user");
    const id = c.req.param("id");

    const { data: subProgramme, error: subProgrammeError } = await supabase
      .from("sub_programmes")
      .select("id, programme_id")
      .eq("id", id)
      .eq("school_id", profile.school_id)
      .maybeSingle();

    if (subProgrammeError) throw subProgrammeError;
    if (!subProgramme) {
      return c.json({ error: "Sub-programme not found", code: "NOT_FOUND" }, 404);
    }

    const { data: childCourses, error: childCoursesError } = await supabase
      .from("courses")
      .select("id")
      .eq("sub_programme_id", id)
      .eq("school_id", profile.school_id);

    if (childCoursesError) throw childCoursesError;

    const enrolmentScopes = [
      `sub_programme_id.eq.${id}`,
      ...(subProgramme.programme_id ? [`programme_id.eq.${subProgramme.programme_id}`] : []),
      ...((childCourses || []).length > 0
        ? [`course_id.in.(${(childCourses || []).map((course) => course.id).join(",")})`]
        : []),
    ];
    const { data: activeEnrolment, error: enrolmentError } = await supabase
      .from("enrolments")
      .select("id")
      .eq("school_id", profile.school_id)
      .or(enrolmentScopes.join(","))
      .limit(1)
      .maybeSingle();

    if (enrolmentError) throw enrolmentError;
    if (activeEnrolment) {
      return c.json({
        error: "Sub-programme cannot be deleted while students are enrolled",
        code: "ACTIVE_ENROLMENTS",
      }, 409);
    }

    const { data: deleted, error } = await supabase
      .from("sub_programmes")
      .delete()
      .eq("id", id)
      .eq("school_id", profile.school_id)
      .select("id")
      .maybeSingle();
      
    if (error) throw error;
    if (!deleted) {
      return c.json({ error: "Sub-programme not found", code: "NOT_FOUND" }, 404);
    }
    
    return c.json({ message: "Sub-programme deleted" });
  } catch (error: any) {
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});
