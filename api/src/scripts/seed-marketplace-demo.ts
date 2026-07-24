import "dotenv/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const schoolId = "a5bd1325-6ad1-4662-a6ce-6007c877a0ba";
const password = process.env.MARKETPLACE_TEST_PASSWORD || "KanviseTest!2026";

const users = {
  admin: { email: "marketplace.admin@seed.kanvise.test", first_name: "Marketplace", last_name: "Admin", role: "admin", kanvise_user_id: "ACA-ADM-MARKETPLACE" },
  tutor: { email: "marketplace.tutor@seed.kanvise.test", first_name: "Marketplace", last_name: "Tutor", role: "tutor", kanvise_user_id: "ACA-TUT-MARKETPLACE" },
  student: { email: "marketplace.student@seed.kanvise.test", first_name: "Marketplace", last_name: "Student", role: "student", kanvise_user_id: "ACA-STU-MARKETPLACE" },
} as const;

async function ensureUser(input: typeof users[keyof typeof users]) {
  const listed = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listed.error) throw listed.error;
  let authUser = listed.data.users.find((user) => user.email === input.email);
  if (!authUser) {
    const created = await supabase.auth.admin.createUser({ email: input.email, password, email_confirm: true });
    if (created.error || !created.data.user) throw created.error || new Error(`Could not create ${input.email}`);
    authUser = created.data.user;
  }
  const profile = {
    id: authUser.id,
    supabase_auth_id: authUser.id,
    school_id: input.role === "student" ? null : schoolId,
    role: input.role,
    kanvise_user_id: input.kanvise_user_id,
    first_name: input.first_name,
    last_name: input.last_name,
    email: input.email,
    is_active: true,
  };
  const saved = await supabase.from("user_profiles").upsert(profile, { onConflict: "id" }).select("id, email, role, school_id").single();
  if (saved.error) throw saved.error;
  return saved.data;
}

async function ensureMock(tutorId: string, title: string, calculatorMode: "none" | "basic" | "scientific") {
  let query = await supabase.from("mock_exams").select("id, status").eq("school_id", schoolId).eq("title", title).maybeSingle();
  if (query.error) throw query.error;
  let mock = query.data;
  if (!mock) {
    const created = await supabase.from("mock_exams").insert({
      school_id: schoolId, course_id: null, tutor_id: tutorId, title,
      description: "Seeded mixed-subject marketplace mock for staging verification.",
      status: "draft", publish_at: null, time_limit_minutes: 15,
      total_mcq_questions: 0, total_theory_questions: 0, distribution_mode: "marketplace",
      calculator_mode: calculatorMode, shuffle_questions: false, shuffle_options: false,
      max_attempts: 2, pass_mark: 50, result_release_mode: "immediately_with_corrections",
      available_from: null, closes_at: null,
    }).select("id, status").single();
    if (created.error) throw created.error;
    mock = created.data;
  }
  if (mock.status === "draft") {
    const replaced = await supabase.rpc("replace_authored_mock_questions", {
      p_school_id: schoolId,
      p_mock_exam_id: mock.id,
      p_author_id: tutorId,
      p_questions: [
        { question_type: "mcq", question_text: "A wave has frequency 50 Hz and wavelength 6 m. What is its speed?", marks: 2, content_blocks: [{ type: "equation", latex: "v = f \\lambda" }], options: [{ option_text: "8 m/s", is_correct: false }, { option_text: "300 m/s", is_correct: true }, { option_text: "56 m/s", is_correct: false }] },
        { question_type: "mcq", question_text: "Which element has atomic number 6?", marks: 1, content_blocks: [], options: [{ option_text: "Carbon", is_correct: true }, { option_text: "Oxygen", is_correct: false }, { option_text: "Nitrogen", is_correct: false }] },
        { question_type: "theory", question_text: "Explain why noble gases are chemically unreactive.", marks: 4, content_blocks: [{ type: "chemistry", latex: "\\ce{Ne}" }], grading_rubric: "Mentions a stable outer electron shell.", options: [] },
      ],
    });
    if (replaced.error) throw replaced.error;
    const published = await supabase.rpc("publish_versioned_mock", {
      p_school_id: schoolId, p_mock_exam_id: mock.id, p_published_by: tutorId, p_published_at: new Date().toISOString(),
    });
    if (published.error) throw published.error;
  }
  const version = await supabase.from("mock_exam_versions").select("id, total_questions, total_marks").eq("mock_exam_id", mock.id).order("version_number", { ascending: false }).limit(1).single();
  if (version.error) throw version.error;
  return { mockId: mock.id, version: version.data };
}

