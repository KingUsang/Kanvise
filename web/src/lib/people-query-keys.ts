export function peopleQueryKeys(accountId: string | null) {
  const root = ['people-management', accountId] as const
  return {
    root,
    tutors: [...root, 'tutors'] as const,
    invites: [...root, 'invites'] as const,
    people: [...root, 'people'] as const,
    assignments: [...root, 'assignments'] as const,
    profile: [...root, 'profile'] as const,
  }
}
