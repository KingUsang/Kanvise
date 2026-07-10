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
      course:courses(id, name, code)
    `)
    .eq("school_id", user.school_id)
    .order("created_at", { ascending: false });

  if (user.role === "T") {
    query = query.eq("tutor_id", user.id);
  }

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);

  return c.json({ data });
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
