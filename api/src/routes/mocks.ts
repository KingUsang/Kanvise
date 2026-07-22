import { Hono } from "hono";
import { supabase } from "../lib/supabase";
import { jwtVerificationMiddleware, profileResolutionMiddleware, requireRole } from "../middleware/auth";
import { AppVariables } from "../types";
import { notifyMockPublished } from "../notifications/triggers";

export const mocksRouter = new Hono<{ Variables: AppVariables }>();

mocksRouter.use("*", jwtVerificationMiddleware, profileResolutionMiddleware);

const requireTutorOrAdmin = requireRole("tutor", "admin");

export type PublishableQuestion = {
  question_text?: string | null;
  question_type?: string | null;
  marks?: number | string | null;
  options?: Array<{ option_text?: string | null; is_correct?: boolean }> | null;
};

export function validateMockForPublication(questions: PublishableQuestion[]) {
  if (questions.length === 0) return ["Add at least one question before publishing"];

  const errors: string[] = [];
  questions.forEach((question, index) => {
    const label = `Question ${index + 1}`;
    if (!question.question_text?.trim()) errors.push(`${label} needs question text`);
    if (!Number.isFinite(Number(question.marks)) || Number(question.marks) <= 0) errors.push(`${label} needs positive marks`);
    if (question.question_type === "mcq") {
      const completedOptions = (question.options || []).filter((option) => option.option_text?.trim());
      if (completedOptions.length < 2) errors.push(`${label} needs at least two options`);
      if (completedOptions.filter((option) => option.is_correct).length !== 1) errors.push(`${label} needs exactly one correct option`);
    }
  });
  return errors;
}

async function tutorCanAccessCourse(user: any, courseId: string) {
  if (user.role === "admin") return true;
  const { data } = await supabase.from("tutor_course_assignments")
    .select("course_id")
    .eq("school_id", user.school_id)
    .eq("tutor_id", user.id)
    .eq("course_id", courseId)
    .maybeSingle();
  return !!data;
}

async function loadMockMetrics(mockIds: string[], schoolId: string) {
  const metrics = new Map(mockIds.map((id) => [id, { attempts: 0, pending_grading: 0 }]));
  if (mockIds.length === 0) return metrics;

  const { data: attempts, error } = await supabase.from("mock_attempts")
    .select("id, mock_exam_id, status")
    .eq("school_id", schoolId)
    .in("mock_exam_id", mockIds);
  if (error) throw error;

  for (const attempt of attempts || []) {
    const item = metrics.get(attempt.mock_exam_id);
    if (!item) continue;
    item.attempts += 1;
    if (attempt.status === "submitted" || attempt.status === "timed_out") item.pending_grading += 1;
  }
  return metrics;
}

// GET /mocks (Lists mocks, primarily for the tutor dashboard)
mocksRouter.get("/", requireTutorOrAdmin, async (c) => {
  const user = c.get("user");
  if (!user.school_id) return c.json({ error: "No school assigned" }, 403);

  let query = supabase
    .from("mock_exams")
    .select(`
      *,
      course:courses(id, name)
    `)
    .eq("school_id", user.school_id)
    .order("created_at", { ascending: false });

  if (user.role === "tutor") {
    // Tutors only see mocks for courses they are assigned to
    const { data: assignments, error: assignError } = await supabase
      .from("tutor_course_assignments")
      .select("course_id")
      .eq("tutor_id", user.id)
      .eq("school_id", user.school_id);

    if (assignError) return c.json({ error: assignError.message }, 500);

    const assignedCourseIds = assignments.map((a: any) => a.course_id);
    
    if (assignedCourseIds.length === 0) {
      return c.json({ data: [] });
    }
    
    query = query.in("course_id", assignedCourseIds);
  }

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);

  const metrics = await loadMockMetrics((data || []).map((mock: any) => mock.id), user.school_id);
  const mocksWithMetrics = (data || []).map((mock: any) => ({
    ...mock,
    metrics: metrics.get(mock.id) || { attempts: 0, pending_grading: 0 }
  }));

  return c.json({ data: mocksWithMetrics });
});

