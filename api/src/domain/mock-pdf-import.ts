import { extractPdfText } from "./mock-pdf-text";
import { performance } from "node:perf_hooks";

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
    const questionBlocks = scientificBlocks(question);
    const type = question?.question_type === "mcq" ? "mcq" : "theory";
    if (!questionText && questionBlocks.length === 0) return [];
    const options = Array.isArray(question?.options)
      ? question.options.flatMap((option: any, optionIndex: number) => {
        const optionText = stringValue(option?.option_text);
        const optionBlocks = scientificBlocks(option);
        return optionText || optionBlocks.length ? [{
          id: `pdf_${Date.now()}_${index}_${optionIndex}`,
          option_text: optionText,
          is_correct: option?.is_correct === true,
          content_blocks: optionBlocks,
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
      content_blocks: questionBlocks,
      grading_rubric: type === "theory" ? stringValue(question?.grading_rubric) : undefined,
      source_page: Number.isInteger(question?.source_page) ? question.source_page : null,
      review_reasons: [...new Set(reviewReasons)],
    } satisfies ImportedMockQuestion];
  });
}

// Temporary latency diagnostic: keep the response schema unchanged while removing
// the long extraction instructions. Restore the full prompt after the A/B test.
const extractionPrompt = `Extract every question from the document.

Return valid JSON matching the supplied schema. Preserve question wording, options,
marks, subjects, source pages, and answer-key correctness. Do not add explanations
or extra text outside the JSON. Use empty strings and review_reasons for missing or
uncertain information. For MCQs, preserve the source answer exactly.

`;

type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

// A 429 often carries a minute/day quota reset and retrying immediately only
// burns request time. Capacity/server failures are safe to retry briefly.
const TRANSIENT_GEMINI_STATUSES = new Set([500, 502, 503, 504]);

type PdfImportLogMetadata = {
  model: string;
  file_size_bytes?: number;
  page_count?: number | null;
  extracted_text_characters?: number;
  processing_mode: "text" | "visual" | "both";
};

function elapsedMs(startedAt: number) {
  return Math.round((performance.now() - startedAt) * 100) / 100;
}

function retryDelayMs(response: Response, attempt: number) {
  const retryAfterSeconds = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1_000, 5_000);
  }
  return [750, 2_000][attempt] ?? 2_000;
}

async function requestGemini(url: string, init: RequestInit) {
  let retryCount = 0;
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(url, init);
      const body: any = await response.json().catch(() => null);
      if (response.ok) return { body, retryCount };

      const message = stringValue(body?.error?.message) || "Gemini could not process this PDF";
      if (!TRANSIENT_GEMINI_STATUSES.has(response.status) || attempt === 2) {
        const error = new Error(message);
        Object.assign(error, {
          geminiStatus: response.status,
          geminiStatusText: response.statusText,
          geminiErrorCode: body?.error?.code,
          geminiErrorStatus: body?.error?.status,
          geminiRetryCount: retryCount,
        });
        throw error;
      }
      const delayMs = retryDelayMs(response, attempt);
      retryCount += 1;
      console.warn("[mocks] Retrying transient Gemini import failure", { status: response.status, attempt: attempt + 1, delay_ms: delayMs });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  } catch (error) {
    if (error instanceof Error) Object.assign(error, { geminiRetryCount: retryCount });
    throw error;
  }
  throw new Error("Gemini could not process this PDF");
}

