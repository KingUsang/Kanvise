export const settingsQueryKeys = {
  school: (accountId: string | null) => ['dashboard-school', accountId] as const,
} as const