// GET /mocks/ungraded-count (Sidebar badge)
mocksRouter.get("/ungraded-count", requireTutorOrAdmin, async (c) => {
  const user = c.get("user");
  if (!user.school_id) return c.json({ error: "No school assigned" }, 403);
  let query = supabase.from("mock_exams").select("id, course_id").eq("school_id", user.school_id);
  if (user.role === "tutor") {
    const { data: assignments } = await supabase.from("tutor_course_assignments")
      .select("course_id").eq("school_id", user.school_id).eq("tutor_id", user.id);
    const courseIds = (assignments || []).map((assignment: any) => assignment.course_id);
    if (courseIds.length === 0) return c.json({ data: { count: 0 } });
    query = query.in("course_id", courseIds);
  }
  const { data: mocks, error } = await query;
  if (error) return c.json({ error: "Failed to load grading count" }, 500);
  const metrics = await loadMockMetrics((mocks || []).map((mock: any) => mock.id), user.school_id);
  const count = [...metrics.values()].reduce((sum, item) => sum + item.pending_grading, 0);
  return c.json({ data: { count } });
});

// GET /mocks/:id/results — tutor/admin review workspace data.
mocksRouter.get("/:id/results", requireTutorOrAdmin, async (c) => {
  const user = c.get("user");
  const mockId = c.req.param("id");

  const { data: mock, error: mockError } = await supabase.from("mock_exams")
    .select("id, title, status, course_id, course:courses(name)")
    .eq("id", mockId).eq("school_id", user.school_id).maybeSingle();
  if (mockError || !mock) return c.json({ error: "Mock not found" }, 404);
  if (!(await tutorCanAccessCourse(user, mock.course_id))) return c.json({ error: "You are not assigned to this mock's course" }, 403);

  const { data: attempts, error: attemptsError } = await supabase.from("mock_attempts")
    .select("id, student_id, started_at, submitted_at, status, mcq_score, total_mcq_questions, correct_mcq_answers, student:user_profiles(first_name, last_name, email)")
    .eq("mock_exam_id", mockId).eq("school_id", user.school_id).order("submitted_at", { ascending: false });
  if (attemptsError) return c.json({ error: "Failed to load mock attempts" }, 500);

  const attemptIds = (attempts || []).map((attempt: any) => attempt.id);
  const { data: answers, error: answersError } = attemptIds.length
    ? await supabase.from("mock_answers")
      .select("id, attempt_id, theory_answer_text, is_correct, tutor_score, tutor_feedback, question:mock_questions(id, question_text, question_type, marks, order_index)")
      .eq("school_id", user.school_id).in("attempt_id", attemptIds)
    : { data: [], error: null };
  if (answersError) return c.json({ error: "Failed to load mock answers" }, 500);

  const answersByAttempt = new Map<string, any[]>();
  for (const answer of answers || []) {
    const current = answersByAttempt.get(answer.attempt_id) || [];
    current.push(answer);
    answersByAttempt.set(answer.attempt_id, current);
  }

  return c.json({ data: {
    mock,
    attempts: (attempts || []).map((attempt: any) => ({
      ...attempt,
      answers: (answersByAttempt.get(attempt.id) || []).sort((a, b) =>
        Number((a.question as any)?.order_index || 0) - Number((b.question as any)?.order_index || 0)),
    })),
  } });
});

// GET /mocks/:id (Fetch mock details)
mocksRouter.get("/:id", requireTutorOrAdmin, async (c) => {
  const user = c.get("user");
  if (!user.school_id) return c.json({ error: "No school assigned" }, 403);
  const mockId = c.req.param("id");

  const { data, error } = await supabase
    .from("mock_exams")
    .select("*, course:courses(id, name)")
    .eq("id", mockId)
    .eq("school_id", user.school_id)
    .single();

  if (error) return c.json({ error: error.message }, 500);
  if (!data) return c.json({ error: "Mock not found" }, 404);
  if (!(await tutorCanAccessCourse(user, data.course_id))) return c.json({ error: "You are not assigned to this mock's course" }, 403);
  return c.json({ data });
});

