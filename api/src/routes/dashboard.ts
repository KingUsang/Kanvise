import { Hono } from "hono";
import { supabase } from "../lib/supabase";
import {
  accountContextMiddleware,
  jwtVerificationMiddleware,
  profileResolutionMiddleware,
  Variables,
} from "../middleware/auth";
import { standaloneAwareAccountContext } from "../middleware/account-projection";
import type { AccountContext } from "../types";
import { listCourseLearnerIds, resolveStudentCourses } from "../lib/student-course-access";
import {
  loadStudentMockAudience,
  studentCanAccessCentreMock,
  type StudentMockAudience,
} from "../lib/student-mock-audience";
import { buildStudentProgress } from "../domain/student-progress";
import { reportingPeriods, resolveReportingTimezone, weekPeriods } from "../lib/reporting-period";
import { DEFAULT_CLASSROOM_OPENS_MINUTES, lessonDisplayStatus } from "../lib/dashboard-overview";

export const dashboardRouter = new Hono<{ Variables: Variables }>();

dashboardRouter.use("*", jwtVerificationMiddleware);
dashboardRouter.use("*", profileResolutionMiddleware);
const accountUserProjection = async (c: any, next: any) => {
  const account = c.get("account") as AccountContext | undefined;
  if (!account) return next();
  const user = c.get("user");
  c.set("user", {
    ...user,
    school_id: account.id,
    role: account.role === "learner" ? "student" : account.role,
  });
  await next();
};

dashboardRouter.use("*", async (c, next) => {
  const user = c.get("user");
  const studentHomeRoute =
    (c.req.path === "/dashboard/student" ||
      c.req.path === "/dashboard/student/progress") &&
    user.role === "student";

  // Standalone-mock students have no tutoring account. This is the explicit
  // compatibility exception: with no header, a student's single active
  // membership is still resolved and only a student with none (and no
  // profile account) continues without a tenant. Every other request
  // resolves the selected active membership instead of profile school_id.
  if (studentHomeRoute) return standaloneAwareAccountContext(c, next);
  return accountContextMiddleware(c, next);
});
dashboardRouter.use("*", accountUserProjection);

// DEV-DSH-002: records which dashboard sources failed so the response can say
// "partial" instead of presenting a database error as zero metrics.
class DashboardHealth {
  readonly failed = new Set<string>();
  check(source: string, error: { code?: string; message?: string } | null | undefined) {
    if (!error) return;
    this.failed.add(source);
    console.error("dashboard.source_failed", { source, code: error.code });
  }
  status() {
    return { partial: this.failed.size > 0, failed_sources: [...this.failed].sort() };
  }
}

// DEV-DSH-003: one grouped query ranks every eligible assignment (no per-assignment counts).
async function loadNeedsGrading(schoolId: string, tutorId?: string, health?: DashboardHealth) {
  const { data, error } = await (supabase as any).rpc("dashboard_needs_grading", {
    p_school_id: schoolId,
    p_tutor_id: tutorId ?? null,
    p_limit: 3,
  });
  health?.check("needs_grading", error);
  if (error || !Array.isArray(data)) return [];

  return data.map((row: any) => {
    const pending = Number(row.out_pending_count) || 0;
    const total = Number(row.out_total_count) || 0;
    return {
      id: row.out_assignment_id,
      kind: "assignment",
      href: `/dashboard/assignments/${row.out_assignment_id}/submissions`,
      title: row.out_title,
      context: `${row.out_course_name || "General"} • ${pending} waiting`,
      pending_count: pending,
      progress: total ? Math.round(((total - pending) / total) * 100) : 0,
    };
  });
}

