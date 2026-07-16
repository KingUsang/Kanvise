import { Hono } from "hono";
import { supabase } from "../lib/supabase";
import { jwtVerificationMiddleware, profileResolutionMiddleware, requireRole } from "../middleware/auth";
import { AppVariables } from "../types";

export const mocksRouter = new Hono<{ Variables: AppVariables }>();

mocksRouter.use("*", jwtVerificationMiddleware, profileResolutionMiddleware);

const requireTutorOrAdmin = requireRole("tutor", "admin");

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

  // We haven't built student attempts yet, so metrics are hardcoded for now
  const mocksWithMetrics = (data || []).map((mock: any) => ({
    ...mock,
    metrics: { attempts: 0, pending_grading: 0 }
  }));

  return c.json({ data: mocksWithMetrics });
});

// GET /mocks/ungraded-count (Sidebar badge)
mocksRouter.get("/ungraded-count", requireTutorOrAdmin, async (c) => {
  // Since student attempts are not built yet, return 0
  return c.json({ data: { count: 0 } });
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

  // Admin access control for fetching: admins can see all, tutors can see if assigned. 
  // (We don't need strict tutor constraint here if they already reached it, but we can just return it).
  return c.json({ data });
});

// GET /mocks/:id/questions (Fetch questions for a mock)
mocksRouter.get("/:id/questions", requireTutorOrAdmin, async (c) => {
  const user = c.get("user");
  if (!user.school_id) return c.json({ error: "No school assigned" }, 403);
  const mockId = c.req.param("id");

  const { data, error } = await supabase
    .from("mock_questions")
    .select("*, options:mock_question_options(*)")
    .eq("mock_exam_id", mockId)
    .eq("school_id", user.school_id)
    .order("order_index", { ascending: true });

  if (error) return c.json({ error: error.message }, 500);

  return c.json({ data: data || [] });
});

// DELETE /mocks/:id (Archive/Delete a mock)
mocksRouter.delete("/:id", requireTutorOrAdmin, async (c) => {
  const user = c.get("user");
  if (!user.school_id) return c.json({ error: "No school assigned" }, 403);

  const mockId = c.req.param("id");

  const { error } = await supabase
    .from("mock_exams")
    .delete()
    .eq("id", mockId)
    .eq("school_id", user.school_id);

  if (error) return c.json({ error: error.message }, 500);

  return c.json({ message: "Mock deleted successfully" });
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
    .select("status, tutor_id")
    .eq("id", mockId)
    .eq("school_id", user.school_id)
    .single();

  if (fetchError || !existingMock) return c.json({ error: "Mock not found" }, 404);
  
  if (existingMock.status !== "draft") {
    return c.json({ error: "Only draft mocks can be edited" }, 400);
  }

  // Security Check: Admins can only edit their OWN mocks.
  if (user.role === "admin" && existingMock.tutor_id !== user.id) {
    return c.json({ error: "Admins can only edit mocks they created." }, 403);
  }

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
    .select("status, tutor_id")
    .eq("id", mockId)
    .eq("school_id", user.school_id)
    .single();

  if (!existingMock) return c.json({ error: "Mock not found" }, 404);
  if (existingMock.status !== "draft") return c.json({ error: "Only draft mocks can be edited" }, 400);
  if (user.role === "admin" && existingMock.tutor_id !== user.id) {
    return c.json({ error: "Admins can only edit mocks they created." }, 403);
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

  const { data, error } = await supabase
    .from("mock_exams")
    .update({ status: "published", publish_at: new Date().toISOString() })
    .eq("id", mockId)
    .eq("school_id", user.school_id) // Tenant isolation
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);

  return c.json({ message: "Mock published successfully", data });
});