// GET /mocks/:id/questions (Fetch questions for a mock)
mocksRouter.get("/:id/questions", requireTutorOrAdmin, async (c) => {
  const user = c.get("user");
  if (!user.school_id) return c.json({ error: "No school assigned" }, 403);
  const mockId = c.req.param("id");

  const { data: mock } = await supabase.from("mock_exams").select("course_id")
    .eq("id", mockId).eq("school_id", user.school_id).maybeSingle();
  if (!mock) return c.json({ error: "Mock not found" }, 404);
  if (!(await tutorCanAccessCourse(user, mock.course_id))) return c.json({ error: "You are not assigned to this mock's course" }, 403);

  const { data, error } = await supabase
    .from("mock_questions")
    .select("*, options:mock_question_options(*)")
    .eq("mock_exam_id", mockId)
    .eq("school_id", user.school_id)
    .order("order_index", { ascending: true });

  if (error) return c.json({ error: error.message }, 500);

  return c.json({ data: data || [] });
});

// POST /mocks/:id/archive — preserve attempts and results while removing the
// mock from active teaching workflows.
mocksRouter.post("/:id/archive", requireTutorOrAdmin, async (c) => {
  const user = c.get("user");
  if (!user.school_id) return c.json({ error: "No school assigned" }, 403);

  const mockId = c.req.param("id");
  const { data: mock } = await supabase.from("mock_exams").select("course_id")
    .eq("id", mockId).eq("school_id", user.school_id).maybeSingle();
  if (!mock) return c.json({ error: "Mock not found" }, 404);
  if (!(await tutorCanAccessCourse(user, mock.course_id))) return c.json({ error: "You are not assigned to this mock's course" }, 403);

  const { data, error } = await supabase.from("mock_exams")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", mockId).eq("school_id", user.school_id).select().single();
  if (error) return c.json({ error: "Failed to archive mock" }, 500);
  return c.json({ message: "Mock archived", data });
});

// POST /mocks (Create a new mock)
mocksRouter.post("/", requireTutorOrAdmin, async (c) => {
  const user = c.get("user");
  if (!user.school_id) return c.json({ error: "No school assigned" }, 403);

  const body = await c.req.json();
  const { title, description, course_id, publish_at, time_limit_minutes } = body;

  if (!title || !course_id) {
    return c.json({ error: "Missing required fields" }, 400);
  }
  if (!(await tutorCanAccessCourse(user, course_id))) return c.json({ error: "You are not assigned to this course" }, 403);

  // Use the kanvise_user_id (which is a UUID in the kanvise_users table) for tutor_id
  const tutorId = user.id;

  const { data, error } = await supabase
    .from("mock_exams")
    .insert([
      {
        school_id: user.school_id,
        tutor_id: tutorId,
        course_id,
        title,
        description,
        status: "draft",
        publish_at,
        time_limit_minutes: time_limit_minutes || 0,
        total_mcq_questions: 0,
        total_theory_questions: 0,
      },
    ])
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);

  return c.json({ data }, 201);
});

// PUT /mocks/:id (Update mock metadata)
mocksRouter.put("/:id", requireTutorOrAdmin, async (c) => {
  const user = c.get("user");
  if (!user.school_id) return c.json({ error: "No school assigned" }, 403);

  const mockId = c.req.param("id");
  const body = await c.req.json();
  const { title, description, course_id, publish_at, time_limit_minutes } = body;

  // Verify mock exists and is draft
  const { data: existingMock, error: fetchError } = await supabase
    .from("mock_exams")
    .select("status, tutor_id, course_id")
    .eq("id", mockId)
    .eq("school_id", user.school_id)
    .single();

  if (fetchError || !existingMock) return c.json({ error: "Mock not found" }, 404);
  
  if (existingMock.status !== "draft") {
    return c.json({ error: "Only draft mocks can be edited" }, 400);
  }

  if (!(await tutorCanAccessCourse(user, course_id))) return c.json({ error: "You are not assigned to this course" }, 403);

  const { data, error } = await supabase
    .from("mock_exams")
    .update({
      title,
      description,
      course_id,
      publish_at,
      time_limit_minutes: time_limit_minutes || 0,
      updated_at: new Date().toISOString()
    })
    .eq("id", mockId)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);

  return c.json({ data });
});