async function loadMockOverview(schoolId: string, tutorId?: string, health?: DashboardHealth) {
  let mocksQuery = supabase
    .from("mock_exams")
    .select("id, title, course_id, courses(name)")
    .eq("school_id", schoolId)
    .eq("status", "published");

  if (tutorId) {
    const { data: assignments, error: mockAssignmentsError } = await supabase
      .from("tutor_course_assignments")
      .select("course_id")
      .eq("school_id", schoolId)
      .eq("tutor_id", tutorId);
    health?.check("mock_overview", mockAssignmentsError);
    const courseIds = (assignments || []).map(
      (assignment) => assignment.course_id,
    );
    if (courseIds.length === 0)
      return { pending_count: 0, active_count: 0, items: [] };
    // Only Quizzes the Tutor owns count as their grading work (DEV-QUIZ-033).
    mocksQuery = mocksQuery.in("course_id", courseIds).eq("tutor_id", tutorId);
  }

  const { data: mocks, error: mocksQueryError } = await mocksQuery;
  health?.check("mock_overview", mocksQueryError);
  if (!mocks?.length) return { pending_count: 0, active_count: 0, items: [] };

  const mockIds = mocks.map((mock) => mock.id);
  const { data: attempts, error: pendingAttemptsError } = await supabase
    .from("mock_attempts")
    .select("id, mock_exam_id, status")
    .eq("school_id", schoolId)
    .in("mock_exam_id", mockIds)
    .in("status", ["submitted", "timed_out"]);
  health?.check("mock_overview", pendingAttemptsError);
  const attemptIds = (attempts || []).map((attempt) => attempt.id);
  const { data: ungradedAnswers, error: ungradedAnswersError } = attemptIds.length
    ? await supabase
        .from("mock_answers")
        .select("attempt_id, question:mock_questions(question_type)")
        .eq("school_id", schoolId)
        .in("attempt_id", attemptIds)
        .is("tutor_score", null)
    : { data: [], error: null };
  health?.check("mock_overview", ungradedAnswersError);
  const pendingAttemptIds = new Set(
    (ungradedAnswers || [])
      .filter((answer) => (answer.question as any)?.question_type === "theory")
      .map((answer) => answer.attempt_id),
  );
  const pendingByMock = new Map<string, number>();
  for (const attempt of attempts || []) {
    if (pendingAttemptIds.has(attempt.id)) {
      pendingByMock.set(
        attempt.mock_exam_id,
        (pendingByMock.get(attempt.mock_exam_id) || 0) + 1,
      );
    }
  }

  const items = mocks
    .map((mock) => ({
      id: mock.id,
      kind: "mock",
      href: `/dashboard/mocks/${mock.id}/results`,
      title: mock.title,
      context: `${(mock.courses as any)?.name || "General"} • ${pendingByMock.get(mock.id) || 0} waiting`,
      pending_count: pendingByMock.get(mock.id) || 0,
      progress: 0,
    }))
    .filter((item) => item.pending_count > 0)
    .sort((a, b) => b.pending_count - a.pending_count)
    .slice(0, 3);

  return {
    pending_count: [...pendingByMock.values()].reduce(
      (sum, count) => sum + count,
      0,
    ),
    active_count: mocks.length,
    items,
  };
}

