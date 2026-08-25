export type DraftQuestionForReview = {
  question_type: "mcq" | "theory";
  question_text: string;
  marks: number;
  options: Array<{ option_text: string; is_correct: boolean }>;
  review_reasons?: string[];
};

export type PrePublishReview = {
  errors: string[];
  warnings: string[];
};

type ReviewInput = {
  title: string;
  distributionMode: "centre" | "marketplace" | "both";
  courseId: string;
  programmeId?: string;
  audienceScope?: "course" | "programme" | "school";
  questions: DraftQuestionForReview[];
  selectedBankQuestions: Array<{ questionText: string; questionType: "mcq" | "theory"; marks: number }>;
  isUntimed: boolean;
  timeLimit: number;
  publishMode: "immediate" | "scheduled";
  publishDate: string;
  publishTime: string;
  availableFrom: string;
  closesAt: string;
  marketplaceExam: string;
  marketplaceSubjects: string;
  marketplacePriceType: "free" | "paid";
  marketplacePrice: string;
  marketplaceRightsConfirmed: boolean;
};

export function buildPrePublishReview(input: ReviewInput): PrePublishReview {
  const errors: string[] = [];
  const warnings: string[] = [];
  const audienceScope = input.audienceScope || "course";
  const totalQuestions = input.questions.length + input.selectedBankQuestions.length;
  if (!input.title.trim()) errors.push("Add a title for the mock.");
  if (input.distributionMode === "centre" || input.distributionMode === "both") {
    if (audienceScope === "course" && !input.courseId) errors.push("Choose the subject this mock is for.");
    if (audienceScope === "programme" && !input.programmeId) errors.push("Choose the programme this mock is for.");
  }
  if (totalQuestions === 0) errors.push("Add at least one question.");

  input.questions.forEach((question, index) => {
    const label = `Question ${index + 1}`;
    if (!question.question_text.trim()) errors.push(`${label} needs question text.`);
    if (!Number.isFinite(question.marks) || question.marks <= 0) errors.push(`${label} needs positive marks.`);
    if (question.question_type === "mcq") {
      const options = question.options.filter((option) => option.option_text.trim());
      if (options.length < 2) errors.push(`${label} needs at least two options.`);
      if (options.filter((option) => option.is_correct).length !== 1) errors.push(`${label} needs exactly one correct answer.`);
    } else if (!question.review_reasons?.length && !question.question_text.trim()) {
      warnings.push(`${label} may need a marking guide.`);
    }
    for (const reason of question.review_reasons || []) warnings.push(`${label}: ${reason}`);
  });

  const allTexts = [
    ...input.questions.map((question) => question.question_text),
    ...input.selectedBankQuestions.map((question) => question.questionText),
  ].map((text) => text.trim().toLowerCase().replace(/\s+/g, " ")).filter(Boolean);
  const duplicates = new Set(allTexts.filter((text, index) => allTexts.indexOf(text) !== index));
  if (duplicates.size) warnings.push(`${duplicates.size} duplicate question${duplicates.size === 1 ? "" : "s"} detected.`);

  if (!input.isUntimed && (!Number.isFinite(input.timeLimit) || input.timeLimit <= 0)) errors.push("Set a positive time limit or choose an untimed mock.");
  if (input.publishMode === "scheduled") {
    const scheduledAt = input.publishDate && input.publishTime ? new Date(`${input.publishDate}T${input.publishTime}:00`) : null;
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) errors.push("Choose a future publication date and time.");
  }
  if (input.availableFrom && input.closesAt && new Date(input.closesAt) <= new Date(input.availableFrom)) errors.push("Closing time must be after the opening time.");

  if (input.distributionMode === "marketplace" || input.distributionMode === "both") {
    if (!input.marketplaceExam.trim()) errors.push("Add the exam or category for the public listing.");
    if (!input.marketplaceSubjects.trim()) errors.push("Add at least one subject for the public listing.");
    if (!input.marketplaceRightsConfirmed) errors.push("Confirm that you have the right to publish these questions publicly.");
    if (input.marketplacePriceType === "paid" && (!Number.isFinite(Number(input.marketplacePrice)) || Number(input.marketplacePrice) < 50)) errors.push("Set a public price of at least ₦50, or make the mock free.");
    if (!input.title.trim() || !input.marketplaceExam.trim()) warnings.push("Students will use the title and exam category to decide whether this mock is for them.");
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