// POST /mocks/:id/questions (Add questions to a mock)
mocksRouter.post("/:id/questions", requireTutorOrAdmin, async (c) => {
  const user = c.get("user");
  if (!user.school_id) return c.json({ error: "No school assigned" }, 403);

  const mockId = c.req.param("id");
  const body = await c.req.json();
  const { question_type, question_text, marks, order_index, options, grading_rubric } = body;

  if (!question_type || !question_text) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  const { data: mock } = await supabase.from("mock_exams").select("status, course_id")
    .eq("id", mockId).eq("school_id", user.school_id).maybeSingle();
  if (!mock) return c.json({ error: "Mock not found" }, 404);
  if (mock.status !== "draft") return c.json({ error: "Only draft mocks can be edited" }, 409);
  if (!(await tutorCanAccessCourse(user, mock.course_id))) return c.json({ error: "You are not assigned to this mock's course" }, 403);

  if (question_type === "mcq" && (!options || options.length === 0)) {
    return c.json({ error: "MCQ_REQUIRES_OPTIONS" }, 400);
  }

  if (question_type === "mcq") {
    const hasCorrectOption = options.some((opt: any) => opt.is_correct);
    if (!hasCorrectOption) {
      return c.json({ error: "MCQ_MUST_HAVE_ONE_CORRECT_OPTION" }, 400);
    }
  }

  // Insert the question
  const { data: question, error: questionError } = await supabase
    .from("mock_questions")
    .insert([
      {
        school_id: user.school_id,
        mock_exam_id: mockId,
        question_type,
        question_text,
        marks: marks || 1,
        order_index: order_index || 1,
        grading_rubric: grading_rubric || null, // Newly added column
      },
    ])
    .select()
    .single();

  if (questionError) return c.json({ error: questionError.message }, 500);

  // If MCQ, insert options
  if (question_type === "mcq" && options && options.length > 0) {
    const optionsToInsert = options.map((opt: any, idx: number) => ({
      school_id: user.school_id,
      question_id: question.id,
      option_text: opt.option_text,
      is_correct: opt.is_correct,
      order_index: opt.order_index || idx + 1,
    }));

    const { error: optionsError } = await supabase
      .from("mock_question_options")
      .insert(optionsToInsert);

    if (optionsError) {
      return c.json({ error: optionsError.message }, 500);
    }
  }

  // Update counts on the mock_exam
  if (question_type === "mcq") {
    const { data: currentMock } = await supabase.from("mock_exams").select("total_mcq_questions").eq("id", mockId).single();
    if (currentMock) {
      await supabase.from("mock_exams").update({ total_mcq_questions: currentMock.total_mcq_questions + 1 }).eq("id", mockId);
    }
  } else {
    const { data: currentMock } = await supabase.from("mock_exams").select("total_theory_questions").eq("id", mockId).single();
    if (currentMock) {
      await supabase.from("mock_exams").update({ total_theory_questions: currentMock.total_theory_questions + 1 }).eq("id", mockId);
    }
  }

  return c.json({ data: question }, 201);
});

