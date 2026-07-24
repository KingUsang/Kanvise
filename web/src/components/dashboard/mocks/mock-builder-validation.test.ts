import { describe, expect, it } from "vitest";
import { buildPrePublishReview } from "./mock-builder-validation";

const base = {
  title: "Mixed science mock",
  distributionMode: "centre" as const,
  courseId: "course-1",
  questions: [{ question_type: "mcq" as const, question_text: "What is 2 + 2?", marks: 1, options: [
    { option_text: "3", is_correct: false }, { option_text: "4", is_correct: true },
  ] }],
  selectedBankQuestions: [], isUntimed: false, timeLimit: 60, publishMode: "immediate" as const,
  publishDate: "", publishTime: "", availableFrom: "", closesAt: "", marketplaceExam: "",
  marketplaceSubjects: "", marketplacePriceType: "free" as const, marketplacePrice: "", marketplaceRightsConfirmed: false,
};

describe("buildPrePublishReview", () => {
  it("allows a valid centre mock", () => {
    expect(buildPrePublishReview(base)).toEqual({ errors: [], warnings: [] });
  });

  it("requires marketplace details but does not impose subject sections", () => {
    const review = buildPrePublishReview({ ...base, distributionMode: "marketplace", courseId: "", marketplaceSubjects: "Physics, Chemistry", marketplaceExam: "JAMB" , marketplaceRightsConfirmed: true });
    expect(review.errors).toEqual([]);
  });

  it("blocks incomplete MCQs and flags imported review warnings", () => {
    const review = buildPrePublishReview({ ...base, questions: [{ ...base.questions[0], options: [{ option_text: "Only one", is_correct: false }], review_reasons: ["Check the diagram"] }] });
    expect(review.errors).toContain("Question 1 needs at least two options.");
    expect(review.warnings).toContain("Question 1: Check the diagram");
  });
});
