import { Hono } from "hono";
import { z } from "zod";
import { supabase } from "../lib/supabase";
import { accountContextMiddleware, jwtVerificationMiddleware, profileResolutionMiddleware, requireMembershipRole } from "../middleware/auth";
import { publicFileUrl } from "../storage/r2";
import { createAccountInvitation } from '../lib/account-invitations'
import { sendStudentInvitation } from '../emails/send-student-invitation'

type Variables = {
  user: any;
  account: { id: string; role: string };
};

export const usersRouter = new Hono<{ Variables: Variables }>();

usersRouter.use("*", jwtVerificationMiddleware, profileResolutionMiddleware, accountContextMiddleware);

// Middleware to enforce Admin role
const enforceAdmin = requireMembershipRole('admin');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IMPORT_SIZE = 500;
const NON_ENUMERATING_IMPORT_ERROR = 'Could not add student';
const INVITATION_FAILED_IMPORT_ERROR = 'Added to the roster, but the invitation could not be sent. Resend it from the Learner list.';

// One request schema for POST /users/students/import. Cell values are coerced
// to bounded trimmed strings so a numeric CSV cell cannot bypass validation.
const importText = (max: number) => z.preprocess((value) => (value === null || value === undefined ? '' : String(value)), z.string().trim().max(max));
const importRowSchema = z.object({
  first_name: importText(100),
  last_name: importText(100),
  email: importText(254).transform((value) => value.toLowerCase()),
  phone: importText(32),
  programme_id: importText(64),
});
const importBodySchema = z.object({
  students: z.array(z.unknown()).min(1).max(MAX_IMPORT_SIZE),
  send_invitations: z.boolean().optional(),
});

// Bounded list paging shared by the people endpoints.
const listPageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
});
function parsePage(c: { req: { query: (name: string) => string | undefined } }) {
  return listPageSchema.safeParse({ limit: c.req.query('limit') || undefined, offset: c.req.query('offset') || undefined });
}
const INVALID_PAGE = { error: 'Invalid page request', code: 'VALIDATION_ERROR' } as const;

type RosterResult = {
  row: number; ok: boolean; student_profile_id?: string; created?: boolean; enrolled?: boolean;
  pending?: boolean; onboarding_status?: string; first_name?: string; last_name?: string;
};

