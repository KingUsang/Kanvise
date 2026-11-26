export const classQueryKeys = {
  programmes: (accountId: string | null) => ['programmes', accountId] as const,
  workspace: (accountId: string | null, classId: string) => ['class-workspace', accountId, classId] as const,
  tutors: (accountId: string | null, classId: string) => ['class-tutors', accountId, classId] as const,
  schedule: (accountId: string | null, classId: string) => ['class-schedule', accountId, classId] as const,
  mocks: (accountId: string | null, classId: string) => ['class-mocks', accountId, classId] as const,
  assignments: (accountId: string | null, classId: string) => ['class-assignments', accountId, classId] as const,
  materials: (accountId: string | null, classId: string, subjectId: string) => ['class-materials', accountId, classId, subjectId] as const,
  insights: (accountId: string | null, classId: string, subjectId: string) => ['class-insights', accountId, classId, subjectId] as const,
  learnerDetail: (accountId: string | null, classId: string, subjectId: string, learnerId: string | null) => ['class-learner-detail', accountId, classId, subjectId, learnerId] as const,
  dashboardSchedule: (accountId: string | null) => ['dashboard-schedule', accountId] as const,
} as const