dashboardRouter.get("/student", async (c) => {
  const user = c.get("user");
  if (user.role !== "student") {
    return c.json(
      { error: "Student access only", code: "INSUFFICIENT_ROLE" },
      403,
    );
  }

  const schoolId = user.school_id;
  if (!schoolId) {
    const [
      { data: profile, error: profileError },
      { count: entitlementCount, error: entitlementError },
      { count: activeAttempts, error: attemptError },
      {
        data: completedAttempts,
        count: completedAttemptCount,
        error: completedAttemptError,
      },
    ] = await Promise.all([
      supabase
        .from("user_profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .maybeSingle(),
      (supabase as any)
        .from("mock_entitlements")
        .select("id", { count: "exact", head: true })
        .eq("student_id", user.id)
        .is("revoked_at", null),
      supabase
        .from("mock_attempts")
        .select("id", { count: "exact", head: true })
        .eq("student_id", user.id)
        .eq("access_source", "entitlement")
        .eq("status", "in_progress"),
      supabase
        .from("mock_attempts")
        .select(
          "id, total_score, total_marks, submitted_at, mock_exam:mock_exams(title)",
          { count: "exact" },
        )
        .eq("student_id", user.id)
        .eq("access_source", "entitlement")
        .in("status", ["submitted", "timed_out", "fully_graded"])
        .order("submitted_at", { ascending: false })
        .limit(1),
    ]);
    if (
      profileError ||
      entitlementError ||
      attemptError ||
      completedAttemptError
    )
      return c.json(
        {
          error: "Failed to load student dashboard",
          code: "DASHBOARD_LOAD_FAILED",
        },
        500,
      );
    const latestAttempt: any = completedAttempts?.[0] || null;
    const latestPercentage =
      latestAttempt &&
      Number(latestAttempt.total_marks) > 0 &&
      latestAttempt.total_score !== null
        ? Math.round(
            (Number(latestAttempt.total_score) /
              Number(latestAttempt.total_marks)) *
              100,
          )
        : null;
    return c.json({
      data: {
        student: {
          first_name: profile?.first_name || "",
          last_name: profile?.last_name || "",
        },
        school: null,
        course_count: 0,
        next_class: null,
        upcoming_classes: [],
        assignments_due: [],
        recent_updates: [],
        capabilities: {
          hasCentreLearning: false,
          hasMarketplaceAccess: (entitlementCount || 0) > 0,
        },
        standalone_mocks: {
          mocks_owned: entitlementCount || 0,
          attempts_in_progress: activeAttempts || 0,
          attempts_completed: completedAttemptCount || 0,
          latest_result: latestAttempt
            ? {
                id: latestAttempt.id,
                title: latestAttempt.mock_exam?.title || "Mock",
                percentage: latestPercentage,
              }
            : null,
        },
      },
    });
  }

  const [
    { data: profile, error: profileError },
    { data: school, error: schoolError },
    { data: enrolments, error: enrolmentsError },
    { data: schoolCourses, error: coursesError },
    { data: subProgrammes, error: subProgrammesError },
  ] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .eq("school_id", schoolId)
      .maybeSingle(),
    supabase.from("schools").select("name").eq("id", schoolId).maybeSingle(),
    supabase
      .from("enrolments")
      .select("programme_id, sub_programme_id, course_id")
      .eq("school_id", schoolId)
      .eq("student_id", user.id),
    supabase
      .from("courses")
      .select("id, name, programme_id, sub_programme_id")
      .eq("school_id", schoolId)
      .eq("is_published", true),
    supabase
      .from("sub_programmes")
      .select("id, programme_id")
      .eq("school_id", schoolId),
  ]);

  if (
    profileError ||
    schoolError ||
    enrolmentsError ||
    coursesError ||
    subProgrammesError
  ) {
    console.error("student_dashboard.context_failed", {
      profileError,
      schoolError,
      enrolmentsError,
      coursesError,
      subProgrammesError,
    });
    return c.json(
      {
        error: "Failed to load student dashboard",
        code: "DASHBOARD_LOAD_FAILED",
      },
      500,
    );
  }

  const accessibleCourses = resolveStudentCourses(
    enrolments || [],
    schoolCourses || [],
    subProgrammes || [],
  );
  const courseIds = accessibleCourses.map((course) => course.id);
  const courseNames = new Map(
    accessibleCourses.map((course) => [course.id, course.name]),
  );

  const now = new Date().toISOString();
  const mockAudience: StudentMockAudience = {
    courseIds,
    programmeIds: [
      ...new Set(
        (enrolments || []).flatMap((item) =>
          item.programme_id ? [item.programme_id] : [],
        ),
      ),
    ],
  };
  const empty = Promise.resolve({ data: [], error: null });
  const [
    { data: classes, error: classesError },
    { data: assignments, error: assignmentsError },
    { data: submissions, error: submissionsError },
    { data: notes, error: notesError },
    { data: mocks, error: mocksError },
    { data: attempts, error: attemptsError },
  ] = await Promise.all([
    courseIds.length
      ? supabase
          .from("live_classes")
          .select(
            "id, course_id, title, scheduled_at, duration_minutes, status",
          )
          .eq("school_id", schoolId)
          .in("course_id", courseIds)
          .in("status", ["scheduled", "live"])
          .order("scheduled_at", { ascending: true })
          .limit(12)
      : empty,
    courseIds.length
      ? supabase
          .from("assignments")
          .select("id, course_id, title, deadline_at, created_at")
          .eq("school_id", schoolId)
          .in("course_id", courseIds)
          .eq("is_published", true)
          .gte("deadline_at", now)
          .order("deadline_at", { ascending: true })
          .limit(8)
      : empty,
    supabase
      .from("submissions")
      .select("assignment_id, submitted_at, score")
      .eq("school_id", schoolId)
      .eq("student_id", user.id),
    courseIds.length
      ? supabase
          .from("notes")
          .select("id, course_id, title, file_type, created_at")
          .eq("school_id", schoolId)
          .in("course_id", courseIds)
          .order("created_at", { ascending: false })
          .limit(6)
      : empty,
    supabase
      .from("mock_exams")
      .select(
        "id, course_id, programme_id, audience_scope, title, publish_at, created_at, time_limit_minutes, course:courses(name), programme:programmes(name), sections:mock_sections(course_id)",
      )
      .eq("school_id", schoolId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      // DEV-DSH-001: audience filtering happens after this fetch, so read a
      // wider window and apply the stable limit only to authorized rows.
      .limit(100),
    supabase
      .from("mock_attempts")
      .select("mock_exam_id, status, submitted_at, mcq_score")
      .eq("school_id", schoolId)
      .eq("student_id", user.id),
  ]);

  if (
    classesError ||
    assignmentsError ||
    submissionsError ||
    notesError ||
    mocksError ||
    attemptsError
  ) {
    console.error("student_dashboard.activity_failed", {
      classesError,
      assignmentsError,
      submissionsError,
      notesError,
      mocksError,
      attemptsError,
    });
    return c.json(
      {
        error: "Failed to load student dashboard",
        code: "DASHBOARD_LOAD_FAILED",
      },
      500,
    );
  }

  const submittedAssignmentIds = new Set(
    (submissions || []).map((item) => item.assignment_id),
  );
  const attemptedMockIds = new Set(
    (attempts || []).map((item) => item.mock_exam_id),
  );
  const visibleMocks = (mocks || [])
    .filter((item) => studentCanAccessCentreMock(item, mockAudience))
    .slice(0, 6);
  const endOfPeriod = reportingPeriods(
    new Date(),
    resolveReportingTimezone(c.req.query("tz")),
  ).sevenDayEnd;

  const upcomingClasses = (classes || [])
    .filter((item) => item.status === "live" || (item.scheduled_at >= now && new Date(item.scheduled_at) <= endOfPeriod))
    .slice(0, 6)
    .map((item) => ({
      ...item,
      course_name: (item.course_id && courseNames.get(item.course_id)) || "Course",
    }));
  const assignmentsDue = (assignments || [])
    .filter((item) => !submittedAssignmentIds.has(item.id))
    .slice(0, 4)
    .map((item) => ({
      ...item,
      course_name: courseNames.get(item.course_id) || "Course",
    }));
  const recentUpdates = [
    ...(assignments || []).map((item) => ({
      id: item.id,
      type: "assignment",
      title: item.title,
      course_name: courseNames.get(item.course_id) || "Course",
      occurred_at: item.created_at,
      href: `/dashboard/student/assignments`,
    })),
    ...(notes || []).map((item) => ({
      id: item.id,
      type: "material",
      title: item.title,
      course_name: courseNames.get(item.course_id) || "Course",
      occurred_at: item.created_at,
      href: `/dashboard/student/materials`,
    })),
    ...visibleMocks
      .filter((item) => !attemptedMockIds.has(item.id))
      .map((item) => ({
        id: item.id,
        type: "mock",
        title: item.title,
        course_name:
          item.audience_scope === "programme"
            ? (item.programme as any)?.name || "Class"
            : item.audience_scope === "school"
              ? "Entire centre"
              : (item.course as any)?.name ||
                courseNames.get(item.course_id!) ||
                "Course",
        occurred_at: item.publish_at || item.created_at,
        href: `/dashboard/student/mocks`,
      })),
  ]
    .sort(
      (a, b) =>
        new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
    )
    .slice(0, 5);

  return c.json({
    data: {
      student: {
        first_name: profile?.first_name || "",
        last_name: profile?.last_name || "",
      },
      school: { name: school?.name || "Your school" },
      course_count: courseIds.length,
      next_class: upcomingClasses[0] || null,
      upcoming_classes: upcomingClasses,
      assignments_due: assignmentsDue,
      recent_updates: recentUpdates,
      capabilities: { hasCentreLearning: true, hasMarketplaceAccess: false },
    },
  });
});

