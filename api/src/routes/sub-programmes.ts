import { Hono } from "hono";
import { z } from "zod";
import type { TablesUpdate } from "../lib/database.types";
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

export const subProgrammesRouter = new Hono<{ Variables: Variables }>();

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

subProgrammesRouter.use(
  "*",
  jwtVerificationMiddleware,
  profileResolutionMiddleware,
  accountContextMiddleware,
  accountUserProjection,
);

const enforceAdmin = requireMembershipRole("admin");
const enforceAdminOrTutor = requireMembershipRole("admin", "tutor");

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
      
    // A lookup failure is a service error, not a bad parent (DEV-SUB-005).
    if (progError && progError.code !== "PGRST116") throw progError;
    if (!progCheck) {
      return c.json({ error: "Invalid class", code: "INVALID_PARENT" }, 400);
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

    return c.json({ data, message: "Class section created successfully" }, 201);
  } catch (error: any) {
    console.error("POST /sub-programmes error:", error?.code || error?.name || "unknown");
    return c.json({ error: "Could not create this class section", code: "SUB_PROGRAMME_CREATE_FAILED" }, 500);
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
      .select("*, courses!courses_sub_programme_id_fkey(id, name)")
      .eq("school_id", profile.school_id);
      
    if (programme_id) {
      query = query.eq("programme_id", programme_id);
    }

    // If tutor, filter by assigned courses
    if (profile.role === "tutor") {
      // Lookup failures propagate instead of becoming an empty list (DEV-SUB-002).
      const { data: assignments, error: assignmentError } = await supabase
        .from("tutor_course_assignments")
        .select("course_id")
        .eq("tutor_id", profile.id)
        .eq("school_id", profile.school_id);
      if (assignmentError) throw assignmentError;

      const courseIds = assignments?.map(a => a.course_id) || [];
      if (courseIds.length === 0) {
        return c.json({ data: [] });
      }
      
      const { data: courses, error: coursesError } = await supabase
        .from("courses")
        .select("sub_programme_id")
        .eq("school_id", profile.school_id)
        .in("id", courseIds)
        .not("sub_programme_id", "is", null);
      if (coursesError) throw coursesError;
        
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
    console.error("GET /sub-programmes error:", error?.code || error?.name || "unknown");
    return c.json({ error: "Could not load class sections", code: "SUB_PROGRAMME_LIST_FAILED" }, 500);
  }
});

// Columns a sub-programme PATCH may change. school_id, id, created_by, is_published,
// programme_id and timestamps are not client-writable here.
const subProgrammeUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(200),
  description: z.string().max(5000).nullable(),
  price: z.union([z.number().finite(), z.string().max(32)]),
  currency: z.string().trim().min(1).max(8),
  is_available_separately: z.boolean(),
}).partial().strict();

// Update sub-programme
subProgrammesRouter.patch("/:id", enforceAdmin, async (c) => {
  try {
    const profile = c.get("user");
    const id = c.req.param("id");
    if (!id) return c.json({ error: "Sub-programme not found", code: "NOT_FOUND" }, 404);
    const parsedUpdates = subProgrammeUpdateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsedUpdates.success) {
      return c.json({ error: "Invalid class section update", code: "INVALID_SUB_PROGRAMME_UPDATE" }, 400);
    }
    const updates: Record<string, any> = { ...parsedUpdates.data };
    if (updates.is_available_separately === false) updates.price = 0;
    if (updates.is_available_separately === true && !(parseFloat(updates.price) > 0)) {
      return c.json({ error: "Enter a price before allowing separate purchase", code: "PRICE_REQUIRED" }, 400);
    }

    const { data, error } = await supabase
      .from("sub_programmes")
      .update(updates as TablesUpdate<"sub_programmes">)
      .eq("id", id)
      .eq("school_id", profile.school_id) // Tenant isolation
      .select()
      .single();

    if (error) throw error;
    if (!data) return c.json({ error: "Class section not found", code: "NOT_FOUND" }, 404);

    return c.json({ data, message: "Class section updated" });
  } catch (error: any) {
    return c.json({ error: "Could not update this class section", code: "SUB_PROGRAMME_UPDATE_FAILED" }, 500);
  }
});

// Publish sub-programme
subProgrammesRouter.post("/:id/publish", enforceAdmin, async (c) => {
  try {
    const profile = c.get("user");
    const id = c.req.param("id");
    if (!id) return c.json({ error: "Sub-programme not found", code: "NOT_FOUND" }, 404);

    const { data, error } = await supabase
      .from("sub_programmes")
      .update({ is_published: true })
      .eq("id", id)
      .eq("school_id", profile.school_id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return c.json({ error: "Sub-programme not found", code: "NOT_FOUND" }, 404);

    return c.json({ message: "Class section published" });
  } catch (error: any) {
    return c.json({ error: "Could not publish this class section", code: "SUB_PROGRAMME_PUBLISH_FAILED" }, 500);
  }
});

// Delete a sub-programme only when doing so cannot remove enrolled content.
subProgrammesRouter.delete("/:id", enforceAdmin, async (c) => {
  try {
    const profile = c.get("user");
    const id = c.req.param("id");
    if (!id) return c.json({ error: "Sub-programme not found", code: "NOT_FOUND" }, 404);

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
        error: "Class section cannot be deleted while students are enrolled",
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
    
    return c.json({ message: "Class section deleted" });
  } catch (error: any) {
    return c.json({ error: "Could not delete this class section", code: "SUB_PROGRAMME_DELETE_FAILED" }, 500);
  }
});