// POST /users/students/import: stage the roster and class targets in one
// database call (each row atomic, the whole batch idempotent), then deliver
// invitations as a separate repeatable step. Class targets stay pending until
// account acceptance; already-active Learners are enrolled immediately because
// no activation step remains for them. A Learner who already belongs to another
// account is added to this one as an additional member.
usersRouter.post('/students/import', enforceAdmin, async (c) => {
  const admin = c.get('user');
  const account = c.get('account');

  const parsedBody = importBodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsedBody.success) {
    return c.json({ error: `Upload between 1 and ${MAX_IMPORT_SIZE} students at a time`, code: 'VALIDATION_ERROR' }, 400);
  }
  const sendInvitations = parsedBody.data.send_invitations !== false;

  const normalizedRows = parsedBody.data.students.map((row, index) => {
    const parsedRow = importRowSchema.safeParse(row && typeof row === 'object' ? row : {});
    return parsedRow.success
      ? { row: index + 1, tooLong: false, ...parsedRow.data, email: parsedRow.data.email || null, phone: parsedRow.data.phone || null }
      : { row: index + 1, tooLong: true, first_name: '', last_name: '', email: null as string | null, phone: null as string | null, programme_id: '' };
  });
  const validationErrors = normalizedRows.flatMap((row) => {
    const errors: string[] = [];
    if (row.tooLong) errors.push('A value in this row is too long');
    if ((!row.first_name || !row.last_name) && !sendInvitations) {
      errors.push('First name and last name are required when no activation email will be sent');
    }
    if (row.email && !EMAIL_PATTERN.test(row.email)) errors.push('Email address is invalid');
    if (!row.email && !row.tooLong) errors.push('Email address is required');
    return errors.length ? [{ row: row.row, errors }] : [];
  });
  const emailRows = new Map<string, number[]>();
  for (const row of normalizedRows) {
    if (!row.email) continue;
    const rowsForEmail = emailRows.get(row.email) || [];
    rowsForEmail.push(row.row);
    emailRows.set(row.email, rowsForEmail);
  }
  for (const rowsForEmail of emailRows.values()) {
    if (rowsForEmail.length < 2) continue;
    for (const row of rowsForEmail) {
      validationErrors.push({ row, errors: ['Email address appears more than once in this import'] });
    }
  }
  if (validationErrors.length) return c.json({ error: 'Fix the highlighted rows before importing', code: 'VALIDATION_ERROR', errors: validationErrors }, 400);

  try {
    const programmeIds = [...new Set(normalizedRows.map((row) => row.programme_id).filter((id) => Boolean(id) && UUID_PATTERN.test(id)))];
    const { data: programmes, error: programmesError } = programmeIds.length ? await supabase
      .from('programmes')
      .select('id, name')
      .eq('school_id', account.id)
      .in('id', programmeIds) : { data: [], error: null };
    if (programmesError) throw programmesError;
    const knownProgrammeIds = new Set((programmes || []).map((programme) => programme.id));
    const unknownProgrammes = normalizedRows.filter((row) => row.programme_id && !knownProgrammeIds.has(row.programme_id));
    if (unknownProgrammes.length) {
      return c.json({ error: 'One or more programmes do not belong to your centre', code: 'INVALID_PROGRAMME', errors: unknownProgrammes.map((row) => ({ row: row.row, errors: ['Programme not found'] })) }, 400);
    }

    const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, '');
    if (sendInvitations && !frontendUrl) {
      return c.json({ error: 'Student invitations are not configured', code: 'INVITATIONS_UNAVAILABLE' }, 503);
    }
    let schoolName = '';
    if (sendInvitations) {
      const { data: school, error: schoolError } = await supabase.from('schools').select('name').eq('id', account.id).single();
      if (schoolError || !school) throw schoolError || new Error('Could not load your centre');
      schoolName = school.name;
    }
    const programmeNames = new Map((programmes || []).map((programme) => [programme.id, programme.name]));
    const invitedByName = `${admin.first_name || ''} ${admin.last_name || ''}`.trim() || 'Your agency administrator';

    const { data: staged, error: stageError } = await (supabase as any).rpc('import_roster_students', {
      p_school_id: account.id,
      p_invited_by: admin.id,
      p_rows: normalizedRows.map((row) => ({
        row: row.row, first_name: row.first_name, last_name: row.last_name, email: row.email,
        phone: row.phone, programme_id: row.programme_id || null,
      })),
    });
    if (stageError || !Array.isArray(staged)) throw stageError || new Error('Roster import returned no result');
    const results = new Map<number, RosterResult>((staged as RosterResult[]).map((result) => [result.row, result]));

    const summary = { created: 0, enrolled: 0, pending: 0, invited: 0, invitation_failed: 0, skipped: 0, errors: [] as Array<{ row: number; errors: string[] }> };

    for (const row of normalizedRows) {
      const result = results.get(row.row);
      if (!result?.ok || !result.student_profile_id) {
        summary.skipped += 1;
        summary.errors.push({ row: row.row, errors: [NON_ENUMERATING_IMPORT_ERROR] });
        continue;
      }
      if (result.created) summary.created += 1;
      if (result.enrolled) summary.enrolled += 1;
      if (result.pending) summary.pending += 1;

      if (sendInvitations && row.email && result.onboarding_status !== 'active') {
        try {
          const programmeName = programmeNames.get(row.programme_id) || 'your centre';
          const durable = await createAccountInvitation({
            schoolId: account.id,
            invitedBy: admin.id,
            role: 'student',
            email: row.email,
            studentProfileId: result.student_profile_id,
            metadata: {
              first_name: row.first_name || result.first_name || '',
              last_name: row.last_name || result.last_name || '',
              school_name: schoolName,
              programme_name: programmeName,
              invited_by_name: invitedByName,
              app_url: frontendUrl,
            },
          });
          await sendStudentInvitation({
            to: row.email,
            inviteUrl: `${frontendUrl}/invite?token=${encodeURIComponent(durable.token)}`,
            invitedByName,
            schoolName,
            programmeName,
            expiresAt: durable.expiresAt,
          });
          summary.invited += 1;
        } catch (error: any) {
          console.error('[users/import] Invitation delivery failed', { row: row.row, message: error instanceof Error ? error.message : 'unknown' });
          summary.invitation_failed += 1;
          summary.errors.push({ row: row.row, errors: [INVITATION_FAILED_IMPORT_ERROR] });
        }
      }
    }

    return c.json({ data: summary, message: `Invited ${summary.invited} student${summary.invited === 1 ? '' : 's'}.` }, 201);
  } catch (error: any) {
    console.error('[users/import] Roster import failed', { message: error instanceof Error ? error.message : error?.message || 'unknown' });
    return c.json({ error: 'Could not import students', code: 'IMPORT_UNAVAILABLE' }, 503);
  }
});