dashboardRouter.get("/student/progress", async (c) => {
  const user = c.get("user");
  if (user.role !== "student")
    return c.json(
      { error: "Student access only", code: "INSUFFICIENT_ROLE" },
      403,
    );
  try {
    const loadStandaloneMockProgress = async () => {
      const { data: entitlements, error: entitlementError } = await (
        supabase as any
      )
        .from("mock_entitlements")
        .select(
          "mock_exam_version_id, offer:mock_access_offers(mock_exam_id, mock:mock_exams(id, title))",
        )
        .eq("student_id", user.id)
        .is("revoked_at", null);
      if (entitlementError) throw entitlementError;
      const offers = (entitlements || [])
        .map((item: any) => item.offer)
        .filter(Boolean) as Array<{
        mock_exam_id?: unknown;
        mock?: { title?: string | null };
      }>;
      const mockIds: string[] = [
        ...new Set(
          offers
            .map((offer) => offer.mock_exam_id)
            .filter((mockId): mockId is string => typeof mockId === "string"),
        ),
      ];
      if (!mockIds.length) return { mocks: [], attempts: [] };
      const { data: attempts, error: attemptError } = await supabase
        .from("mock_attempts")
        .select(
          "id, mock_exam_id, status, submitted_at, total_score, total_marks, correct_mcq_answers, total_mcq_questions",
        )
        .eq("student_id", user.id)
        .eq("access_source", "entitlement")
        .in("mock_exam_id", mockIds);
      if (attemptError) throw attemptError;
      return {
        mocks: offers.map((offer: any) => ({
          id: offer.mock_exam_id,
          course_id: null,
          title: offer.mock?.title || "Mock",
        })),
        attempts: attempts || [],
      };
    };
    if (!user.school_id) {
      const standaloneMocks = await loadStandaloneMockProgress();
      return c.json({
        data: buildStudentProgress({
          courses: [],
          classes: [],
          attendance: [],
          assignments: [],
          submissions: [],
          ...standaloneMocks,
        }),
      });
    }
    const mockAudience = await loadStudentMockAudience(user);
    const courseIds = mockAudience.courseIds;
    const empty = Promise.resolve({ data: [], error: null });
    const [
      { data: courses, error: courseError },
      { data: classes, error: classError },
      { data: assignments, error: assignmentError },
      { data: submissions, error: submissionError },
      { data: mocks, error: mockError },
      { data: attempts, error: attemptError },
    ] = await Promise.all([
      courseIds.length
        ? supabase
            .from("courses")
            .select("id, name")
            .eq("school_id", user.school_id)
            .in("id", courseIds)
        : empty,
      courseIds.length
        ? supabase
            .from("live_classes")
            .select("id, course_id")
            .eq("school_id", user.school_id)
            .in("course_id", courseIds)
            .eq("status", "completed")
        : empty,
      courseIds.length
        ? supabase
            .from("assignments")
            .select("id, course_id")
            .eq("school_id", user.school_id)
            .in("course_id", courseIds)
            .eq("is_published", true)
        : empty,
      supabase
        .from("submissions")
        .select("assignment_id")
        .eq("school_id", user.school_id)
        .eq("student_id", user.id),
      supabase
        .from("mock_exams")
        .select("id, course_id, programme_id, audience_scope, title")
        .eq("school_id", user.school_id),
      supabase
        .from("mock_attempts")
        .select(
          "id, mock_exam_id, status, submitted_at, total_score, total_marks, correct_mcq_answers, total_mcq_questions",
        )
        .eq("school_id", user.school_id)
        .eq("student_id", user.id),
    ]);
    if (
      courseError ||
      classError ||
      assignmentError ||
      submissionError ||
      mockError ||
      attemptError
    )
      throw (
        courseError ||
        classError ||
        assignmentError ||
        submissionError ||
        mockError ||
        attemptError
      );
    const classIds = (classes || []).map((item) => item.id);
    const [{ data: attendance, error: attendanceError }, standaloneMocks] =
      await Promise.all([
        classIds.length
          ? await supabase
              .from("attendance_records")
              .select("live_class_id")
              .eq("school_id", user.school_id)
              .eq("student_id", user.id)
              .in("live_class_id", classIds)
          : Promise.resolve({ data: [], error: null }),
        loadStandaloneMockProgress(),
      ]);
    if (attendanceError) throw attendanceError;
    return c.json({
      data: buildStudentProgress({
        courses: courses || [],
        classes: (classes || []).flatMap((item) => item.course_id ? [{ id: item.id, course_id: item.course_id }] : []),
        attendance: attendance || [],
        assignments: assignments || [],
        submissions: submissions || [],
        mocks: [
          ...(mocks || []).filter((mock) =>
            studentCanAccessCentreMock(mock, mockAudience),
          ),
          ...standaloneMocks.mocks,
        ],
        attempts: [...(attempts || []), ...standaloneMocks.attempts],
      }),
    });
  } catch (error) {
    console.error("student_progress.load_failed", {
      studentId: user.id,
      error,
    });
    return c.json(
      { error: "Could not load your progress", code: "PROGRESS_LOAD_FAILED" },
      500,
    );
  }
});

