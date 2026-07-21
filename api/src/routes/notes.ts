import { Hono } from "hono";
import { supabase } from "../lib/supabase";
import { jwtVerificationMiddleware, profileResolutionMiddleware } from "../middleware/auth";
import {
  assertPrivateFileKey,
  createPresignedDownload,
  documentFileType,
  StorageError,
  verifyPrivateUpload,
} from "../storage/r2";

type Variables = {
  user: any;
};

export const notesRouter = new Hono<{ Variables: Variables }>();

// Apply authentication middleware
notesRouter.use("*", jwtVerificationMiddleware, profileResolutionMiddleware);

// Middleware to enforce Admin or Tutor role
const enforceAdminOrTutor = async (c: any, next: any) => {
  const profile = c.get("user");
  if (profile.role !== "admin" && profile.role !== "tutor") {
    return c.json({ error: "Students cannot perform this action", code: "FORBIDDEN" }, 403);
  }
  await next();
};

// Create a new note
notesRouter.post("/:courseId", enforceAdminOrTutor, async (c) => {
  try {
    const profile = c.get("user");
    if (!profile.school_id) {
      return c.json({ error: "User has no school setup", code: "NO_SCHOOL" }, 400);
    }

    const courseId = c.req.param("courseId");
    const body = await c.req.json();
    const { title, description, file_key, file_name, file_type, file_size_bytes } = body;

    if (!title || !file_key || !file_name || !file_type || !file_size_bytes) {
      return c.json({ error: "Missing required fields", code: "BAD_REQUEST" }, 400);
    }

    assertPrivateFileKey(file_key, profile.school_id, "note", courseId);

    // Tenant Check: Ensure the course belongs to the school
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .eq("school_id", profile.school_id)
      .single();

    if (courseError || !course) {
      return c.json({ error: "Course not found", code: "NOT_FOUND" }, 404);
    }

    // Role Check: If tutor, ensure they are assigned to the course
    if (profile.role === "tutor") {
      const { data: assignment, error: assignmentError } = await supabase
        .from("tutor_course_assignments")
        .select("id")
        .eq("tutor_id", profile.id)
        .eq("course_id", courseId)
        .eq("school_id", profile.school_id)
        .single();

      if (assignmentError || !assignment) {
        return c.json({ error: "Not assigned to this course", code: "NOT_ASSIGNED_TO_COURSE" }, 403);
      }
    }

    await verifyPrivateUpload({
      fileKey: file_key,
      schoolId: profile.school_id,
      entityType: "note",
      contextId: courseId,
      contentType: file_type,
      fileSizeBytes: Number(file_size_bytes),
    });

    const { data: reusedFile } = await supabase.from("notes")
      .select("id")
      .eq("school_id", profile.school_id)
      .eq("file_key", file_key)
      .maybeSingle();
    if (reusedFile) {
      return c.json({ error: "File has already been registered", code: "FILE_ALREADY_REGISTERED" }, 409);
    }

    // Insert note
    const { data: note, error: insertError } = await supabase
      .from("notes")
      .insert({
        school_id: profile.school_id,
        course_id: courseId,
        tutor_id: profile.id,
        title,
        description: description || null,
        file_key,
        file_name,
        file_type: documentFileType(file_type),
        file_size_bytes
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return c.json({ data: note, message: "Note created successfully" }, 201);
  } catch (error: any) {
    if (error instanceof StorageError) {
      return c.json({ error: error.message, code: error.code }, error.status);
    }
    console.error(`POST /notes/:courseId error:`, error);
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

// List all notes for a course
notesRouter.get("/:courseId", async (c) => {
  try {
    const profile = c.get("user");
    if (!profile.school_id) {
      return c.json({ data: [] });
    }

    const courseId = c.req.param("courseId");

    // Enrolment / Assignment Check
    if (profile.role === "student") {
      // Must be enrolled in course or its parent programme
      const { data: enrolments } = await supabase
        .from("enrolments")
        .select("programme_id, course_id")
        .eq("student_id", profile.id)
        .eq("school_id", profile.school_id)
        .eq("status", "active");

      const { data: course } = await supabase.from("courses")
        .select("programme_id")
        .eq("id", courseId)
        .eq("school_id", profile.school_id)
        .maybeSingle();
      const hasAccess = Boolean(course) && Boolean(enrolments?.some(e =>
        e.course_id === courseId ||
        (e.programme_id !== null && e.programme_id === course?.programme_id)
      ));
      if (!hasAccess) {
        return c.json({ error: "Not enrolled in course", code: "FORBIDDEN" }, 403);
      }
    } else if (profile.role === "tutor") {
      // Must be assigned to course
      const { data: assignment, error: assignmentError } = await supabase
        .from("tutor_course_assignments")
        .select("id")
        .eq("tutor_id", profile.id)
        .eq("course_id", courseId)
        .eq("school_id", profile.school_id)
        .single();

      if (assignmentError || !assignment) {
        return c.json({ error: "Not assigned to this course", code: "FORBIDDEN" }, 403);
      }
    }

    // Fetch notes with tutor details
    const { data: notes, error } = await supabase
      .from("notes")
      .select(`
        *,
        tutor:user_profiles!notes_tutor_id_fkey(id, first_name, last_name)
      `)
      .eq("course_id", courseId)
      .eq("school_id", profile.school_id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Generate download_url for each note to match API Spec
    const enhancedNotes = await Promise.all((notes || []).map(async (note) => {
      const download_url = await createPresignedDownload(note.file_key, profile.school_id);
      return {
        ...note,
        download_url
      };
    }));

    return c.json({ data: enhancedNotes });
  } catch (error: any) {
    console.error(`GET /notes/:courseId error:`, error);
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

// Delete a note
notesRouter.delete("/:id", enforceAdminOrTutor, async (c) => {
  try {
    const profile = c.get("user");
    const id = c.req.param("id");

    const { data: note, error: fetchError } = await supabase
      .from("notes")
      .select("tutor_id")
      .eq("id", id)
      .eq("school_id", profile.school_id)
      .single();

    if (fetchError || !note) {
      return c.json({ error: "Note not found", code: "NOT_FOUND" }, 404);
    }

    // Only admin or the tutor who created it can delete
    if (profile.role === "tutor" && note.tutor_id !== profile.id) {
      return c.json({ error: "Cannot delete another tutor's note", code: "FORBIDDEN" }, 403);
    }

    const { error: deleteError } = await supabase
      .from("notes")
      .delete()
      .eq("id", id)
      .eq("school_id", profile.school_id);

    if (deleteError) throw deleteError;

    // File deletion in R2 is left to background job, as per spec.
    return c.json({ message: "Note deleted successfully" });
  } catch (error: any) {
    console.error(`DELETE /notes/:id error:`, error);
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});