// GET /users/tutors — List tutors with their assigned courses
// Must be defined BEFORE /:id to avoid route collision
usersRouter.get("/tutors", enforceAdmin, async (c) => {
  const page = parsePage(c);
  if (!page.success) return c.json(INVALID_PAGE, 400);
  const { limit, offset } = page.data;
  try {
    const account = c.get('account');

    // 1. Fetch everyone who can teach. An admin becomes a solo tutor only
    // when they have a course assignment, so include them for the assignment
    // join below and filter unassigned admins out of the teaching-team list.
    const { data: teachingPeople, error: tutorsError } = await supabase
      .from("user_profiles")
      .select("id, kanvise_user_id, first_name, last_name, email, bio, profile_photo_key, role")
      .eq("school_id", account.id)
      .in("role", ["tutor", "admin"])
      .eq('is_active', true)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit);

    if (tutorsError) throw tutorsError;
    const hasMore = (teachingPeople?.length || 0) > limit;
    const pagination = { limit, offset, has_more: hasMore };
    if (!teachingPeople || teachingPeople.length === 0) return c.json({ data: [], pagination });

    // 2. Fetch tutor_course_assignments for all these tutors
    // tutor_id in assignments is user_profiles.id (UUID)
    const pageOfPeople = teachingPeople.slice(0, limit);
    const tutorIds = pageOfPeople.map((t) => t.id);
    const { data: assignments, error: assignError } = await supabase
      .from("tutor_course_assignments")
      .select("tutor_id, course_id")
      .eq("school_id", account.id)
      .in("tutor_id", tutorIds);

    if (assignError) throw assignError;

    // 3. Fetch names for all assigned courses
    const courseIds = [...new Set((assignments || []).map((a) => a.course_id))];
    let courses: { id: string; name: string }[] = [];

    if (courseIds.length > 0) {
      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .select("id, name")
        .eq("school_id", account.id)
        .in("id", courseIds);

      if (courseError) throw courseError;
      courses = courseData || [];
    }

    // 4. Join in JS
    const tutorsWithCourses = pageOfPeople.map((tutor) => {
      const tutorAssignments = (assignments || []).filter((a) => a.tutor_id === tutor.id);
      const tutorCourses = tutorAssignments
        .map((a) => courses.find((c) => c.id === a.course_id))
        .filter((c): c is { id: string; name: string } => Boolean(c));
      return { ...tutor, courses: tutorCourses };
    }).filter((person) => person.role === "tutor" || person.courses.length > 0);

    return c.json({ data: tutorsWithCourses, pagination });
  } catch (error: any) {
    return c.json({ error: 'Could not load Tutors right now', code: 'PEOPLE_UNAVAILABLE' }, 503);
  }
});