// Navigation permissions must not require the expensive dashboard summary.
// This response is cached client-side by TanStack Query; Hono remains the
// authority for the admin/tutor capability and organisation type.
dashboardRouter.get("/capabilities", async (c) => {
  const user = c.get("user");
  const schoolId = user.school_id;
  if (!schoolId)
    return c.json({ error: "User does not belong to a school" }, 400);

  const isAdmin = user.role === "admin";
  let isTutor = user.role === "tutor";
  if (isAdmin) {
    const { data: assignment, error } = await supabase
      .from("tutor_course_assignments")
      .select("id")
      .eq("school_id", schoolId)
      .eq("tutor_id", user.id)
      .limit(1)
      .maybeSingle();
    if (error)
      return c.json({ error: "Could not resolve teaching access" }, 500);
    isTutor = Boolean(assignment);
  }

  const [
    { data: school, error: schoolError },
    { data: profile, error: profileError },
  ] = await Promise.all([
    supabase
      .from("schools")
      .select("account_type, name, logo_url")
      .eq("id", schoolId)
      .maybeSingle(),
    supabase
      .from("user_profiles")
      .select("profile_photo_url")
      .eq("id", user.id)
      .maybeSingle(),
  ]);
  if (schoolError)
    return c.json({ error: "Could not resolve organisation type" }, 500);
  // The photo is presentation only: the shell shows initials without it.
  if (profileError)
    console.error("dashboard_capabilities.profile_photo_failed", { profileError });

  return c.json({
    data: {
      profile_id: user.id,
      is_admin: isAdmin,
      is_tutor: isTutor,
      organisation_type:
        school?.account_type === "independent" ? "independent" : "centre",
      // The app shell's account card and user card (01-app-shell SH-02).
      account_name: school?.name ?? null,
      account_logo_url: school?.logo_url ?? null,
      profile_photo_url: profile?.profile_photo_url ?? null,
    },
  });
});