async function ensureListing(input: {
  slug: string; title: string; description: string; examination: string; subjects: string[];
  pricingType: "free" | "paid"; priceKobo: number; sourceMockId: string; versionId: string; questionCount: number; totalMarks: number; calculatorMode: "none" | "basic" | "scientific"; creatorId: string; approverId: string;
}) {
  const existing = await supabase.from("mock_marketplace_listings").select("id, slug").eq("slug", input.slug).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    const corrected = await supabase.from("mock_marketplace_listings").update({ approved_by: input.approverId }).eq("id", existing.data.id).select("id, slug, title, pricing_type, price_kobo").single();
    if (corrected.error) throw corrected.error;
    return corrected.data;
  }
  const now = new Date().toISOString();
  const inserted = await supabase.from("mock_marketplace_listings").insert({
    creator_school_id: schoolId, creator_user_id: input.creatorId, source_mock_id: input.sourceMockId, mock_version_id: input.versionId,
    slug: input.slug, title: input.title, short_description: input.description, examination: input.examination,
    subjects: input.subjects, tags: ["staging", "mixed-subject"], difficulty: "intermediate", instructions: "This is staging test data.",
    duration_minutes: 15, question_count: input.questionCount, total_marks: input.totalMarks, calculator_mode: input.calculatorMode,
    result_release_mode: "immediately_with_corrections", attempts_included: 2, preview_question_ids: [], pricing_type: input.pricingType,
    price_kobo: input.priceKobo, currency: "NGN", approval_status: "approved", publication_status: "listed",
    rights_confirmed_at: now, submitted_at: now, approved_at: now, approved_by: input.approverId, listed_at: now,
  }).select("id, slug, title, pricing_type, price_kobo").single();
  if (inserted.error) throw inserted.error;
  const event = await supabase.from("mock_marketplace_creator_events").insert({ listing_id: inserted.data.id, actor_id: input.creatorId, action: "listed", reason: "Seeded staging verification data" });
  if (event.error) throw event.error;
  return inserted.data;
}

async function main() {
  const [admin, tutor, student] = await Promise.all([ensureUser(users.admin), ensureUser(users.tutor), ensureUser(users.student)]);
  const freeMock = await ensureMock(tutor.id, "[STAGING] Mixed Science Practice — Free", "basic");
  const paidMock = await ensureMock(tutor.id, "[STAGING] Mixed Science Practice — Paid", "scientific");
  const freeListing = await ensureListing({ slug: "staging-mixed-science-free", title: "[STAGING] Mixed Science Practice — Free", description: "Free mixed Physics, Chemistry and Mathematics practice mock.", examination: "JAMB practice", subjects: ["Physics", "Chemistry", "Mathematics"], pricingType: "free", priceKobo: 0, sourceMockId: freeMock.mockId, versionId: freeMock.version.id, questionCount: freeMock.version.total_questions, totalMarks: Number(freeMock.version.total_marks), calculatorMode: "basic", creatorId: tutor.id, approverId: admin.id });
  const paidListing = await ensureListing({ slug: "staging-mixed-science-paid", title: "[STAGING] Mixed Science Practice — Paid", description: "Paid mixed-subject test for checkout and purchase verification.", examination: "WAEC practice", subjects: ["Physics", "Chemistry", "Mathematics"], pricingType: "paid", priceKobo: 150000, sourceMockId: paidMock.mockId, versionId: paidMock.version.id, questionCount: paidMock.version.total_questions, totalMarks: Number(paidMock.version.total_marks), calculatorMode: "scientific", creatorId: tutor.id, approverId: admin.id });
  console.log(JSON.stringify({ schoolId, users: { admin, tutor, student, password }, listings: { freeListing, paidListing }, marketplaceUrl: "/mocks" }, null, 2));
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
