import { enqueueObjectDeletion } from "../jobs/storage-cleanup";
import { Hono } from "hono";
import { supabase } from "../lib/supabase";
import {
  accountContextMiddleware,
  jwtVerificationMiddleware,
  profileResolutionMiddleware,
  requireMembershipRole,
} from "../middleware/auth";
import {
  assertPrivateFileKey,
  createPresignedDownload,
  materialFileType,
  StorageError,
  verifyPrivateUpload,
} from "../storage/r2";
import { loadStudentCourseIds } from "../lib/student-course-access";
import type { AccountContext } from "../types";
import { z } from "zod";
import { parseOffsetPagination } from "../lib/api-contract";

type Variables = {
  user: any;
  account: AccountContext;
};

export const notesRouter = new Hono<{ Variables: Variables }>();

export const studentMaterialsSelect = 'id, title, description, file_key, file_name, file_type, file_size_bytes, created_at, course_id, course:courses!notes_course_id_fkey(id, name), tutor:user_profiles!notes_tutor_id_fkey(id, first_name, last_name)'

export function withoutPrivateFileKey<T extends Record<string, any>>(note: T): Omit<T, "file_key"> {
  const { file_key: _fileKey, ...safeNote } = note;
  return safeNote as Omit<T, "file_key">;
}

// Apply authentication middleware
notesRouter.use("*", jwtVerificationMiddleware, profileResolutionMiddleware);
notesRouter.use("*", accountContextMiddleware);
notesRouter.use("*", async (c, next) => {
  const account = c.get("account") as AccountContext | undefined;
  if (!account) return c.json({ error: "Tutoring account context is required", code: "ACCOUNT_CONTEXT_REQUIRED" }, 400);
  const user = c.get("user");
  c.set("user", {
    ...user,
    school_id: account.id,
    role: account.role === "learner" ? "student" : account.role,
  });
  await next();
});

const createNoteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullish(),
  file_key: z.string().min(1).max(512),
  file_name: z.string().trim().min(1).max(255),
  file_type: z.string().trim().min(1).max(127),
  file_size_bytes: z.coerce.number().int().positive(),
});

const enforceAdminOrTutor = requireMembershipRole("admin", "tutor");
const enforceLearner = requireMembershipRole("learner");
const enforceAccountMember = requireMembershipRole("admin", "tutor", "learner");

// Student materials library. This aggregate route avoids one request per course
// and uses the same programme/sub-programme/course entitlement resolver as the
// rest of the student portal.
notesRouter.get("/me", enforceLearner, async (c) => {
  try {
    const profile = c.get("user");
    if (profile.role !== "student") return c.json({ error: "Only students can view this library", code: "FORBIDDEN" }, 403);
    if (!profile.school_id) return c.json({ data: [] });
    const courseIds = await loadStudentCourseIds(profile.id, profile.school_id);
    if (!courseIds.length) return c.json({ data: [] });

    const pagination = parseOffsetPagination(c.req.query("page"), c.req.query("page_size") ?? "100");
    if (!pagination) return c.json({ error: "Invalid pagination parameters", code: "INVALID_PAGINATION" }, 400);

    const { data, error } = await supabase.from("notes")
      .select(studentMaterialsSelect)
      .eq("school_id", profile.school_id).in("course_id", courseIds)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(pagination.offset, pagination.offset + pagination.pageSize - 1);
    if (error) throw error;
    const notes = await Promise.all((data || []).map(async ({ file_key, ...note }) => {
      try {
        return {
          ...note,
          download_url: await createPresignedDownload(file_key, profile.school_id),
          download_available: true,
        }
      } catch (downloadError: any) {
        // Old records may predate the current tenant-scoped private-key format.
        // Keep the student's library usable, without exposing the key or issuing a
        // link outside the permitted school path.
        console.error('notes.download_unavailable', {
          noteId: note.id,
          code: downloadError instanceof StorageError ? downloadError.code : undefined,
        })
        return { ...note, download_url: null, download_available: false }
      }
    }))
    return c.json({ data: notes, pagination: { page: pagination.page, page_size: pagination.pageSize, has_more: notes.length === pagination.pageSize } });
  } catch (error: any) {
    console.error("GET /notes/me error:", error);
    return c.json({ error: "Could not load learning materials", code: "MATERIALS_LOAD_FAILED" }, 500);
  }
});