// PUT /mocks/:id/questions (Bulk overwrite questions for a mock)
mocksRouter.put("/:id/questions", requireTutorOrAdmin, async (c) => {
  const user = c.get("user");
  if (!user.school_id) return c.json({ error: "No school assigned" }, 403);

  const mockId = c.req.param("id");
  const body = await c.req.json();
  const { questions } = body; // Array of question objects

  if (!questions || !Array.isArray(questions)) {
    return c.json({ error: "Questions array is required" }, 400);
  }

  // Verify mock exists, is draft, and passes security constraints
  const { data: existingMock } = await supabase
    .from("mock_exams")
    .select("status, tutor_id, course_id")
    .eq("id", mockId)
    .eq("school_id", user.school_id)
    .single();

  if (!existingMock) return c.json({ error: "Mock not found" }, 404);
  if (existingMock.status !== "draft") return c.json({ error: "Only draft mocks can be edited" }, 400);
  if (!(await tutorCanAccessCourse(user, existingMock.course_id))) return c.json({ error: "You are not assigned to this mock's course" }, 403);

  if (questions.length > 0) {
    const validationErrors = validateMockForPublication(questions);
    if (validationErrors.length > 0) return c.json({ error: "Invalid questions", details: validationErrors }, 400);
  }

  // 1. Delete existing questions (cascade deletes options)
  const { error: deleteError } = await supabase
    .from("mock_questions")
    .delete()
    .eq("mock_exam_id", mockId);

  if (deleteError) return c.json({ error: deleteError.message }, 500);

  let mcqCount = 0;
  let theoryCount = 0;

  // 2. Insert new questions sequentially
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const qType = q.question_type;
    
    if (qType === "mcq") mcqCount++;
    else theoryCount++;

    const { data: insertedQuestion, error: qError } = await supabase
      .from("mock_questions")
      .insert([{
        school_id: user.school_id,
        mock_exam_id: mockId,
        question_type: qType,
        question_text: q.question_text,
        marks: q.marks || 1,
        order_index: i + 1,
        grading_rubric: q.grading_rubric || null,
      }])
      .select()
      .single();

    if (qError) return c.json({ error: qError.message }, 500);

    // Insert options if MCQ
    if (qType === "mcq" && q.options && q.options.length > 0) {
      const optionsToInsert = q.options.map((opt: any, idx: number) => ({
        school_id: user.school_id,
        question_id: insertedQuestion.id,
        option_text: opt.option_text,
        is_correct: opt.is_correct,
        order_index: opt.order_index || idx + 1,
      }));

      const { error: optionsError } = await supabase
        .from("mock_question_options")
        .insert(optionsToInsert);

      if (optionsError) return c.json({ error: optionsError.message }, 500);
    }
  }

  // 3. Update total question counts on the mock_exam
  await supabase
    .from("mock_exams")
    .update({ 
      total_mcq_questions: mcqCount, 
      total_theory_questions: theoryCount 
    })
    .eq("id", mockId);

  return c.json({ message: "Questions updated successfully" });
});

// POST /mocks/:id/publish (Publish a mock immediately)
mocksRouter.post("/:id/publish", requireTutorOrAdmin, async (c) => {
  const user = c.get("user");
  if (!user.school_id) return c.json({ error: "No school assigned" }, 403);

  const mockId = c.req.param("id");

  const { data: mock, error: mockError } = await supabase.from("mock_exams")
    .select("id, status, course_id, time_limit_minutes")
    .eq("id", mockId).eq("school_id", user.school_id).maybeSingle();
  if (mockError || !mock) return c.json({ error: "Mock not found" }, 404);
  if (mock.status !== "draft") return c.json({ error: "Only draft mocks can be published" }, 409);
  if (!(await tutorCanAccessCourse(user, mock.course_id))) return c.json({ error: "You are not assigned to this mock's course" }, 403);
  if (mock.time_limit_minutes !== null && Number(mock.time_limit_minutes) < 0) {
    return c.json({ error: "Time limit cannot be negative" }, 400);
  }

  const { data: questions, error: questionError } = await supabase.from("mock_questions")
    .select("question_text, question_type, marks, options:mock_question_options(option_text, is_correct)")
    .eq("mock_exam_id", mockId).eq("school_id", user.school_id).order("order_index");
  if (questionError) return c.json({ error: "Failed to validate mock questions" }, 500);
  const validationErrors = validateMockForPublication((questions || []) as PublishableQuestion[]);
  if (validationErrors.length > 0) {
    return c.json({ error: "Mock is not ready to publish", details: validationErrors }, 400);
  }

  const { data, error } = await supabase
    .from("mock_exams")
    .update({ status: "published", publish_at: new Date().toISOString() })
    .eq("id", mockId)
    .eq("school_id", user.school_id) // Tenant isolation
    .select("*, course:courses(name)")
    .single();

  if (error) return c.json({ error: error.message }, 500);

  const notification = await notifyMockPublished({
    id: data.id,
    schoolId: data.school_id,
    courseId: data.course_id,
    title: data.title,
    courseName: (data.course as any)?.name || "Your course",
  });
  if (notification.failures.length === 0) {
    await supabase.from("mock_exams").update({ notification_sent: true }).eq("id", data.id);
  }

  return c.json({ message: "Mock published successfully", data, notification });
});
