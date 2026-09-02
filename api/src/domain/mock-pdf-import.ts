import { extractPdfText } from "./mock-pdf-text";

export const MAX_MOCK_PDF_SIZE_BYTES = 15 * 1024 * 1024;

export type ImportedMockQuestion = {
  id: string;
  question_type: "mcq" | "theory";
  question_text: string;
  subject_name?: string;
  marks: number;
  options: Array<{
    id: string;
    option_text: string;
    is_correct: boolean;
    content_blocks?: Array<{ type: "equation" | "chemistry"; latex: string }>;
  }>;
  content_blocks: Array<{ type: "equation" | "chemistry"; latex: string }>;
  grading_rubric?: string;
  source_page?: number | null;
  review_reasons: string[];
};

export type MockPdfImportResult = {
  questions: ImportedMockQuestion[];
  warnings: string[];
  page_count: number | null;
};

const questionSchema = {
  type: "object",
  properties: {
    question_type: { type: "string", enum: ["mcq", "theory"] },
    question_text: { type: "string" },
    subject_name: { type: "string" },
    marks: { type: "number" },
    options: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          option_text: { type: "string" },
          is_correct: { type: "boolean" },
          equation_latex: { type: "string" },
          chemistry_latex: { type: "string" },
        },
        required: ["label", "option_text", "is_correct", "equation_latex", "chemistry_latex"],
      },
    },
    grading_rubric: { type: "string" },
    source_page: { type: "integer" },
    review_reasons: { type: "array", items: { type: "string" } },
    equation_latex: { type: "string" },
    chemistry_latex: { type: "string" },
  },
  required: ["question_type", "question_text", "subject_name", "marks", "options", "grading_rubric", "source_page", "review_reasons", "equation_latex", "chemistry_latex"],
} as const;

const responseSchema = {
  type: "object",
  properties: {
    page_count: { type: "integer" },
    warnings: { type: "array", items: { type: "string" } },
    questions: { type: "array", items: questionSchema },
  },
  required: ["page_count", "warnings", "questions"],
} as const;

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function scientificBlocks(value: any) {
  const blocks: Array<{ type: "equation" | "chemistry"; latex: string }> = [];
  const equation = stringValue(value?.equation_latex);
  const chemistry = stringValue(value?.chemistry_latex);
  if (equation) blocks.push({ type: "equation", latex: equation });
  if (chemistry) blocks.push({ type: "chemistry", latex: chemistry });
  return blocks;
}

function normalizeQuestions(value: any): ImportedMockQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((question: any, index) => {
    const questionText = stringValue(question?.question_text);
    const type = question?.question_type === "mcq" ? "mcq" : "theory";
    if (!questionText) return [];
    const options = Array.isArray(question?.options)
      ? question.options.flatMap((option: any, optionIndex: number) => {
        const optionText = stringValue(option?.option_text);
        return optionText ? [{
          id: `pdf_${Date.now()}_${index}_${optionIndex}`,
          option_text: optionText,
          is_correct: option?.is_correct === true,
          content_blocks: scientificBlocks(option),
        }] : [];
      })
      : [];
    const reviewReasons: string[] = Array.isArray(question?.review_reasons)
      ? question.review_reasons.map((reason: unknown): string => stringValue(reason)).filter((reason: string): boolean => Boolean(reason))
      : [];
    if (type === "mcq" && (options.length < 2 || options.filter((option: { is_correct: boolean }) => option.is_correct).length !== 1)) {
      reviewReasons.push("Check the options and correct answer before publishing.");
    }
    return [{
      id: `pdf_${Date.now()}_${index}`,
      question_type: type,
      question_text: questionText,
      subject_name: stringValue(question?.subject_name) || undefined,
      marks: Number.isFinite(Number(question?.marks)) && Number(question.marks) > 0 ? Number(question.marks) : 1,
      options: type === "mcq" ? options : [],
      content_blocks: scientificBlocks(question),
      grading_rubric: type === "theory" ? stringValue(question?.grading_rubric) : undefined,
      source_page: Number.isInteger(question?.source_page) ? question.source_page : null,
      review_reasons: [...new Set(reviewReasons)],
    } satisfies ImportedMockQuestion];
  });
}

