// bank_questions.current_version_id and bank_question_versions.question_id
// create two relationships. Always select the version's owning question.
export const BANK_QUESTION_TYPE_RELATION =
  'question:bank_questions!bank_question_versions_question_id_fkey(question_type)'
