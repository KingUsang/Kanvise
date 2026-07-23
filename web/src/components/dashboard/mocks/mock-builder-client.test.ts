import { describe, expect, it } from "vitest";
import { parseDocxQuestionText } from "./mock-builder-client";

describe("Word mock import", () => {
  it("parses MCQ and theory blocks and ignores malformed questions", () => {
    const result = parseDocxQuestionText(`
Type: MCQ
Question: What is 2 + 2?
Marks: 2
A. 3
B. 4
C. 5
Answer: B
---
Type: Theory
Question: Explain photosynthesis.
Marks: 5
Rubric: Mentions light, chlorophyll and glucose.
---
Type: MCQ
Question: This has no answer
A. One
B. Two
`);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      question_type: "mcq",
      question_text: "What is 2 + 2?",
      marks: 2,
    });
    expect(result[0].options.find((option) => option.is_correct)?.option_text).toBe("4");
    expect(result[1]).toMatchObject({
      question_type: "theory",
      grading_rubric: "Mentions light, chlorophyll and glucose.",
    });
  });
});