const extractionPrompt = `You are importing an examination document into Kanvise, a Nigerian mock-exam platform.

Extract every question exactly as it appears. The document may have any layout: scanned pages, columns, tables, diagrams, equations, mixed subjects, separate answer keys, or no answer key. Do not assume a fixed template and do not invent missing answers.

Return one question per object. Set subject_name to the document's subject heading for that question (for example Use of English, Physics, Chemistry or Mathematics). Carry the most recent clear subject heading across following pages until another heading begins. Use an empty subject_name and add a review reason when the subject cannot be determined confidently. Use question_type=mcq only when the question has selectable answer options; otherwise use theory. Preserve mathematical and chemical notation in readable text. When a question or option contains a mathematical equation, put its LaTeX in equation_latex; when it contains a chemical formula or reaction, put mhchem/LaTeX in chemistry_latex. Use an empty string for whichever does not apply. If an image, diagram, table, or equation is important but cannot be represented faithfully as text, add a short review_reasons entry. If an answer is missing or uncertain, leave every option is_correct=false and add a review reason. Record the source page when the document makes it possible. Keep mixed subjects together as one mock and label each question with its subject; do not reject mixed-subject documents.`;

type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

async function callGemini(parts: GeminiPart[], fallbackPageCount: number | null, initialWarnings: string[] = []): Promise<MockPdfImportResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("AI document import is not configured yet. Add GEMINI_API_KEY to the API environment.");

  const model = process.env.GEMINI_MOCK_IMPORT_MODEL || "gemini-2.5-flash";

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema,
      },
    }),
  });
  const body: any = await response.json().catch(() => null);
  if (!response.ok) {
    const message = stringValue(body?.error?.message) || "Gemini could not process this PDF";
    throw new Error(message);
  }
  const rawText = body?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || "").join("") || "";
  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("Gemini returned an invalid import response. Please try the PDF again.");
  }
  const questions = normalizeQuestions(parsed.questions);
  const warnings: string[] = Array.isArray(parsed.warnings)
    ? parsed.warnings.map((warning: unknown): string => stringValue(warning)).filter((warning: string): boolean => Boolean(warning))
    : [];
  if (questions.length === 0) warnings.push("No questions were found. Check that the PDF contains an examination paper.");
  const usage = body?.usageMetadata;
  if (usage) {
    console.info("[mocks] Gemini import usage", {
      model,
      prompt_tokens: usage.promptTokenCount,
      output_tokens: usage.candidatesTokenCount,
      total_tokens: usage.totalTokenCount,
    });
  }
  return {
    questions,
    warnings: [...new Set([...initialWarnings, ...warnings])],
    page_count: Number.isInteger(parsed.page_count) ? parsed.page_count : fallbackPageCount,
  };
}

export async function importQuestionsFromPdf(buffer: Uint8Array): Promise<MockPdfImportResult> {
  const extracted = await extractPdfText(buffer);
  if (!extracted.has_readable_text) {
    return callGemini([
      { inline_data: { mime_type: "application/pdf", data: Buffer.from(buffer).toString("base64") } },
      { text: extractionPrompt },
    ], extracted.page_count, ["This appears to be a scanned PDF, so it was read visually. Review diagrams and answer keys before publishing."]);
  }

  const imagePages = extracted.pages.filter((page) => page.has_embedded_image).map((page) => page.page_number);
  const sourceText = extracted.pages
    .map((page) => `--- Source page ${page.page_number} ---\n${page.text || "[No selectable text on this page]"}`)
    .join("\n\n");
  const visualWarning = imagePages.length
    ? `Pages ${imagePages.join(", ")} contain embedded images or diagrams. Their question text was imported, but review those questions before publishing because figure crops are not attached yet.`
    : "";
  return callGemini([
    { text: `The following is selectable text extracted locally from a PDF. Page markers are authoritative. Do not infer visual content that is not present in this text.\n\n${sourceText}` },
    { text: extractionPrompt },
  ], extracted.page_count, visualWarning ? [visualWarning] : []);
}

export async function importQuestionsFromDocumentText(text: string, fileName?: string): Promise<MockPdfImportResult> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("The Word document did not contain readable text.");
  if (trimmed.length > 2_000_000) throw new Error("This Word document is too large to import in one pass. Try a shorter document.");
  return callGemini([
    { text: `Document name: ${fileName || "Word document"}\n\n${trimmed}` },
    { text: extractionPrompt },
  ], null);
}