async function callGemini(parts: GeminiPart[], fallbackPageCount: number | null, initialWarnings: string[] = [], metadata?: PdfImportLogMetadata): Promise<MockPdfImportResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("AI document import is not configured yet. Add GEMINI_API_KEY to the API environment.");

  const model = process.env.GEMINI_MOCK_IMPORT_MODEL || "gemini-2.5-flash";
  const logMetadata = { model, processing_mode: metadata?.processing_mode || "both", ...metadata };
  const geminiStartedAt = performance.now();
  let requestResult: { body: any; retryCount: number };
  try {
    requestResult = await requestGemini(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: "application/json",
          responseSchema,
        },
      }),
    });
    console.info("[mocks] PDF import Gemini performance", { stage: "gemini_api_call", status: "success", duration_ms: elapsedMs(geminiStartedAt), retry_count: requestResult.retryCount, ...logMetadata });
  } catch (error) {
    console.error("[mocks] PDF import Gemini performance", {
      stage: "gemini_api_call",
      status: "failure",
      duration_ms: elapsedMs(geminiStartedAt),
      retry_count: Number((error as any)?.geminiRetryCount || 0),
      ...logMetadata,
      error_type: error instanceof Error ? error.name : "UnknownError",
      provider_status: (error as any)?.geminiStatus,
      provider_status_text: (error as any)?.geminiStatusText,
      provider_error_code: (error as any)?.geminiErrorCode,
      provider_error_status: (error as any)?.geminiErrorStatus,
      provider_message: error instanceof Error ? error.message.slice(0, 300) : undefined,
    });
    throw error;
  }
  const responseProcessingStartedAt = performance.now();
  let questionCount = 0;
  try {
    const body = requestResult.body;
    const rawText = body?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || "").join("") || "";
    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error("Gemini returned an invalid import response. Please try the PDF again.");
    }
    const questions = normalizeQuestions(parsed.questions);
    questionCount = questions.length;
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
        thinking_tokens: usage.thoughtsTokenCount,
        total_tokens: usage.totalTokenCount,
      });
    }
    console.info("[mocks] PDF import response performance", { stage: "response_parsing_normalization_validation", status: "success", duration_ms: elapsedMs(responseProcessingStartedAt), retry_count: requestResult.retryCount, question_count: questionCount, ...logMetadata });
    return {
      questions,
      warnings: [...new Set([...initialWarnings, ...warnings])],
      page_count: fallbackPageCount ?? (Number.isInteger(parsed.page_count) ? parsed.page_count : null),
    };
  } catch (error) {
    console.error("[mocks] PDF import response performance", { stage: "response_parsing_normalization_validation", status: "failure", duration_ms: elapsedMs(responseProcessingStartedAt), retry_count: requestResult.retryCount, question_count: questionCount, ...logMetadata, error_type: error instanceof Error ? error.name : "UnknownError" });
    throw error;
  }
}