// Create a new note
notesRouter.post("/:courseId", enforceAdminOrTutor, async (c) => {
  try {
    const profile = c.get("user");
    if (!profile.school_id) {
      return c.json({ error: "User has no school setup", code: "NO_SCHOOL" }, 400);
    }

    const courseId = c.req.param("courseId");
    if (!courseId) return c.json({ error: "Course not found", code: "NOT_FOUND" }, 404);
    const parsed = createNoteSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: "Missing or invalid material fields", code: "BAD_REQUEST" }, 400);
    }
    const { title, description, file_key, file_name, file_type, file_size_bytes } = parsed.data;

    assertPrivateFileKey(file_key, profile.school_id, "note", courseId);

    // Tenant Check: Ensure the course belongs to the school
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .eq("school_id", profile.school_id)
      .maybeSingle();

    if (courseError) throw courseError;
    if (!course) {
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
        .maybeSingle();

      if (assignmentError) throw assignmentError;
      if (!assignment) {
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

    const { data: reusedFile, error: reuseError } = await supabase.from("notes")
      .select("id")
      .eq("school_id", profile.school_id)
      .eq("file_key", file_key)
      .maybeSingle();
    if (reuseError) throw reuseError;
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
        file_type: materialFileType(file_type),
        file_size_bytes
      })
      .select()
      .single();

    if (insertError) {
      // The unique (school_id, file_key) index closes the check-then-insert race.
      if (insertError.code === "23505") {
        return c.json({ error: "File has already been registered", code: "FILE_ALREADY_REGISTERED" }, 409);
      }
      throw insertError;
    }

    return c.json({ data: note, message: "Note created successfully" }, 201);
  } catch (error: any) {
    if (error instanceof StorageError) {
      return c.json({ error: error.message, code: error.code }, error.status);
    }
    console.error(`POST /notes/:courseId error:`, error);
    return c.json({ error: "Could not create learning material", code: "NOTE_CREATE_FAILED" }, 500);
  }
});

// List all notes for a course
notesRouter.get("/:courseId", enforceAccountMember, async (c) => {
  try {
    const profile = c.get("user");
    if (!profile.school_id) {
      return c.json({ data: [] });
    }

    const courseId = c.req.param("courseId");
    if (!courseId) return c.json({ error: "Course not found", code: "NOT_FOUND" }, 404);

    // Enrolment / Assignment Check
    if (profile.role === "student") {
      const courseIds = await loadStudentCourseIds(profile.id, profile.school_id);
      if (!courseIds.includes(courseId)) {
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
        .maybeSingle();

      if (assignmentError) throw assignmentError;
      if (!assignment) {
        return c.json({ error: "Not assigned to this course", code: "FORBIDDEN" }, 403);
      }
    }

    const pagination = parseOffsetPagination(c.req.query("page"), c.req.query("page_size") ?? "100");
    if (!pagination) return c.json({ error: "Invalid pagination parameters", code: "INVALID_PAGINATION" }, 400);

    // Fetch notes with tutor details
    const { data: notes, error } = await supabase
      .from("notes")
      .select(`
        *,
        tutor:user_profiles!notes_tutor_id_fkey(id, first_name, last_name)
      `)
      .eq("course_id", courseId)
      .eq("school_id", profile.school_id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

    if (error) throw error;

    // Only the returned page is signed.
    const enhancedNotes = await Promise.all((notes || []).map(async (note) => {
      const download_url = await createPresignedDownload(note.file_key, profile.school_id);
      return {
        ...withoutPrivateFileKey(note),
        download_url
      };
    }));

    return c.json({ data: enhancedNotes, pagination: { page: pagination.page, page_size: pagination.pageSize, has_more: enhancedNotes.length === pagination.pageSize } });
  } catch (error: any) {
    console.error(`GET /notes/:courseId error:`, error);
    return c.json({ error: "Could not load learning materials", code: "MATERIALS_LOAD_FAILED" }, 500);
  }
});

// Delete a note
notesRouter.delete("/:id", enforceAdminOrTutor, async (c) => {
  try {
    const profile = c.get("user");
    const id = c.req.param("id");
    if (!id) return c.json({ error: "Note not found", code: "NOT_FOUND" }, 404);

    const { data: note, error: fetchError } = await supabase
      .from("notes")
      .select("tutor_id, course_id, file_key")
      .eq("id", id)
      .eq("school_id", profile.school_id)
      .single();

    if (fetchError || !note) {
      return c.json({ error: "Note not found", code: "NOT_FOUND" }, 404);
    }

    // A tutor must still be responsible for the subject. Checking only the
    // creator would let a tutor retain control after being removed from a
    // course, and it is inconsistent with create/list access.
    if (profile.role === "tutor") {
      const { data: assignment, error: assignmentError } = await supabase
        .from("tutor_course_assignments")
        .select("id")
        .eq("tutor_id", profile.id)
        .eq("course_id", note.course_id)
        .eq("school_id", profile.school_id)
        .single();
      if (assignmentError || !assignment) {
        return c.json({ error: "Not assigned to this course", code: "NOT_ASSIGNED_TO_COURSE" }, 403);
      }
      if (note.tutor_id !== profile.id) {
        return c.json({ error: "Cannot delete another tutor's note", code: "FORBIDDEN" }, 403);
      }
    }

    const { error: deleteError } = await supabase
      .from("notes")
      .delete()
      .eq("id", id)
      .eq("school_id", profile.school_id);

    if (deleteError) throw deleteError;

    // The stored file is removed by a durable job now that the row is gone.
    await enqueueObjectDeletion(note.file_key, profile.school_id);
    return c.json({ message: "Note deleted successfully" });
  } catch (error: any) {
    console.error(`DELETE /notes/:id error:`, error);
    return c.json({ error: "Could not delete learning material", code: "NOTE_DELETE_FAILED" }, 500);
  }
});