// GET /users/students — List students with their active enrolments
usersRouter.get("/students", enforceAdmin, async (c) => {
  const page = parsePage(c);
  if (!page.success) return c.json(INVALID_PAGE, 400);
  const { limit, offset } = page.data;
  try {
    const account = c.get('account');

    // 1. Fetch all students in this school
    const { data: students, error: studentsError } = await supabase
      .from("user_profiles")
      .select("id, kanvise_user_id, first_name, last_name, email, profile_photo_key, role, onboarding_status")
      .eq("school_id", account.id)
      .eq("role", "student")
      .eq('is_active', true)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit);

    if (studentsError) throw studentsError;
    const pagination = { limit, offset, has_more: (students?.length || 0) > limit };
    if (!students || students.length === 0) return c.json({ data: [], pagination });
    const pageOfStudents = students.slice(0, limit);

    // 2. Fetch enrolments for all these students
    const studentIds = pageOfStudents.map((s) => s.id);
    const { data: enrolments, error: enrolmentsError } = await supabase
      .from("enrolments")
      .select(`
        id, 
        student_id,
        enrolled_at,
        programmes!enrolments_programme_id_fkey (id, name),
        sub_programmes!enrolments_sub_programme_id_fkey (id, name),
        courses!enrolments_course_id_fkey (id, name)
      `)
      .eq("school_id", account.id)
      .in("student_id", studentIds);

    if (enrolmentsError) throw enrolmentsError;

    const { data: pendingTargets, error: pendingTargetsError } = await (supabase as any)
      .from('pending_student_enrolments')
      .select('id, student_profile_id, programme_id, programmes(id, name)')
      .eq('school_id', account.id)
      .in('student_profile_id', studentIds);
    if (pendingTargetsError) throw pendingTargetsError;

    // 3. Join in JS
    const studentsWithEnrolments = pageOfStudents.map((student) => {
      const studentEnrolments = (enrolments || []).filter((e) => e.student_id === student.id);
      let profilePhotoUrl: string | null = null;
      if (student.profile_photo_key && process.env.R2_PUBLIC_BASE_URL) {
        profilePhotoUrl = publicFileUrl(student.profile_photo_key);
      }
      return {
        ...student,
        profile_photo_url: profilePhotoUrl,
        enrolments: studentEnrolments,
        pending_enrolments: (pendingTargets || []).filter((target: any) => target.student_profile_id === student.id),
      };
    });

    return c.json({ data: studentsWithEnrolments, pagination });
  } catch (error: any) {
    return c.json({ error: 'Could not load Learners right now', code: 'PEOPLE_UNAVAILABLE' }, 503);
  }
});

// POST /users/students/:id/invitation/resend — replace a pending activation
// link. Creating the invitation expires any older pending link for this email.
usersRouter.post('/students/:id/invitation/resend', enforceAdmin, async (c) => {
  try {
    const admin = c.get('user');
    const account = c.get('account');
    const studentId = c.req.param('id') as string;
    if (!UUID_PATTERN.test(studentId)) return c.json({ error: 'Student not found', code: 'NOT_FOUND' }, 404);
    const { data: student, error: studentError } = await supabase
      .from('user_profiles')
      .select('id, email, first_name, last_name, onboarding_status')
      .eq('id', studentId).eq('school_id', account.id).eq('role', 'student').maybeSingle();
    if (studentError) throw studentError;
    if (!student) return c.json({ error: 'Student not found', code: 'NOT_FOUND' }, 404);
    if (student.onboarding_status === 'active') return c.json({ error: 'This student has already accepted their invitation', code: 'STUDENT_ACTIVE' }, 409);
    if (!student.email) return c.json({ error: 'This student has no email address', code: 'EMAIL_REQUIRED' }, 400);

    const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, '');
    if (!frontendUrl) return c.json({ error: 'Student invitations are not configured', code: 'INVITATIONS_UNAVAILABLE' }, 503);
    const [{ data: school, error: schoolError }, { data: pendingTargets, error: pendingError }] = await Promise.all([
      supabase.from('schools').select('name').eq('id', account.id).single(),
      (supabase as any).from('pending_student_enrolments').select('programmes(name)').eq('school_id', account.id).eq('student_profile_id', student.id),
    ]);
    if (schoolError || !school) throw schoolError || new Error('Could not load your centre');
    if (pendingError) throw pendingError;
    const firstTarget = pendingTargets?.[0]?.programmes;
    const className = Array.isArray(firstTarget) ? firstTarget[0]?.name : firstTarget?.name;
    const invitedByName = `${admin.first_name || ''} ${admin.last_name || ''}`.trim() || 'Your agency administrator';
    const durable = await createAccountInvitation({
      schoolId: account.id,
      invitedBy: admin.id,
      role: 'student',
      email: student.email,
      studentProfileId: student.id,
      metadata: {
        first_name: student.first_name || '', last_name: student.last_name || '', school_name: school.name,
        programme_name: className || 'your centre', invited_by_name: invitedByName, app_url: frontendUrl,
      },
    });
    await sendStudentInvitation({
      to: student.email,
      inviteUrl: `${frontendUrl}/invite?token=${encodeURIComponent(durable.token)}`,
      invitedByName, schoolName: school.name, programmeName: className || 'your centre', expiresAt: durable.expiresAt,
    });
    return c.json({ data: { expires_at: durable.expiresAt }, message: 'Invitation resent' });
  } catch (error: any) {
    console.error('[users/invitation/resend] Failed', { message: error instanceof Error ? error.message : error?.message || 'unknown' });
    return c.json({ error: 'Could not resend invitation', code: 'INVITATION_UNAVAILABLE' }, 500);
  }
});