export async function importQuestionsFromPdf(buffer: Uint8Array): Promise<MockPdfImportResult> {
  const preparationStartedAt = performance.now();
  let extractedTextCharacters = 0;
  let pageCount: number | null = null;
  let processingMode: PdfImportLogMetadata["processing_mode"] = "text";
  let preparationComplete = false;
  try {
    const extracted = await extractPdfText(buffer);
    pageCount = extracted.page_count;
    extractedTextCharacters = extracted.pages.reduce((total, page) => total + page.text.length, 0);
    if (!extracted.has_readable_text) {
      processingMode = "visual";
      console.info("[mocks] PDF import preparation performance", { stage: "pdf_text_extraction_preparation", status: "success", duration_ms: elapsedMs(preparationStartedAt), file_size_bytes: buffer.byteLength, page_count: pageCount, extracted_text_characters: extractedTextCharacters, processing_mode: processingMode });
      preparationComplete = true;
    return callGemini([
      { inline_data: { mime_type: "application/pdf", data: Buffer.from(buffer).toString("base64") } },
      { text: extractionPrompt },
      ], extracted.page_count, ["This appears to be a scanned PDF, so it was read visually. Review diagrams and answer keys before publishing."], { model: process.env.GEMINI_MOCK_IMPORT_MODEL || "gemini-2.5-flash", file_size_bytes: buffer.byteLength, page_count: pageCount, extracted_text_characters: extractedTextCharacters, processing_mode: processingMode });
    }

  const imagePages = extracted.pages.filter((page) => page.has_embedded_image).map((page) => page.page_number);
  const questionPaperPages: string[] = [];
  const answerKeyPages: string[] = [];
  let readingAnswerKey = false;
  for (const page of extracted.pages) {
    const markerIndex = page.text.search(/\bAnswers?:/i);
    if (!readingAnswerKey && markerIndex >= 0) {
      const questionText = page.text.slice(0, markerIndex).trim();
      const answerText = page.text.slice(markerIndex).trim();
      if (questionText) questionPaperPages.push(`--- Source page ${page.page_number} ---\n${questionText}`);
      if (answerText) answerKeyPages.push(`--- Source page ${page.page_number} ---\n${answerText}`);
      readingAnswerKey = true;
    } else {
      const target = readingAnswerKey ? answerKeyPages : questionPaperPages;
      target.push(`--- Source page ${page.page_number} ---\n${page.text || "[No selectable text on this page]"}`);
    }
  }
  const sourceText = [
    `QUESTION PAPER — the only source for student-visible question and option content:\n\n${questionPaperPages.join("\n\n")}`,
    answerKeyPages.length
      ? `ANSWER-KEY REFERENCE — use only to set is_correct and flag suspected source errors. Never copy workings or explanations into student-visible fields:\n\n${answerKeyPages.join("\n\n")}`
      : "",
  ].filter(Boolean).join("\n\n");
  const visualWarning = imagePages.length
    ? `Pages ${imagePages.join(", ")} contain embedded images or diagrams. Their question text was imported, but review those questions before publishing because figure crops are not attached yet.`
    : "";
  const initialWarnings = visualWarning ? [visualWarning] : [];
  processingMode = "both";
  console.info("[mocks] PDF import preparation performance", { stage: "pdf_text_extraction_preparation", status: "success", duration_ms: elapsedMs(preparationStartedAt), file_size_bytes: buffer.byteLength, page_count: pageCount, extracted_text_characters: extractedTextCharacters, processing_mode: processingMode });
  preparationComplete = true;
  try {
    return await callGemini([
      { inline_data: { mime_type: "application/pdf", data: Buffer.from(buffer).toString("base64") } },
      { text: `Use the attached PDF as the visual reference for layout, mathematical notation, tables, and diagrams. The following text was extracted locally and separates the question paper from its answer key; its page markers and section boundary are authoritative. Do not copy answer-key workings into student-visible fields.\n\n${sourceText}` },
      { text: extractionPrompt },
    ], extracted.page_count, initialWarnings, { model: process.env.GEMINI_MOCK_IMPORT_MODEL || "gemini-2.5-flash", file_size_bytes: buffer.byteLength, page_count: pageCount, extracted_text_characters: extractedTextCharacters, processing_mode: processingMode });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/document has no pages|invalid (?:pdf|document)|could not parse (?:the )?(?:pdf|document)/i.test(message)) throw error;
    processingMode = "text";
    return callGemini([
      { text: `The following is locally extracted PDF text. Its page markers and QUESTION PAPER / ANSWER-KEY REFERENCE boundary are authoritative. Do not copy answer-key workings into student-visible fields.\n\n${sourceText}` },
      { text: extractionPrompt },
    ], extracted.page_count, [...initialWarnings, "Gemini could not read this PDF visually, so Kanvise used its locally extracted text. Review mathematical layout before publishing."], { model: process.env.GEMINI_MOCK_IMPORT_MODEL || "gemini-2.5-flash", file_size_bytes: buffer.byteLength, page_count: pageCount, extracted_text_characters: extractedTextCharacters, processing_mode: processingMode });
  }
  } catch (error) {
    if (!preparationComplete) console.error("[mocks] PDF import preparation performance", { stage: "pdf_text_extraction_preparation", status: "failure", duration_ms: elapsedMs(preparationStartedAt), file_size_bytes: buffer.byteLength, page_count: pageCount, extracted_text_characters: extractedTextCharacters, processing_mode: processingMode, error_type: error instanceof Error ? error.name : "UnknownError" });
    throw error;
  }
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
