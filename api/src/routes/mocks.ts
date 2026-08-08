import { Hono } from "hono";
import { supabase } from "../lib/supabase";
import { BANK_QUESTION_TYPE_RELATION } from "../lib/postgrest-selects";
import { jwtVerificationMiddleware, profileResolutionMiddleware, requireRole, tenantMiddleware } from "../middleware/auth";
import { TenantVariables } from "../types";
import { notifyMockPublished } from "../notifications/triggers";
import {
  normalizeMockSettings,
  referencedAssemblyIds,
  validateMockAssembly,
  type MockAssemblySection,
} from "../domain/mock-assembly";
import { canReadQuestionBank } from "../domain/question-bank";
import { createPresignedDownload } from "../storage/r2";
import { REVIEWABLE_ATTEMPT_STATUSES } from "../domain/mock-results";
import {
  canTutorPublishMarketplace,
  distributionRequiresCourse,
  distributionUsesMarketplace,
  parseMockDistributionMode,
} from "../domain/mock-distribution";
import {
  importQuestionsFromPdf,
  importQuestionsFromDocumentText,
  MAX_MOCK_PDF_SIZE_BYTES,
} from "../domain/mock-pdf-import";

export const mocksRouter = new Hono<{ Variables: TenantVariables }>();

mocksRouter.use("*", jwtVerificationMiddleware, profileResolutionMiddleware, tenantMiddleware);

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

async function tutorCanAccessCourse(user: any, courseId: string | null | undefined) {
  if (user.role === "admin") return true;
  if (!courseId) return false;
  const { data } = await supabase.from("tutor_course_assignments")
    .select("course_id")
    .eq("school_id", user.school_id)
    .eq("tutor_id", user.id)
    .eq("course_id", courseId)
    .maybeSingle();
  return !!data;
}