// DELETE /users/students/:id/invitation — cancel an unaccepted invitation and
// every class target that was waiting on that acceptance. Accepted enrolments
// are never touched by this endpoint.
usersRouter.delete('/students/:id/invitation', enforceAdmin, async (c) => {
  try {
    const account = c.get('account');
    const studentId = c.req.param('id') as string;
    if (!UUID_PATTERN.test(studentId)) return c.json({ error: 'Student not found', code: 'NOT_FOUND' }, 404);
    const { data, error } = await (supabase as any).rpc('cancel_student_invitation', { p_school_id: account.id, p_student_id: studentId });
    if (error || !data) throw error || new Error('No result');
    if (!data.found) return c.json({ error: 'Student not found', code: 'NOT_FOUND' }, 404);
    if (!data.cancelled) return c.json({ error: 'Accepted students cannot have their invitation cancelled', code: 'STUDENT_ACTIVE' }, 409);
    return c.json({ message: 'Invitation cancelled' });
  } catch (error: any) {
    console.error('[users/invitation/cancel] Failed', { message: error?.message || 'unknown' });
    return c.json({ error: 'Could not cancel invitation', code: 'INVITATION_UNAVAILABLE' }, 500);
  }
});

// GET /users — List all users in the school, filterable by role
usersRouter.get("/", enforceAdmin, async (c) => {
  const page = parsePage(c);
  if (!page.success) return c.json(INVALID_PAGE, 400);
  const { limit, offset } = page.data;
  try {
    const account = c.get('account');
    const role = c.req.query("role");
    const rolesParam = c.req.query("roles");

    let query = supabase
      .from("user_profiles")
      .select("id, kanvise_user_id, role, first_name, last_name, email, profile_photo_key")
      .eq("school_id", account.id)
      .eq('is_active', true);

    if (rolesParam) {
      const rolesArray = rolesParam.split(",");
      query = query.in("role", rolesArray);
    } else if (role) {
      query = query.eq("role", role);
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit);

    if (error) throw error;

    return c.json({ data: (data || []).slice(0, limit), pagination: { limit, offset, has_more: (data?.length || 0) > limit } });
  } catch (error: any) {
    return c.json({ error: 'Could not load people right now', code: 'PEOPLE_UNAVAILABLE' }, 503);
  }
});

// DELETE /users/:id — Revoke a user's current account authority while preserving history.
usersRouter.delete("/:id", enforceAdmin, async (c) => {
  try {
    const profile = c.get("user");
    const account = c.get('account');
    const id = c.req.param("id");
    // Guard: admin cannot remove themselves
    if (id === profile.id) {
      return c.json({ error: "You cannot remove yourself from the school", code: "CANNOT_REMOVE_SELF" }, 403);
    }

    if (!id || !UUID_PATTERN.test(id)) {
      return c.json({ error: "User not found in this school", code: "USER_NOT_FOUND" }, 404);
    }

    const { data: removal, error: removalError } = await (supabase as any).rpc('remove_user_from_school', {
      p_target_user_id: id,
      p_school_id: account.id,
    });
    if (removalError) {
      return c.json({ error: 'Could not remove this user right now', code: 'USER_REMOVAL_UNAVAILABLE' }, 503);
    }
    if (!removal?.found) {
      return c.json({ error: "User not found in this school", code: "USER_NOT_FOUND" }, 404);
    }

    if (removal.supabase_auth_id) {
      const { error: authError } = await supabase.auth.admin.updateUserById(removal.supabase_auth_id, { app_metadata: { school_id: null } });
      if (authError) {
        return c.json({ error: 'User removed, but session cleanup is pending', code: 'AUTH_PROJECTION_SYNC_FAILED' }, 503);
      }
    }

    return c.json({ message: "User removed from school" });
  } catch (error: any) {
    return c.json({ error: 'Could not remove this user right now', code: 'USER_REMOVAL_UNAVAILABLE' }, 503);
  }
});