dashboardRouter.get("/stats", async (c) => {
  const user = c.get("user");
  const schoolId = user.school_id;

  if (!schoolId) {
    return c.json({ error: "User does not belong to a school" }, 400);
  }

  const role = user.role;
  const periods = reportingPeriods(new Date(), resolveReportingTimezone(c.req.query("tz")));

  // Determine capabilities
  let isAdmin = role === "admin";
  let isTutor = role === "tutor";
  const responseData: any = {};
  const health = new DashboardHealth();

  // If admin, check if they are also assigned as a tutor
  if (isAdmin) {
    const { count, error: capabilityError } = await supabase
      .from("tutor_course_assignments")
      .select("*", { count: "exact", head: true })
      .eq("tutor_id", user.id)
      .eq("school_id", schoolId);
    health.check("tutor_capability", capabilityError);

    if (count && count > 0) {
      isTutor = true;
    }
  }

  const { data: school, error: schoolError } = await supabase
    .from("schools")
    .select("account_type")
    .eq("id", schoolId)
    .maybeSingle();
  if (schoolError)
  {
    console.error("[dashboard] organisation type lookup failed", { code: schoolError.code, message: schoolError.message });
    return c.json(
      { error: "Could not resolve organisation type", code: "DATABASE_ERROR" },
      500,
    );
  }
  responseData.organisation_type =
    school?.account_type === "independent" ? "independent" : "centre";
  responseData.reporting = {
    timezone: periods.timezone,
    today_start: periods.todayStart.toISOString(),
    today_end: periods.todayEnd.toISOString(),
    month_start: periods.monthStart.toISOString(),
  };

  // Fetch admin stats if they have admin capability
  if (isAdmin) {
    const startOfMonth = periods.monthStart;
    const startOfToday = periods.todayStart;
    const endOfToday = periods.todayEnd;

    const [
      { count: totalStudents, error: totalStudentsError },
      { data: tutorMembers, error: tutorProfilesError },
      { data: teachingAssignments, error: teachingAssignmentsError },
      { count: upcomingClasses, error: upcomingClassesError },
      { data: payments, error: paymentsError },
      { count: successfulPayments, error: successfulPaymentsError },
    ] = await Promise.all([
      // DEV-DSH-005: canonical active memberships, not mutable profile hints.
      supabase
        .from("account_memberships")
        .select("*", { count: "exact", head: true })
        .eq("role", "learner")
        .eq("status", "active")
        .eq("school_id", schoolId),
      supabase
        .from("account_memberships")
        .select("person_id, role")
        .in("role", ["tutor", "admin"])
        .eq("status", "active")
        .eq("school_id", schoolId),
      supabase
        .from("tutor_course_assignments")
        .select("tutor_id")
        .eq("school_id", schoolId),
      supabase
        .from("live_classes")
        .select("*", { count: "exact", head: true })
        .eq("status", "scheduled")
        .eq("school_id", schoolId)
        .gte("scheduled_at", startOfToday.toISOString())
        .lte("scheduled_at", endOfToday.toISOString()),
      supabase
        .from("payments")
        .select("centre_amount")
        .eq("status", "successful")
        .eq("school_id", schoolId)
        .gte("paid_at", startOfMonth.toISOString()),
      supabase
        .from("payments")
        .select("*", { count: "exact", head: true })
        .eq("status", "successful")
        .eq("school_id", schoolId)
        .gte("paid_at", startOfMonth.toISOString()),
    ]);

    health.check("total_students", totalStudentsError);
    health.check("tutors_count", tutorProfilesError ?? teachingAssignmentsError);
    health.check("upcoming_classes", upcomingClassesError);
    health.check("mtd_revenue", paymentsError);
    health.check("successful_payments", successfulPaymentsError);
    const mtdRevenue = payments
      ? payments.reduce((sum, p) => sum + Number(p.centre_amount), 0)
      : 0;
    // Tutors are active Tutor members plus active members (an Admin who also
    // teaches) holding a course assignment; revoked members never count.
    const activeStaff = new Map((tutorMembers || []).map((member: any) => [member.person_id, member.role]));
    const tutorIds = new Set<string>([
      ...(tutorMembers || []).filter((member: any) => member.role === "tutor").map((member: any) => member.person_id),
      ...(teachingAssignments || [])
        .map((assignment) => assignment.tutor_id)
        .filter((tutorId) => activeStaff.has(tutorId)),
    ]);

    const [needsGrading, mockOverview] = await Promise.all([
      loadNeedsGrading(schoolId, undefined, health),
      loadMockOverview(schoolId, undefined, health),
    ]);

    responseData.admin_stats = {
      total_students: totalStudents || 0,
      tutors_count: tutorIds.size,
      upcoming_classes: upcomingClasses || 0,
      mtd_revenue: mtdRevenue,
      successful_payments: successfulPayments || 0,
      needs_grading: [...mockOverview.items, ...needsGrading].slice(0, 4),
      mocks: mockOverview,
    };
  }

  // Fetch tutor stats if they have tutor capability
  if (isTutor) {
    const startOfDay = periods.todayStart;
    const endOfDay = periods.todayEnd;

    const [
      { count: classesToday, error: classesTodayError },
      { count: myCourses, error: myCoursesError },
      { data: pendingSubmissionCount, error: tutorAssignmentsError },
    ] = await Promise.all([
      supabase
        .from("live_classes")
        .select("*", { count: "exact", head: true })
        .eq("tutor_id", user.id)
        .eq("school_id", schoolId)
        // DEV-DSH-007: same eligible statuses as the today_schedule projection.
        .in("status", ["scheduled", "live"])
        .gte("scheduled_at", startOfDay.toISOString())
        .lte("scheduled_at", endOfDay.toISOString()),

      supabase
        .from("tutor_course_assignments")
        .select("*", { count: "exact", head: true })
        .eq("tutor_id", user.id)
        .eq("school_id", schoolId),

      // DEV-DSH-003: one aggregate instead of loading every assignment id.
      (supabase as any).rpc("dashboard_pending_submissions", { p_school_id: schoolId, p_tutor_id: user.id }),
    ]);

    health.check("classes_today", classesTodayError);
    health.check("my_courses", myCoursesError);
    health.check("pending_submissions", tutorAssignmentsError);
    const pendingSubmissions = Number(pendingSubmissionCount) || 0;

    const mockOverview = await loadMockOverview(schoolId, user.id, health);
    responseData.tutor_stats = {
      classes_today: classesToday || 0,
      pending_submissions: pendingSubmissions,
      my_courses: myCourses || 0,
      needs_grading: [
        ...mockOverview.items,
        ...(await loadNeedsGrading(schoolId, user.id, health)),
      ].slice(0, 4),
      mocks: mockOverview,
    };
  }

  const startOfToday = periods.todayStart;
  const endOfToday = periods.todayEnd;
  let scheduleQuery = supabase
    .from("live_classes")
    .select("id, title, scheduled_at, duration_minutes, status, courses!live_classes_course_id_fkey(name)")
    .eq("school_id", schoolId)
    .gte("scheduled_at", startOfToday.toISOString())
    .lte("scheduled_at", endOfToday.toISOString())
    .in("status", ["scheduled", "live"])
    .order("scheduled_at", { ascending: true })
    .limit(6);
  if (!isAdmin) scheduleQuery = scheduleQuery.eq("tutor_id", user.id);
  const { data: todaySchedule, error: scheduleError } = await scheduleQuery;
  if (scheduleError)
    return c.json({ error: "Failed to load dashboard schedule" }, 500);
  responseData.today_schedule = todaySchedule || [];

  if (isTutor) {
    const { data: myTodaySchedule, error: myScheduleError } = await supabase
      .from("live_classes")
      .select(
        "id, title, scheduled_at, duration_minutes, status, courses!live_classes_course_id_fkey(name)",
      )
      .eq("school_id", schoolId)
      .eq("tutor_id", user.id)
      .gte("scheduled_at", startOfToday.toISOString())
      .lte("scheduled_at", endOfToday.toISOString())
      .in("status", ["scheduled", "live"])
      .order("scheduled_at", { ascending: true })
      .limit(6);
    if (myScheduleError)
      return c.json({ error: "Failed to load teaching schedule" }, 500);
    responseData.my_today_schedule = myTodaySchedule || [];
  }

  responseData.data_status = health.status();
  return c.json({ data: responseData });
});