async function canManageMock(user: any, mock: { tutor_id?: string | null; course_id?: string | null; distribution_mode?: string | null }) {
  if (user.role === "admin") return true;
  if (mock.tutor_id !== user.id) return false;
  const distribution = parseMockDistributionMode(mock.distribution_mode) || "centre";
  return distribution === "marketplace" || await tutorCanAccessCourse(user, mock.course_id);
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

async function validateAssemblyAccess(user: any, sections: MockAssemblySection[]) {
  const ids = referencedAssemblyIds(sections)
  const { data: questions, error: questionError } = ids.questionIds.length
    ? await supabase.from("bank_questions").select("id, bank_id, course_id")
      .eq("school_id", user.school_id).eq("status", "active").is("archived_at", null)
      .in("id", ids.questionIds)
    : { data: [], error: null }
  if (questionError) throw questionError
  if ((questions || []).length !== ids.questionIds.length) {
    return { status: 400 as const, error: "One or more questions are unavailable", code: "QUESTION_NOT_FOUND" }
  }

  const bankIds = [...new Set([...ids.bankIds, ...(questions || []).map((question: any) => question.bank_id)])]
  const { data: banks, error: bankError } = bankIds.length
    ? await supabase.from("question_banks").select("id, school_id, owner_id, visibility, archived_at")
      .eq("school_id", user.school_id).is("archived_at", null).in("id", bankIds)
    : { data: [], error: null }
  if (bankError) throw bankError
  if ((banks || []).length !== bankIds.length || (banks || []).some((bank: any) => !canReadQuestionBank(user, bank))) {
    return { status: 403 as const, error: "You cannot use one or more selected question banks", code: "BANK_ACCESS_DENIED" }
  }

  if (user.role === "tutor") {
    const courseIds = [...new Set([...ids.courseIds, ...(questions || []).flatMap((question: any) => question.course_id ? [question.course_id] : [])])]
    if (courseIds.length) {
      const { data: assignments, error } = await supabase.from("tutor_course_assignments").select("course_id")
        .eq("school_id", user.school_id).eq("tutor_id", user.id).in("course_id", courseIds)
      if (error) throw error
      if ((assignments || []).length !== courseIds.length) {
        return { status: 403 as const, error: "You can only use questions from courses assigned to you", code: "COURSE_ACCESS_DENIED" }
      }
    }
  }
  return null
}

function mockDatabaseError(c: any, error: any, fallback: string) {
  const message = String(error?.message || "")
  const codes = [
    "MOCK_NOT_FOUND", "MOCK_NOT_DRAFT", "MOCK_HAS_NO_SECTIONS", "MOCK_HAS_NO_QUESTIONS",
    "SECTION_TITLE_REQUIRED", "SECTION_COURSE_NOT_FOUND", "QUESTION_VERSION_NOT_FOUND",
    "RULE_BANK_NOT_FOUND", "RULE_QUESTION_COUNT_INVALID", "RANDOM_POOL_TOO_SMALL",
  ]
  const code = codes.find(candidate => message.includes(candidate))
  if (code) {
    const status = code === "MOCK_NOT_FOUND" ? 404 : code === "MOCK_NOT_DRAFT" ? 409 : 400
    return c.json({ error: code.replaceAll("_", " ").toLowerCase(), code }, status)
  }
  console.error("mocks.database_error", { message, code: error?.code })
  return c.json({ error: fallback, code: "DATABASE_ERROR" }, 500)
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

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);

  let visibleMocks = data || [];
  if (user.role === "tutor") {
    const { data: assignments, error: assignError } = await supabase
      .from("tutor_course_assignments")
      .select("course_id")
      .eq("tutor_id", user.id)
      .eq("school_id", user.school_id);
    if (assignError) return c.json({ error: assignError.message }, 500);

    const assignedCourseIds = new Set((assignments || []).map((assignment: any) => assignment.course_id));
    visibleMocks = visibleMocks.filter((mock: any) =>
      assignedCourseIds.has(mock.course_id)
      || (mock.tutor_id === user.id && distributionUsesMarketplace(parseMockDistributionMode(mock.distribution_mode) || "centre")));
  }

  const metrics = await loadMockMetrics(visibleMocks.map((mock: any) => mock.id), user.school_id);
  const mocksWithMetrics = visibleMocks.map((mock: any) => ({
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

// POST /mocks/import/pdf — extract editable questions from a text-based PDF.
// This deliberately returns a draft for tutor review; it never publishes or
// persists imported questions by itself.
mocksRouter.post("/import/pdf", requireTutorOrAdmin, async (c) => {
  const contentLength = Number(c.req.header("content-length") || 0);
  if (contentLength > MAX_MOCK_PDF_SIZE_BYTES + 1024 * 1024) {
    return c.json({ error: "PDFs must be 15 MB or smaller", code: "PDF_TOO_LARGE" }, 413);
  }

  try {
    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File)) {
      return c.json({ error: "Choose a PDF file to import", code: "PDF_REQUIRED" }, 400);
    }
    if (file.size > MAX_MOCK_PDF_SIZE_BYTES) {
      return c.json({ error: "PDFs must be 15 MB or smaller", code: "PDF_TOO_LARGE" }, 413);
    }
    const looksLikePdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!looksLikePdf) {
      return c.json({ error: "Only PDF files can be imported here", code: "INVALID_PDF_TYPE" }, 400);
    }

    const result = await importQuestionsFromPdf(new Uint8Array(await file.arrayBuffer()));
    if (result.questions.length === 0) {
      return c.json({
        error: result.warnings[0] || "No questions could be recognised in this PDF",
        code: "NO_QUESTIONS_FOUND",
      }, 422);
    }
    return c.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read this PDF";
    const expected = /scanned images|no more than|Invalid PDF|PasswordException|password/i.test(message);
    if (!expected) console.error("[mocks] PDF import failed", error);
    return c.json({
      error: /password/i.test(message)
        ? "Password-protected PDFs cannot be imported. Remove the password and try again."
        : message,
      code: "PDF_IMPORT_FAILED",
    }, 422);
  }
});

// POST /mocks/import/document-text — parse text extracted from a Word document.
// The browser only extracts the document's readable text; Gemini decides how
// questions, options, answer keys, and rubrics are organised.
mocksRouter.post("/import/document-text", requireTutorOrAdmin, async (c) => {
  try {
    const body = await c.req.json<{ document_text?: unknown; file_name?: unknown }>();
    if (typeof body.document_text !== "string" || !body.document_text.trim()) {
      return c.json({ error: "The Word document did not contain readable text", code: "DOCUMENT_TEXT_REQUIRED" }, 400);
    }
    const result = await importQuestionsFromDocumentText(body.document_text, typeof body.file_name === "string" ? body.file_name : undefined);
    if (result.questions.length === 0) {
      return c.json({ error: result.warnings[0] || "No questions could be recognised in this document", code: "NO_QUESTIONS_FOUND" }, 422);
    }
    return c.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read this Word document";
    if (!/AI document import|Word document|No questions|too large/i.test(message)) console.error("[mocks] document import failed", error);
    return c.json({ error: message, code: "DOCUMENT_IMPORT_FAILED" }, 422);
  }
});

// GET /mocks/:id/results — tutor/admin review workspace data.
mocksRouter.get("/:id/results", requireTutorOrAdmin, async (c) => {
  const user = c.get("user");
  const mockId = c.req.param("id")!;

  const { data: mock, error: mockError } = await supabase.from("mock_exams")
    .select("id, title, status, course_id, tutor_id, distribution_mode, course:courses(name)")
    .eq("id", mockId).eq("school_id", user.school_id).maybeSingle();
  if (mockError || !mock) return c.json({ error: "Mock not found" }, 404);
  if (!(await canManageMock(user, mock))) return c.json({ error: "You cannot access this mock" }, 403);

  const { data: attempts, error: attemptsError } = await supabase.from("mock_attempts")
    .select("id, student_id, mock_exam_version_id, started_at, submitted_at, status, mcq_score, theory_score, total_score, total_marks, total_mcq_questions, correct_mcq_answers, student:user_profiles(first_name, last_name, email)")
    .eq("mock_exam_id", mockId).eq("school_id", user.school_id)
    .in("status", [...REVIEWABLE_ATTEMPT_STATUSES])
    .order("submitted_at", { ascending: false });
  if (attemptsError) return c.json({ error: "Failed to load mock attempts" }, 500);

  const attemptIds = (attempts || []).map((attempt: any) => attempt.id);
  const { data: answers, error: answersError } = attemptIds.length
    ? await supabase.from("mock_answers")
      .select(`id, attempt_id, theory_answer_text, is_correct, tutor_score, tutor_feedback,
        question:mock_version_questions(id, marks, order_index,
          version:bank_question_versions(plain_text, content_blocks,
          ${BANK_QUESTION_TYPE_RELATION}
          )
        )`)
      .eq("school_id", user.school_id).in("attempt_id", attemptIds)
    : { data: [], error: null };
  if (answersError) return c.json({ error: "Failed to load mock answers" }, 500);

  const mediaIds = [...new Set((answers || []).flatMap((answer: any) =>
    (answer.question?.version?.content_blocks || []).flatMap((block: any) =>
      block?.type === "image" && typeof block.media_id === "string" ? [block.media_id] : [])))];
  const mediaById = new Map<string, any>();
  if (mediaIds.length) {
    const { data: media, error: mediaError } = await supabase.from("question_media")
      .select("id, storage_key, alt_text, width, height")
      .eq("school_id", user.school_id).eq("processing_status", "ready").in("id", mediaIds);
    if (mediaError) return c.json({ error: "Failed to load question images" }, 500);
    for (const item of media || []) {
      mediaById.set(item.id, {
        media_id: item.id,
        alt_text: item.alt_text,
        width: item.width,
        height: item.height,
        url: await createPresignedDownload(item.storage_key, user.school_id!),
      });
    }
  }

  const answersByAttempt = new Map<string, any[]>();
  for (const answer of answers || []) {
    const current = answersByAttempt.get(answer.attempt_id) || [];
    const snapshot = answer.question as any;
    current.push({
      ...answer,
      question: {
        id: snapshot?.id,
        question_text: snapshot?.version?.plain_text || "",
        content_blocks: (snapshot?.version?.content_blocks || []).map((block: any) =>
          block?.type === "image" ? { ...block, ...mediaById.get(block.media_id) } : block),
        question_type: snapshot?.version?.question?.question_type,
        marks: snapshot?.marks,
        order_index: snapshot?.order_index,
      },
    });
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

// POST /mocks/:id/attempt-grants — allow a student one more attempt without
// changing the mock-wide attempt limit for everyone else.
mocksRouter.post("/:id/attempt-grants", requireTutorOrAdmin, async (c) => {
  const user = c.get("user");
  const mockId = c.req.param("id")!;
  const body = await c.req.json();
  const attemptId = typeof body.attempt_id === "string" ? body.attempt_id : "";
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : null;
  if (!attemptId) return c.json({ error: "Choose a student attempt", code: "VALIDATION_ERROR" }, 400);

  const { data: mock, error: mockError } = await supabase.from("mock_exams")
    .select("id, course_id, tutor_id, distribution_mode").eq("id", mockId).eq("school_id", user.school_id).maybeSingle();
  if (mockError || !mock) return c.json({ error: "Mock not found", code: "MOCK_NOT_FOUND" }, 404);
  if (!(await canManageMock(user, mock))) return c.json({ error: "You cannot manage this mock", code: "MOCK_ACCESS_DENIED" }, 403);

  const { data: attempt, error: attemptError } = await supabase.from("mock_attempts")
    .select("id, student_id, mock_exam_version_id")
    .eq("id", attemptId).eq("mock_exam_id", mockId).eq("school_id", user.school_id).maybeSingle();
  if (attemptError) return mockDatabaseError(c, attemptError, "Could not check the student's attempt");
  if (!attempt) return c.json({ error: "Student attempt not found", code: "ATTEMPT_NOT_FOUND" }, 404);
  if (!attempt.mock_exam_version_id) {
    return c.json({ error: "Extra attempts are available only for versioned mocks", code: "LEGACY_ATTEMPT" }, 409);
  }

  const { data, error } = await supabase.from("mock_attempt_grants").insert({
    school_id: user.school_id,
    mock_exam_version_id: attempt.mock_exam_version_id,
    student_id: attempt.student_id,
    granted_by: user.id,
    additional_attempts: 1,
    reason,
  }).select("id, created_at, additional_attempts, reason").single();
  if (error) return mockDatabaseError(c, error, "Could not allow another attempt");
  return c.json({ data, message: "One extra attempt allowed" }, 201);
});

// GET /mocks/:id (Fetch mock details)
mocksRouter.get("/:id", requireTutorOrAdmin, async (c) => {
  const user = c.get("user");
  if (!user.school_id) return c.json({ error: "No school assigned" }, 403);
  const mockId = c.req.param("id")!;

  const { data, error } = await supabase
    .from("mock_exams")
    .select("*, course:courses(id, name)")
    .eq("id", mockId)
    .eq("school_id", user.school_id)
    .single();

  if (error) return c.json({ error: error.message }, 500);
  if (!data) return c.json({ error: "Mock not found" }, 404);
  if (!(await canManageMock(user, data))) return c.json({ error: "You cannot access this mock" }, 403);
  return c.json({ data });
});

// GET /mocks/:id/questions (Fetch questions for a mock)
mocksRouter.get("/:id/questions", requireTutorOrAdmin, async (c) => {
  const user = c.get("user");
  if (!user.school_id) return c.json({ error: "No school assigned" }, 403);
  const mockId = c.req.param("id")!;

  const { data: mock } = await supabase.from("mock_exams").select("course_id, tutor_id, distribution_mode")
    .eq("id", mockId).eq("school_id", user.school_id).maybeSingle();
  if (!mock) return c.json({ error: "Mock not found" }, 404);
  if (!(await canManageMock(user, mock))) return c.json({ error: "You cannot access this mock" }, 403);

  const { data: sections, error: sectionError } = await supabase.from("mock_sections")
    .select("id").eq("mock_exam_id", mockId).eq("school_id", user.school_id)
    .order("order_index");
  if (sectionError) return mockDatabaseError(c, sectionError, "Could not load mock sections");

  if ((sections || []).length) {
    const { data, error } = await supabase.from("mock_section_questions")
      .select(`id, order_index, marks_override,
        question:bank_questions(id, question_type,
          current_version:bank_question_versions!bank_questions_current_version_fkey(
            id, plain_text, content_blocks, grading_rubric_blocks, marks,
            options:bank_question_option_versions(id, plain_text, content_blocks, is_correct, order_index)
          )
        )`)
      .eq("school_id", user.school_id)
      .in("section_id", (sections || []).map((section: any) => section.id))
      .order("order_index");
    if (error) return mockDatabaseError(c, error, "Could not load mock questions");
    return c.json({ data: (data || []).map((item: any) => ({
      id: item.question.id,
      question_type: item.question.question_type,
      question_text: item.question.current_version?.plain_text || "",
      content_blocks: item.question.current_version?.content_blocks || [],
      marks: item.marks_override || item.question.current_version?.marks,
      grading_rubric: (item.question.current_version?.grading_rubric_blocks || [])
        .filter((block: any) => block?.type === "text").map((block: any) => block.text).join("\n"),
      options: (item.question.current_version?.options || []).map((option: any) => ({
        id: option.id,
        option_text: option.plain_text,
        content_blocks: option.content_blocks || [],
        is_correct: option.is_correct,
        order_index: option.order_index,
      })),
    })) });
  }

  // Read-only compatibility for drafts created before the versioned engine.
  const { data, error } = await supabase.from("mock_questions")
    .select("*, options:mock_question_options(*)")
    .eq("mock_exam_id", mockId).eq("school_id", user.school_id)
    .order("order_index", { ascending: true });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ data: data || [] });
});

// GET /mocks/:id/assembly — versioned draft sections, fixed questions and random pools.
mocksRouter.get("/:id/assembly", requireTutorOrAdmin, async (c) => {
  const user = c.get("user");
  const mockId = c.req.param("id")!;
  const { data: mock, error: mockError } = await supabase.from("mock_exams")
    .select("id, status, course_id, tutor_id, distribution_mode").eq("id", mockId).eq("school_id", user.school_id).maybeSingle();
  if (mockError) return mockDatabaseError(c, mockError, "Could not load mock assembly");
  if (!mock) return c.json({ error: "Mock not found", code: "MOCK_NOT_FOUND" }, 404);
  if (!(await canManageMock(user, mock))) return c.json({ error: "You cannot access this mock", code: "MOCK_ACCESS_DENIED" }, 403);

  const { data: sections, error: sectionError } = await supabase.from("mock_sections")
    .select("id, course_id, title, subject_name, instructions, order_index")
    .eq("mock_exam_id", mockId).eq("school_id", user.school_id).order("order_index");
  if (sectionError) return mockDatabaseError(c, sectionError, "Could not load mock sections");
  const sectionIds = (sections || []).map((section: any) => section.id);
  const [{ data: fixed, error: fixedError }, { data: rules, error: ruleError }] = sectionIds.length
    ? await Promise.all([
      supabase.from("mock_section_questions")
        .select(`id, section_id, question_id, question_version_id, order_index, marks_override,
          question:bank_questions(
            id, bank_id, course_id, subject_name, topic, subtopic, question_type,
            bank:question_banks(name, source_mock_exam_id),
            current_version:bank_question_versions!bank_questions_current_version_fkey(
              id, version_number, plain_text, content_blocks, grading_rubric_blocks, marks,
              options:bank_question_option_versions(id, plain_text, content_blocks, is_correct, order_index)
            )
          )`)
        .eq("school_id", user.school_id).in("section_id", sectionIds).order("order_index"),
      supabase.from("mock_question_rules")
        .select("id, section_id, bank_id, subject_name, topic, subtopic, question_type, question_count")
        .eq("school_id", user.school_id).in("section_id", sectionIds).order("created_at"),
    ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (fixedError || ruleError) return mockDatabaseError(c, fixedError || ruleError, "Could not load mock questions");

  return c.json({ data: {
    sections: (sections || []).map((section: any) => ({
      ...section,
      questions: (fixed || []).filter((question: any) => question.section_id === section.id),
      rules: (rules || []).filter((rule: any) => rule.section_id === section.id),
    })),
  } });
});

// PUT /mocks/:id/assembly — atomically replace a draft's versioned assembly.
mocksRouter.put("/:id/assembly", requireTutorOrAdmin, async (c) => {
  const user = c.get("user");
  const mockId = c.req.param("id")!;
  const body = await c.req.json();
  const errors = validateMockAssembly(body.sections);
  if (errors.length) return c.json({ error: "Check the mock sections", code: "VALIDATION_ERROR", details: errors }, 400);

  const { data: mock, error: mockError } = await supabase.from("mock_exams")
    .select("id, status, course_id, tutor_id, distribution_mode").eq("id", mockId).eq("school_id", user.school_id).maybeSingle();
  if (mockError) return mockDatabaseError(c, mockError, "Could not check mock");
  if (!mock) return c.json({ error: "Mock not found", code: "MOCK_NOT_FOUND" }, 404);
  if (mock.status !== "draft") return c.json({ error: "Only draft mocks can be edited", code: "MOCK_NOT_DRAFT" }, 409);
  if (!(await canManageMock(user, mock))) return c.json({ error: "You cannot edit this mock", code: "MOCK_ACCESS_DENIED" }, 403);

  try {
    const accessError = await validateAssemblyAccess(user, body.sections);
    if (accessError) return c.json({ error: accessError.error, code: accessError.code }, accessError.status);
    const { data, error } = await supabase.rpc("replace_versioned_mock_assembly", {
      p_school_id: user.school_id,
      p_mock_exam_id: mockId,
      p_sections: body.sections,
    });
    if (error) return mockDatabaseError(c, error, "Could not save mock sections");
    return c.json({ message: "Mock sections saved", data: data?.[0] || data });
  } catch (error) {
    return mockDatabaseError(c, error, "Could not save mock sections");
  }
});

// POST /mocks/:id/random-pool/preview — show availability without exposing answer keys.
mocksRouter.post("/:id/random-pool/preview", requireTutorOrAdmin, async (c) => {
  const user = c.get("user");
  const mockId = c.req.param("id")!;
  const body = await c.req.json();
  const bankId = typeof body.bank_id === "string" ? body.bank_id : "";
  if (!bankId) return c.json({ error: "Choose a question bank", code: "VALIDATION_ERROR" }, 400);

  const { data: mock } = await supabase.from("mock_exams").select("course_id, tutor_id, distribution_mode")
    .eq("id", mockId).eq("school_id", user.school_id).maybeSingle();
  if (!mock) return c.json({ error: "Mock not found", code: "MOCK_NOT_FOUND" }, 404);
  if (!(await canManageMock(user, mock))) return c.json({ error: "You cannot access this mock", code: "MOCK_ACCESS_DENIED" }, 403);
  const { data: bank, error: bankError } = await supabase.from("question_banks")
    .select("id, school_id, owner_id, visibility, archived_at").eq("id", bankId)
    .eq("school_id", user.school_id).is("archived_at", null).maybeSingle();
  if (bankError) return mockDatabaseError(c, bankError, "Could not check question bank");
  if (!bank || !canReadQuestionBank(user, bank)) {
    return c.json({ error: "Question bank not found", code: "BANK_NOT_FOUND" }, 404);
  }

  let query = supabase.from("bank_questions").select("id", { count: "exact", head: true })
    .eq("school_id", user.school_id).eq("bank_id", bankId).eq("status", "active").is("archived_at", null);
  for (const field of ["subject_name", "topic", "subtopic", "question_type"] as const) {
    if (typeof body[field] === "string" && body[field].trim()) query = query.eq(field, body[field].trim());
  }
  const { count, error } = await query;
  if (error) return mockDatabaseError(c, error, "Could not count matching questions");
  return c.json({ data: { available_questions: count || 0 } });
});

// POST /mocks/:id/archive — preserve attempts and results while removing the
// mock from active teaching workflows.
mocksRouter.post("/:id/archive", requireTutorOrAdmin, async (c) => {
  const user = c.get("user");
  if (!user.school_id) return c.json({ error: "No school assigned" }, 403);

  const mockId = c.req.param("id")!;
  const { data: mock } = await supabase.from("mock_exams").select("course_id, tutor_id, distribution_mode")
    .eq("id", mockId).eq("school_id", user.school_id).maybeSingle();
  if (!mock) return c.json({ error: "Mock not found" }, 404);
  if (!(await canManageMock(user, mock))) return c.json({ error: "You cannot archive this mock" }, 403);

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
  const { title, description, publish_at, time_limit_minutes } = body;
  const distributionMode = parseMockDistributionMode(body.distribution_mode ?? "centre");
  const courseId = typeof body.course_id === "string" && body.course_id ? body.course_id : null;

  if (!title || !distributionMode || (distributionRequiresCourse(distributionMode) && !courseId)) {
    return c.json({ error: "Missing required fields" }, 400);
  }
  const duration = Number(time_limit_minutes || 0);
  if (!Number.isInteger(duration) || duration < 0 || duration > 1440) {
    return c.json({ error: "Time limit must be between 0 and 1,440 minutes", code: "VALIDATION_ERROR" }, 400);
  }
  const settings = normalizeMockSettings(body);
  if (settings.errors.length) {
    return c.json({ error: "Check the mock settings", code: "VALIDATION_ERROR", details: settings.errors }, 400);
  }
  if (distributionRequiresCourse(distributionMode) && !(await tutorCanAccessCourse(user, courseId))) {
    return c.json({ error: "You are not assigned to this course" }, 403);
  }

  // Use the kanvise_user_id (which is a UUID in the kanvise_users table) for tutor_id
  const tutorId = user.id;

  const { data, error } = await supabase
    .from("mock_exams")
    .insert([
      {
        school_id: user.school_id,
        tutor_id: tutorId,
        course_id: courseId,
        distribution_mode: distributionMode,
        title,
        description,
        status: "draft",
        publish_at,
        time_limit_minutes: duration,
        total_mcq_questions: 0,
        total_theory_questions: 0,
        ...settings.updates,
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

  const mockId = c.req.param("id")!;
  const body = await c.req.json();
  const { title, description, publish_at, time_limit_minutes } = body;

  // Verify mock exists and is draft
  const { data: existingMock, error: fetchError } = await supabase
    .from("mock_exams")
    .select("status, tutor_id, course_id, distribution_mode, available_from, closes_at")
    .eq("id", mockId)
    .eq("school_id", user.school_id)
    .single();

  if (fetchError || !existingMock) return c.json({ error: "Mock not found" }, 404);
  
  if (existingMock.status !== "draft") {
    return c.json({ error: "Only draft mocks can be edited" }, 400);
  }

  const distributionMode = parseMockDistributionMode(body.distribution_mode ?? existingMock.distribution_mode ?? "centre");
  const courseId = body.course_id === undefined
    ? existingMock.course_id
    : typeof body.course_id === "string" && body.course_id ? body.course_id : null;
  if (!distributionMode || (distributionRequiresCourse(distributionMode) && !courseId)) {
    return c.json({ error: "Choose a course for mocks shared with centre students", code: "VALIDATION_ERROR" }, 400);
  }
  if (!(await canManageMock(user, existingMock))) return c.json({ error: "You cannot edit this mock", code: "MOCK_ACCESS_DENIED" }, 403);

  const duration = Number(time_limit_minutes || 0);
  if (!Number.isInteger(duration) || duration < 0 || duration > 1440) {
    return c.json({ error: "Time limit must be between 0 and 1,440 minutes", code: "VALIDATION_ERROR" }, 400);
  }
  const settings = normalizeMockSettings({
    ...body,
    available_from: body.available_from !== undefined ? body.available_from : existingMock.available_from,
    closes_at: body.closes_at !== undefined ? body.closes_at : existingMock.closes_at,
  });
  if (settings.errors.length) {
    return c.json({ error: "Check the mock settings", code: "VALIDATION_ERROR", details: settings.errors }, 400);
  }

  if (distributionRequiresCourse(distributionMode) && !(await tutorCanAccessCourse(user, courseId))) {
    return c.json({ error: "You are not assigned to this course" }, 403);
  }

  const { data, error } = await supabase
    .from("mock_exams")
    .update({
      title,
      description,
      course_id: courseId,
      distribution_mode: distributionMode,
      publish_at,
      time_limit_minutes: duration,
      ...settings.updates,
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

  const mockId = c.req.param("id")!;
  const body = await c.req.json();
  const { question_type, question_text, marks, order_index, options, grading_rubric } = body;

  if (!question_type || !question_text) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  const { data: mock } = await supabase.from("mock_exams").select("status, course_id, tutor_id, distribution_mode")
    .eq("id", mockId).eq("school_id", user.school_id).maybeSingle();
  if (!mock) return c.json({ error: "Mock not found" }, 404);
  if (mock.status !== "draft") return c.json({ error: "Only draft mocks can be edited" }, 409);
  if (!(await canManageMock(user, mock))) return c.json({ error: "You cannot edit this mock" }, 403);

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

  const mockId = c.req.param("id")!;
  const body = await c.req.json();
  const { questions } = body; // Array of question objects

  if (!questions || !Array.isArray(questions)) {
    return c.json({ error: "Questions array is required" }, 400);
  }

  // Verify mock exists, is draft, and passes security constraints
  const { data: existingMock } = await supabase
    .from("mock_exams")
    .select("status, tutor_id, course_id, distribution_mode")
    .eq("id", mockId)
    .eq("school_id", user.school_id)
    .single();

  if (!existingMock) return c.json({ error: "Mock not found" }, 404);
  if (existingMock.status !== "draft") return c.json({ error: "Only draft mocks can be edited" }, 400);
  if (!(await canManageMock(user, existingMock))) return c.json({ error: "You cannot edit this mock" }, 403);

  if (questions.length > 0) {
    const validationErrors = validateMockForPublication(questions);
    if (validationErrors.length > 0) return c.json({ error: "Invalid questions", details: validationErrors }, 400);
  }

  const { data, error } = await supabase.rpc("replace_authored_mock_questions", {
    p_school_id: user.school_id,
    p_mock_exam_id: mockId,
    p_author_id: user.id,
    p_questions: questions,
  });
  if (error) return mockDatabaseError(c, error, "Could not save mock questions");
  return c.json({
    message: "Questions saved to the versioned mock engine",
    data: data?.[0] || data,
  });
});

// POST /mocks/:id/publish (Publish a mock immediately)
mocksRouter.post("/:id/publish", requireTutorOrAdmin, async (c) => {
  const user = c.get("user");
  if (!user.school_id) return c.json({ error: "No school assigned" }, 403);

  const mockId = c.req.param("id")!;

  const { data: mock, error: mockError } = await supabase.from("mock_exams")
    .select("id, status, course_id, tutor_id, distribution_mode, time_limit_minutes")
    .eq("id", mockId).eq("school_id", user.school_id).maybeSingle();
  if (mockError || !mock) return c.json({ error: "Mock not found" }, 404);
  if (mock.status !== "draft") return c.json({ error: "Only draft mocks can be published" }, 409);
  if (!(await canManageMock(user, mock))) return c.json({ error: "You cannot publish this mock" }, 403);
  if (mock.time_limit_minutes !== null && Number(mock.time_limit_minutes) < 0) {
    return c.json({ error: "Time limit cannot be negative" }, 400);
  }

  const distributionMode = parseMockDistributionMode(mock.distribution_mode) || "centre";
  let { count: sectionCount, error: sectionError } = await supabase.from("mock_sections")
    .select("id", { count: "exact", head: true }).eq("mock_exam_id", mockId).eq("school_id", user.school_id);
  if (sectionError) return mockDatabaseError(c, sectionError, "Failed to validate mock sections");
  if ((sectionCount || 0) === 0) {
    // One-time upgrade for old drafts. They are immediately moved into an
    // authored question bank and then published through the immutable path.
    const { data: legacyQuestions, error: questionError } = await supabase.from("mock_questions")
      .select("question_text, question_type, marks, grading_rubric, options:mock_question_options(option_text, is_correct)")
      .eq("mock_exam_id", mockId).eq("school_id", user.school_id).order("order_index");
    if (questionError) return c.json({ error: "Failed to validate mock questions" }, 500);
    const validationErrors = validateMockForPublication((legacyQuestions || []) as PublishableQuestion[]);
    if (validationErrors.length) {
      return c.json({ error: "Mock is not ready to publish", details: validationErrors }, 400);
    }
    const { error: upgradeError } = await supabase.rpc("replace_authored_mock_questions", {
      p_school_id: user.school_id,
      p_mock_exam_id: mockId,
      p_author_id: user.id,
      p_questions: legacyQuestions || [],
    });
    if (upgradeError) return mockDatabaseError(c, upgradeError, "Could not upgrade this draft");
    sectionCount = 1;
  }

  if (distributionUsesMarketplace(distributionMode) && !canTutorPublishMarketplace(user.role)) {
    // Freeze the exact version the tutor is submitting. It remains unavailable
    // publicly until a centre admin creates/approves its marketplace listing.
    const submittedAt = new Date().toISOString();
    const { data: versionResult, error: versionError } = await supabase.rpc("publish_versioned_mock", {
      p_school_id: user.school_id,
      p_mock_exam_id: mockId,
      p_published_by: user.id,
      p_published_at: submittedAt,
    });
    if (versionError) return mockDatabaseError(c, versionError, "Could not freeze this mock for approval");
    const { data, error } = await supabase.from("mock_exams")
      .update({
        marketplace_approval_status: "pending",
        marketplace_submitted_at: submittedAt,
        marketplace_rejection_reason: null,
        updated_at: submittedAt,
      })
      .eq("id", mockId).eq("school_id", user.school_id)
      .select("id, marketplace_approval_status")
      .single();
    if (error) return mockDatabaseError(c, error, "Could not submit this mock for approval");
    return c.json({
      message: "Mock submitted for centre-admin approval",
      data,
      version: versionResult?.[0] || versionResult,
    }, 202);
  }

  const publishedAt = new Date().toISOString();
  const { data: versionResult, error: publishError } = await supabase.rpc("publish_versioned_mock", {
    p_school_id: user.school_id,
    p_mock_exam_id: mockId,
    p_published_by: user.id,
    p_published_at: publishedAt,
  });
  if (publishError) return mockDatabaseError(c, publishError, "Could not publish the mock");
  const { data, error } = await supabase.from("mock_exams")
    .select("*, course:courses(name)").eq("id", mockId).eq("school_id", user.school_id).single();
  if (error) return mockDatabaseError(c, error, "Mock was published but could not be reloaded");

  if (distributionUsesMarketplace(distributionMode)) {
    const { error: approvalError } = await supabase.from("mock_exams")
      .update({
        marketplace_approval_status: "approved",
        marketplace_approved_at: publishedAt,
        marketplace_approved_by: user.id,
        marketplace_rejection_reason: null,
      })
      .eq("id", mockId).eq("school_id", user.school_id);
    if (approvalError) return mockDatabaseError(c, approvalError, "Mock was published but marketplace approval could not be recorded");
  }

  const notification = distributionMode === "marketplace" || !data.course_id
    ? { failures: [] }
    : await notifyMockPublished({
      id: data.id,
      schoolId: data.school_id,
      courseId: data.course_id,
      title: data.title,
      courseName: (data.course as any)?.name || "Your course",
    });
  if (notification.failures.length === 0) {
    await supabase.from("mock_exams").update({ notification_sent: true }).eq("id", data.id);
  }

  return c.json({
    message: "Mock published successfully",
    data,
    version: versionResult?.[0] || versionResult,
    notification,
  });
});
