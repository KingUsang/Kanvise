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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_IMPORT_SIZE = 500;

async function allocateStudentId() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await supabase.rpc('increment_user_sequence', { p_role: 'student' });
    if (error || data === null || data === undefined) {
      throw new Error('Student ID allocation is temporarily unavailable. Please try again.');
    }

    return `KNV-STU-${String(data).padStart(5, '0')}`;
  }

  throw new Error('Student ID allocation is temporarily unavailable. Please try again.');
}

// POST /users/students/import — Add existing tutorial-centre students and
// immediately enrol each in its programme. Activation emails are optional, but
// enabled by default for rows that have an email address.
usersRouter.post('/students/import', enforceAdmin, async (c) => {
  const admin = c.get('user');
  if (!admin.school_id) {
    return c.json({ error: 'Set up your centre before adding students', code: 'NO_SCHOOL' }, 400);
  }

  const body: { students?: unknown; send_invitations?: boolean } = await c.req.json();
  const rows: unknown[] = Array.isArray(body.students) ? body.students : [];
  const sendInvitations = body.send_invitations !== false;

  if (!rows.length || rows.length > MAX_IMPORT_SIZE) {
    return c.json({ error: `Upload between 1 and ${MAX_IMPORT_SIZE} students at a time`, code: 'VALIDATION_ERROR' }, 400);
  }

  const normalizedRows = rows.map((row, index) => {
    const input = row && typeof row === 'object' ? row as Record<string, unknown> : {};
    return {
      row: index + 1,
      first_name: String(input.first_name || '').trim(),
      last_name: String(input.last_name || '').trim(),
      email: String(input.email || '').trim().toLowerCase() || null,
      phone: String(input.phone || '').trim() || null,
      programme_id: String(input.programme_id || '').trim(),
    };
  });
  const validationErrors = normalizedRows.flatMap((row) => {
    const errors: string[] = [];
    if (!row.first_name || !row.last_name) errors.push('First name and last name are required');
    if (row.email && !EMAIL_PATTERN.test(row.email)) errors.push('Email address is invalid');
    if (!row.email && !row.phone) errors.push('Provide an email address or phone number');
    if (!row.programme_id) errors.push('Choose a programme');
    return errors.length ? [{ row: row.row, errors }] : [];
  });
  if (validationErrors.length) return c.json({ error: 'Fix the highlighted rows before importing', code: 'VALIDATION_ERROR', errors: validationErrors }, 400);

  try {
    const programmeIds = [...new Set(normalizedRows.map((row) => row.programme_id))];
    const { data: programmes, error: programmesError } = await supabase
      .from('programmes')
      .select('id')
      .eq('school_id', admin.school_id)
      .in('id', programmeIds);
    if (programmesError) throw programmesError;
    const knownProgrammeIds = new Set((programmes || []).map((programme) => programme.id));
    const unknownProgrammes = normalizedRows.filter((row) => !knownProgrammeIds.has(row.programme_id));
    if (unknownProgrammes.length) {
      return c.json({ error: 'One or more programmes do not belong to your centre', code: 'INVALID_PROGRAMME', errors: unknownProgrammes.map((row) => ({ row: row.row, errors: ['Programme not found'] })) }, 400);
    }

    const emails = [...new Set(normalizedRows.map((row) => row.email).filter((email): email is string => Boolean(email)))];
    const { data: existingProfiles, error: existingError } = emails.length ? await supabase
      .from('user_profiles')
      .select('id, supabase_auth_id, school_id, role, kanvise_user_id, email, onboarding_status')
      .in('email', emails) : { data: [], error: null };

    if (existingError) throw existingError;
    const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, '');
    if (sendInvitations && !frontendUrl) {
      return c.json({ error: 'Student invitations are not configured', code: 'INVITATIONS_UNAVAILABLE' }, 503);
    }
    const profilesByEmail = new Map((existingProfiles || []).filter((profile) => profile.email).map((profile) => [profile.email!, profile]));
    const summary = { created: 0, enrolled: 0, invited: 0, skipped: 0, errors: [] as Array<{ row: number; errors: string[] }> };

    for (const row of normalizedRows) {
      try {
        let student = row.email ? profilesByEmail.get(row.email) : undefined;
        if (student) {
          if (student.role !== 'student') throw new Error('Email already belongs to a staff account');
          if (student.school_id && student.school_id !== admin.school_id) throw new Error('Student already belongs to another centre');
          if (!student.school_id) {
            const { data, error } = await supabase.from('user_profiles').update({ school_id: admin.school_id }).eq('id', student.id).select('id, supabase_auth_id, school_id, role, kanvise_user_id, email, onboarding_status').single();
            if (error) throw error;
            student = data;
          }
        } else {
          const kanviseUserId = await allocateStudentId();
          const { data, error } = await supabase.from('user_profiles').insert({
            supabase_auth_id: null, school_id: admin.school_id, role: 'student', kanvise_user_id: kanviseUserId,
            first_name: row.first_name, last_name: row.last_name, email: row.email, phone: row.phone,
            onboarding_status: 'not_invited', onboarding_source: 'admin_import', added_by: admin.id,
          } as any).select('id, supabase_auth_id, school_id, role, kanvise_user_id, email, onboarding_status').single();
          if (error || !data) throw error || new Error('Could not create student roster record');
          student = data;
          if (row.email) profilesByEmail.set(row.email, data);
          summary.created += 1;
        }

        const { data: existingEnrolment, error: enrolmentLookupError } = await supabase.from('enrolments').select('id').eq('school_id', admin.school_id).eq('student_id', student.id).eq('programme_id', row.programme_id).maybeSingle();
        if (enrolmentLookupError) throw enrolmentLookupError;
        if (!existingEnrolment) {
          const { error: enrolmentError } = await supabase.from('enrolments').insert({ school_id: admin.school_id, student_id: student.id, programme_id: row.programme_id, source: 'admin_import', granted_by: admin.id, imported_at: new Date().toISOString() } as any);
          if (enrolmentError) throw enrolmentError;
          summary.enrolled += 1;
        }

        if (sendInvitations && row.email && !student.supabase_auth_id) {
          const { data: invite, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(row.email, { redirectTo: `${frontendUrl}/api/auth/callback?next=/auth/reset-password`, data: { first_name: row.first_name, last_name: row.last_name } });
          if (inviteError || !invite.user) throw new Error(inviteError?.message || 'Could not send activation email');
          const { error: profileError } = await supabase.from('user_profiles').update({ supabase_auth_id: invite.user.id, onboarding_status: 'invited' } as any).eq('id', student.id);
          if (profileError) throw profileError;
          const { error: metadataError } = await supabase.auth.admin.updateUserById(invite.user.id, { user_metadata: { first_name: row.first_name, last_name: row.last_name }, app_metadata: { kanvise_role: 'student', role: 'student', school_id: admin.school_id, kanvise_user_id: student.kanvise_user_id, profile_id: student.id } });
          if (metadataError) throw metadataError;
          summary.invited += 1;
        }
      } catch (error: any) {
        summary.errors.push({ row: row.row, errors: [error.message || 'Could not import student'] });
      }
    }

    summary.skipped = summary.errors.length;
    return c.json({ data: summary, message: `Imported ${summary.created} student${summary.created === 1 ? '' : 's'}.` }, 201);
  } catch (error: any) {
    return c.json({ error: error.message || 'Could not add student' }, 500);
  }
});

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
