import { beforeEach, describe, expect, it, vi } from "vitest";

const pdfText = vi.hoisted(() => ({ extractPdfText: vi.fn() }));
vi.mock("./mock-pdf-text", () => ({ extractPdfText: pdfText.extractPdfText }));

import { importQuestionsFromDocumentText, importQuestionsFromPdf } from "./mock-pdf-import";

describe("Gemini mock PDF import", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn());
    pdfText.extractPdfText.mockResolvedValue({
      page_count: 2,
      has_readable_text: true,
      pages: [
        { page_number: 1, text: "1. What is 2 + 2?", has_embedded_image: false },
        { page_number: 2, text: "2. Explain osmosis. Answers: 1. B Worked solution: 2 + 2 = 4", has_embedded_image: false },
      ],
    });
  });

  it("normalises Gemini's structured mixed mock response", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({
        page_count: 999,
        warnings: [],
        questions: [
          { question_type: "mcq", question_text: "What is 2 + 2?", subject_name: "Mathematics", marks: 1, options: [
            { label: "A", option_text: "3", is_correct: false },
            { label: "B", option_text: "4", is_correct: true },
          ], grading_rubric: "", source_page: 1, review_reasons: [] },
          { question_type: "theory", question_text: "Explain osmosis.", subject_name: "Biology", marks: 5, options: [], grading_rubric: "Mentions movement across a membrane.", source_page: 2, review_reasons: [] },
        ],
      }) }] } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const result = await importQuestionsFromPdf(new Uint8Array([1, 2, 3]));
    expect(result.page_count).toBe(2);
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].options[1].is_correct).toBe(true);
    expect(result.questions.map((question) => question.subject_name)).toEqual(["Mathematics", "Biology"]);
    expect(result.questions[1].question_type).toBe("theory");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(expect.stringContaining("gemini-2.5-flash"), expect.objectContaining({ method: "POST" }));
    expect(JSON.stringify(vi.mocked(fetch).mock.calls[0][1])).toContain("Source page 1");
    expect(JSON.stringify(vi.mocked(fetch).mock.calls[0][1])).toContain("application/pdf");
    expect(JSON.stringify(vi.mocked(fetch).mock.calls[0][1])).toContain("must reproduce that key exactly");
    expect(JSON.stringify(vi.mocked(fetch).mock.calls[0][1])).toContain("ANSWER-KEY REFERENCE");
    expect(JSON.stringify(vi.mocked(fetch).mock.calls[0][1])).toContain("metadata only");
  });

  it("surfaces provider errors", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: { message: "quota exceeded" } }), { status: 429 }));
    await expect(importQuestionsFromPdf(new Uint8Array([1]))).rejects.toThrow("quota exceeded");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it("retries temporary provider capacity errors", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "high demand" } }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ page_count: 2, warnings: [], questions: [] }) }] } }] }), { status: 200 }));
    const importPromise = importQuestionsFromPdf(new Uint8Array([1]));
    await vi.advanceTimersByTimeAsync(750);
    const result = await importPromise;
    expect(result.page_count).toBe(2);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("falls back to sectioned local text when Gemini cannot decode the PDF visual", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "The document has no pages." } }), { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ page_count: 2, warnings: [], questions: [] }) }] } }] }), { status: 200 }));
    const result = await importQuestionsFromPdf(new Uint8Array([1]));
    expect(result.warnings.join(" ")).toContain("locally extracted text");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(vi.mocked(fetch).mock.calls[1][1])).not.toContain("application/pdf");
  });

  it("falls back to visual-only PDF mode when no selectable text is available", async () => {
    pdfText.extractPdfText.mockResolvedValue({ page_count: 1, has_readable_text: false, pages: [{ page_number: 1, text: "", has_embedded_image: false }] });
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ page_count: 1, warnings: [], questions: [{
        question_type: "theory", question_text: "Name the labelled part.", marks: 1, options: [], grading_rubric: "", source_page: 1, review_reasons: [],
      }] }) }] } }],
    }), { status: 200 }));

    const result = await importQuestionsFromPdf(new Uint8Array([1, 2, 3]));
    expect(result.warnings.join(" ")).toContain("scanned PDF");
    expect(JSON.stringify(vi.mocked(fetch).mock.calls[0][1])).toContain("application/pdf");
  });

  it("sends Word text to the same structured importer", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ page_count: null, warnings: [], questions: [{
        question_type: "theory", question_text: "Explain mitosis.", marks: 4, options: [], grading_rubric: "", source_page: null, review_reasons: [],
      }] }) }] } }],
    }), { status: 200 }));
    const result = await importQuestionsFromDocumentText("1. Explain mitosis.", "exam.docx");
    expect(result.questions[0].question_text).toBe("Explain mitosis.");
    expect(vi.mocked(fetch).mock.calls[0][1]).toEqual(expect.objectContaining({ method: "POST" }));
    expect(JSON.stringify(vi.mocked(fetch).mock.calls[0][1])).toContain("exam.docx");
  });
});