// 03-dashboard DB-01, DB-03, DB-04, DB-07, DB-08: one read for the dashboard
// frame. Independent tutors and agency tutors see their own lessons; agency
// admins see every tutor's lessons unless `mine=1`.
const LESSON_COLUMNS =
  "id, title, scheduled_at, duration_minutes, status, course_id, tutor_id, courses!live_classes_course_id_fkey(name)";

dashboardRouter.get("/overview", async (c) => {
  const user = c.get("user");
  const schoolId = user.school_id;
  if (!schoolId) return c.json({ error: "User does not belong to a school" }, 400);
  if (user.role !== "admin" && user.role !== "tutor")
    return c.json({ error: "Staff access only", code: "INSUFFICIENT_ROLE" }, 403);

  const now = new Date();
  const timezone = resolveReportingTimezone(c.req.query("tz"));
  const offsetParam = Number.parseInt(c.req.query("week") ?? "0", 10);
  const weekOffset = Number.isFinite(offsetParam) ? Math.max(-52, Math.min(52, offsetParam)) : 0;
  const week = weekPeriods(now, timezone, weekOffset);
  const today = reportingPeriods(now, timezone);

  const [
    { data: school, error: schoolError },
    { data: assignment, error: assignmentError },
  ] = await Promise.all([
    supabase.from("schools").select("account_type").eq("id", schoolId).maybeSingle(),
    user.role === "admin"
      ? supabase
          .from("tutor_course_assignments")
          .select("id")
          .eq("school_id", schoolId)
          .eq("tutor_id", user.id)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (schoolError || assignmentError)
    return c.json({ error: "Failed to load dashboard", code: "DATABASE_ERROR" }, 500);

  const independent = school?.account_type === "independent";
  const isAdmin = user.role === "admin";
  const teaches = user.role === "tutor" || Boolean(assignment);
  const view = independent ? "independent" : isAdmin ? "agency_admin" : "agency_tutor";
  const mineOnly = view === "agency_admin" && c.req.query("mine") === "1";
  const scopeAll = view === "agency_admin" && !mineOnly;

  const lessonQuery = (from: Date, to: Date) => {
    let query = supabase
      .from("live_classes")
      .select(LESSON_COLUMNS)
      .eq("school_id", schoolId)
      .gte("scheduled_at", from.toISOString())
      .lte("scheduled_at", to.toISOString())
      .order("scheduled_at", { ascending: true });
    if (!scopeAll) query = query.eq("tutor_id", user.id);
    return query;
  };

  let nextQuery = supabase
    .from("live_classes")
    .select(LESSON_COLUMNS)
    .eq("school_id", schoolId)
    .eq("status", "scheduled")
    .gt("scheduled_at", today.todayEnd.toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(1);
  if (!scopeAll) nextQuery = nextQuery.eq("tutor_id", user.id);

  const [
    { data: todayRows, error: todayError },
    { data: weekRows, error: weekError },
    { data: nextRows, error: nextError },
  ] = await Promise.all([
    lessonQuery(today.todayStart, today.todayEnd),
    lessonQuery(week.weekStart, week.weekEnd),
    nextQuery,
  ]);
  if (todayError || weekError || nextError) {
    console.error("dashboard.overview_failed", { code: (todayError ?? weekError ?? nextError)?.code });
    return c.json({ error: "Failed to load dashboard", code: "DATABASE_ERROR" }, 500);
  }

  const todayLessons: any[] = todayRows || [];
  const weekLessons: any[] = weekRows || [];
  const nextLesson: any = (nextRows || [])[0] ?? null;
  const all = [...todayLessons, ...weekLessons, ...(nextLesson ? [nextLesson] : [])];

  let hasAnyLesson = all.length > 0;
  if (!hasAnyLesson) {
    let anyQuery = supabase
      .from("live_classes")
      .select("id")
      .eq("school_id", schoolId)
      .limit(1);
    if (!scopeAll) anyQuery = anyQuery.eq("tutor_id", user.id);
    const { data: anyRows, error: anyError } = await anyQuery;
    if (anyError) return c.json({ error: "Failed to load dashboard", code: "DATABASE_ERROR" }, 500);
    hasAnyLesson = (anyRows || []).length > 0;
  }

  const tutorIds = [...new Set(all.map((lesson) => lesson.tutor_id as string))];
  const courseIds = [...new Set(all.map((lesson) => lesson.course_id as string).filter(Boolean))];
  const [tutorResult, studentCounts] = await Promise.all([
    scopeAll && tutorIds.length
      ? supabase.from("user_profiles").select("id, first_name, last_name").in("id", tutorIds)
      : Promise.resolve({ data: [], error: null }),
    Promise.all(
      courseIds.map(async (courseId) => {
        try {
          return [courseId, (await listCourseLearnerIds(schoolId, courseId)).length] as const;
        } catch (error) {
          console.error("dashboard.student_count_failed", { courseId });
          return [courseId, null] as const;
        }
      }),
    ),
  ]);
  if (tutorResult.error)
    console.error("dashboard.tutor_names_failed", { code: tutorResult.error.code });
  const tutorNames = new Map(
    ((tutorResult.data || []) as any[]).map((row) => [
      row.id as string,
      [row.first_name, row.last_name].filter(Boolean).join(" ") || null,
    ]),
  );
  const counts = new Map(studentCounts);

  const shape = (lesson: any) => ({
    id: lesson.id,
    title: lesson.title,
    scheduled_at: lesson.scheduled_at,
    duration_minutes: lesson.duration_minutes,
    status: lessonDisplayStatus(lesson, now),
    course_id: lesson.course_id,
    course_name: lesson.courses?.name ?? null,
    student_count: counts.get(lesson.course_id) ?? null,
    tutor_id: lesson.tutor_id,
    tutor_name: scopeAll ? (tutorNames.get(lesson.tutor_id) ?? null) : null,
  });

  const weekShaped = weekLessons.map(shape);
  return c.json({
    data: {
      view,
      teaches,
      scope: scopeAll ? "all" : "own",
      timezone,
      classroom_opens_minutes: DEFAULT_CLASSROOM_OPENS_MINUTES,
      has_any_lesson: hasAnyLesson,
      today: todayLessons.map(shape),
      next_lesson: nextLesson ? shape(nextLesson) : null,
      week: {
        offset: weekOffset,
        today_index: week.todayIndex,
        days: week.days.map((day) => ({
          date: day.date,
          lesson_count: weekShaped.filter((lesson) => {
            const at = new Date(lesson.scheduled_at).getTime();
            return at >= day.start.getTime() && at <= day.end.getTime();
          }).length,
        })),
        lessons: weekShaped.map((lesson) => ({
          ...lesson,
          day_index: week.days.findIndex((day) => {
            const at = new Date(lesson.scheduled_at).getTime();
            return at >= day.start.getTime() && at <= day.end.getTime();
          }),
        })),
      },
    },
  });
});
