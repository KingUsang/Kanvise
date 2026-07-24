import { beforeEach, describe, expect, it, vi } from "vitest";
import { importQuestionsFromDocumentText, importQuestionsFromPdf } from "./mock-pdf-import";

describe("Gemini mock PDF import", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn());
  });

  it("normalises Gemini's structured mixed mock response", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({
        page_count: 2,
        warnings: [],
        questions: [
          { question_type: "mcq", question_text: "What is 2 + 2?", marks: 1, options: [
            { label: "A", option_text: "3", is_correct: false },
            { label: "B", option_text: "4", is_correct: true },
          ], grading_rubric: "", source_page: 1, review_reasons: [] },
          { question_type: "theory", question_text: "Explain osmosis.", marks: 5, options: [], grading_rubric: "Mentions movement across a membrane.", source_page: 2, review_reasons: [] },
        ],
      }) }] } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const result = await importQuestionsFromPdf(new Uint8Array([1, 2, 3]));
    expect(result.page_count).toBe(2);
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].options[1].is_correct).toBe(true);
    expect(result.questions[1].question_type).toBe("theory");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(expect.stringContaining("gemini-2.5-flash"), expect.objectContaining({ method: "POST" }));
  });

  it("surfaces provider errors", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: { message: "quota exceeded" } }), { status: 429 }));
    await expect(importQuestionsFromPdf(new Uint8Array([1]))).rejects.toThrow("quota exceeded");
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
