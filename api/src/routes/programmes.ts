import { Hono } from "hono";
import { supabase } from "../lib/supabase";
import { jwtVerificationMiddleware } from "../middleware/auth";
import { profileResolutionMiddleware } from "../middleware/auth";

type Variables = {
  user: any;
};

export const programmesRouter = new Hono<{ Variables: Variables }>();

// Apply authentication middleware
programmesRouter.use("*", jwtVerificationMiddleware, profileResolutionMiddleware);

// Middleware to enforce Admin role for modifying routes
const enforceAdmin = async (c: any, next: any) => {
  const profile = c.get("user");
  if (profile.role !== "admin") {
    return c.json({ error: "Only admins can perform this action", code: "FORBIDDEN" }, 403);
  }
  await next();
};

// Middleware to enforce Admin or Tutor role (blocks students)
const enforceAdminOrTutor = async (c: any, next: any) => {
  const profile = c.get("user");
  if (profile.role !== "admin" && profile.role !== "tutor") {
    return c.json({ error: "Students cannot access curriculum management", code: "FORBIDDEN" }, 403);
  }
  await next();
};

// Create a new programme
programmesRouter.post("/", enforceAdmin, async (c) => {
  try {
    const profile = c.get("user");
    if (!profile.school_id) {
      return c.json({ error: "Admin has no school setup", code: "NO_SCHOOL" }, 400);
    }

    const body = await c.req.json();
    const { name, slug, description, price, currency, is_published } = body;

    if (!name || !slug) {
      return c.json({ error: "Missing required fields", code: "BAD_REQUEST" }, 400);
    }

    // Check slug uniqueness within school
    const { data: existing, error: checkError } = await supabase
      .from("programmes")
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
      .from("programmes")
      .insert({
        school_id: profile.school_id,
        name,
        slug,
        description: description || null,
        price: parseFloat(price) || 0,
        currency: currency || "NGN",
        thumbnail_url: null,
        is_published: typeof is_published === 'boolean' ? is_published : false,
        created_by: profile.id
      })
      .select()
      .single();

    if (error) throw error;

    return c.json({ data, message: "Programme created successfully" }, 201);
  } catch (error: any) {
    console.error("POST /programmes error:", error);
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

// List all programmes for the school
programmesRouter.get("/", enforceAdminOrTutor, async (c) => {
  try {
    const profile = c.get("user");
    if (!profile.school_id) {
      return c.json({ data: [] });
    }

    const is_published = c.req.query("is_published");

    let query = supabase
      .from("programmes")
      .select("*, sub_programmes(count), courses(count), enrolments(count)")
      .eq("school_id", profile.school_id);

    if (is_published !== undefined) {
      query = query.eq("is_published", is_published === "true");
    }

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
      
      const { data: courses } = await supabase
        .from("courses")
        .select("programme_id")
        .in("id", courseIds)
        .not("programme_id", "is", null);
        
      const programmeIds = [...new Set(courses?.map(c => c.programme_id).filter(Boolean))];
      
      if (programmeIds.length === 0) {
        return c.json({ data: [] });
      }
      
      query = query.in("id", programmeIds as string[]);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) throw error;

    const enhancedData = data.map(prog => ({
      ...prog,
      sub_programmes_count: prog.sub_programmes?.[0]?.count || 0,
      courses_count: prog.courses?.[0]?.count || 0,
      enrolled_count: prog.enrolments?.[0]?.count || 0,
    }));

    return c.json({ data: enhancedData });
  } catch (error: any) {
    console.error("GET /programmes error:", error);
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

// Get single programme
programmesRouter.get("/:id", enforceAdminOrTutor, async (c) => {
  try {
    const profile = c.get("user");
    const id = c.req.param("id");

    const { data, error } = await supabase
      .from("programmes")
      .select("*, sub_programmes(*), courses(*), enrolments(count)")
      .eq("id", id)
      .eq("school_id", profile.school_id)
      .single();

    if (error) throw error;
    if (!data) return c.json({ error: "Programme not found", code: "NOT_FOUND" }, 404);

    return c.json({ data: { ...data, enrolled_count: data.enrolments?.[0]?.count || 0 } });
  } catch (error: any) {
    console.error("GET /programmes/:id error:", error);
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

// Update programme
programmesRouter.patch("/:id", enforceAdmin, async (c) => {
  try {
    const profile = c.get("user");
    const id = c.req.param("id");
    const body = await c.req.json();
    
    const { name, description, price, is_published } = body;
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (price !== undefined) updates.price = parseFloat(price);
    if (typeof is_published === 'boolean') updates.is_published = is_published;

    const { data, error } = await supabase
      .from("programmes")
      .update(updates)
      .eq("id", id)
      .eq("school_id", profile.school_id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return c.json({ error: "Programme not found", code: "NOT_FOUND" }, 404);

    return c.json({ data, message: "Programme updated successfully" });
  } catch (error: any) {
    console.error("PATCH /programmes/:id error:", error);
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

// Publish programme
programmesRouter.post("/:id/publish", enforceAdmin, async (c) => {
  try {
    const profile = c.get("user");
    const id = c.req.param("id");

    // Check if programme has courses
    const { count, error: countError } = await supabase
      .from("courses")
      .select("*", { count: "exact", head: true })
      .eq("programme_id", id)
      .eq("school_id", profile.school_id);

    if (countError) throw countError;
    if (count === 0) {
      return c.json({ 
        error: "A programme must have at least one course before it can be published.", 
        code: "NO_COURSES_IN_PROGRAMME" 
      }, 400);
    }

    const { data, error } = await supabase
      .from("programmes")
      .update({ is_published: true })
      .eq("id", id)
      .eq("school_id", profile.school_id)
      .select()
      .single();

    if (error) throw error;
    return c.json({ message: "Programme published", data });
  } catch (error: any) {
    console.error("POST /programmes/:id/publish error:", error);
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

// Unpublish programme
programmesRouter.post("/:id/unpublish", enforceAdmin, async (c) => {
  try {
    const profile = c.get("user");
    const id = c.req.param("id");

    const { data, error } = await supabase
      .from("programmes")
      .update({ is_published: false })
      .eq("id", id)
      .eq("school_id", profile.school_id)
      .select()
      .single();

    if (error) throw error;
    return c.json({ message: "Programme unpublished", data });
  } catch (error: any) {
    console.error("POST /programmes/:id/unpublish error:", error);
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

// Delete programme
programmesRouter.delete("/:id", enforceAdmin, async (c) => {
  try {
    const profile = c.get("user");
    const id = c.req.param("id");

    // Must check for active enrolments (mocked condition for now based on spec)
    const { count: enrolmentsCount, error: countError } = await supabase
      .from("enrolments")
      .select("*", { count: "exact", head: true })
      .eq("programme_id", id)
      .eq("school_id", profile.school_id);
      
    if (countError && countError.code !== "42P01") {
      throw countError;
    }
    
    if (enrolmentsCount && enrolmentsCount > 0) {
      return c.json({ error: "Cannot delete programme with active enrolments", code: "ACTIVE_ENROLMENTS_EXIST" }, 409);
    }

    const { error } = await supabase
      .from("programmes")
      .delete()
      .eq("id", id)
      .eq("school_id", profile.school_id);

    if (error) throw error;
    return c.json({ message: "Programme deleted" });
  } catch (error: any) {
    console.error("DELETE /programmes/:id error:", error);
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});
