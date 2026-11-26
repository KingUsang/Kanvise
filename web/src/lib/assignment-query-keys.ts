export const assignmentQueryKeys = {
  list: (accountId: string | null, courseId: string | null, classId: string | null) =>
    ['assignments', accountId, courseId, classId] as const,
  submissions: (accountId: string | null, assignmentId: string) =>
    ['assignment-submissions', accountId, assignmentId] as const,
} as const
