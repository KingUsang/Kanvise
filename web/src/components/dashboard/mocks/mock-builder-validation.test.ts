import { describe, expect, it } from "vitest";
import { buildPrePublishReview } from "./mock-builder-validation";

const base = {
  title: "Mixed science mock",
  accessMode: "centre" as const,
  courseId: "course-1",
  questions: [{ question_type: "mcq" as const, question_text: "What is 2 + 2?", marks: 1, options: [
    { option_text: "3", is_correct: false }, { option_text: "4", is_correct: true },
  ] }],
  selectedBankQuestions: [], isUntimed: false, timeLimit: 60, publishMode: "immediate" as const,
  publishDate: "", publishTime: "", availableFrom: "", closesAt: "",
};

describe("buildPrePublishReview", () => {
  it("allows a valid centre mock", () => {
    expect(buildPrePublishReview(base)).toEqual({ errors: [], warnings: [] });
  });

  it("allows a direct-link mock without a centre subject", () => {
    const review = buildPrePublishReview({ ...base, accessMode: "direct", courseId: "", audienceScope: "direct_link" });
    expect(review.errors).toEqual([]);
  });

  it("does not require an optional expected answer for a written question", () => {
    const review = buildPrePublishReview({ ...base, questions: [{ question_type: "theory", question_text: "Explain osmosis.", marks: 5, options: [] }] });
    expect(review).toEqual({ errors: [], warnings: [] });
  });

  it("blocks incomplete MCQs and flags imported review warnings", () => {
    const review = buildPrePublishReview({ ...base, questions: [{ ...base.questions[0], options: [{ option_text: "Only one", is_correct: false }], review_reasons: ["Check the diagram"] }] });
    expect(review.errors).toContain("Question 1 needs at least two options.");
    expect(review.warnings).toContain("Question 1: Check the diagram");
  });

  it("accepts formula-only options produced by document import", () => {
    const review = buildPrePublishReview({
      ...base,
      questions: [{
        ...base.questions[0],
        question_text: "Find the value of",
        content_blocks: [{ type: "equation", latex: String.raw`110111_{2} + 10100_{2}` }],
        options: [
          { option_text: "", content_blocks: [{ type: "equation", latex: String.raw`1001011_{2}` }], is_correct: true },
          { option_text: "", content_blocks: [{ type: "equation", latex: String.raw`1000011_{2}` }], is_correct: false },
        ],
      }],
    });
    expect(review.errors).toEqual([]);
  });

  it("requires every authored multi-subject question to have a subject section", () => {
    const review = buildPrePublishReview({
      ...base,
      audienceScope: "combination",
      courseId: "",
      deliveryMode: "subject_combination",
      questions: [{ ...base.questions[0], course_id: null }],
    });
    expect(review.errors).toContain("Assign every question to a subject section.");
  });

  it("requires every reused multi-subject question to have a subject section", () => {
    const review = buildPrePublishReview({
      ...base,
      audienceScope: "combination",
      courseId: "",
      deliveryMode: "subject_combination",
      questions: [],
      selectedBankQuestions: [{ questionText: "What is force?", questionType: "mcq", marks: 1, courseId: null }],
    });
    expect(review.errors).toContain("Assign every question-bank item to a subject section.");
  });
});
