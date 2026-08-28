export const CENTRE_MOCK_AUDIENCE_SCOPES = ['course', 'programme', 'school'] as const
export const MOCK_AUDIENCE_SCOPES = CENTRE_MOCK_AUDIENCE_SCOPES

export type CentreMockAudienceScope = typeof CENTRE_MOCK_AUDIENCE_SCOPES[number]
export type MockAudienceScope = typeof MOCK_AUDIENCE_SCOPES[number]

export function parseMockAudienceScope(value: unknown): MockAudienceScope | null {
  return typeof value === 'string' && (MOCK_AUDIENCE_SCOPES as readonly string[]).includes(value)
    ? value as MockAudienceScope
    : null
}

export function canCreateMockForAudience(role: string, scope: CentreMockAudienceScope) {
  return role === 'admin' || scope === 'course'
}

export function validateCentreMockAudience(input: {
  audience_scope: unknown
  course_id: unknown
  programme_id: unknown
}) {
  const scope = parseMockAudienceScope(input.audience_scope ?? 'course')
  if (!scope) return { error: 'Choose a valid centre mock audience' } as const

  const courseId = typeof input.course_id === 'string' && input.course_id.trim() ? input.course_id : null
  const programmeId = typeof input.programme_id === 'string' && input.programme_id.trim() ? input.programme_id : null
  if (scope === 'course' && (!courseId || programmeId)) {
    return { error: 'Choose one course for this mock' } as const
  }
  if (scope === 'programme' && (!programmeId || courseId)) {
    return { error: 'Choose one programme for this mock' } as const
  }
  if (scope === 'school' && (courseId || programmeId)) {
    return { error: 'Centre-wide mocks cannot also target a course or programme' } as const
  }
  return { scope, courseId, programmeId } as const
}

export function audienceLabel(scope: CentreMockAudienceScope, name?: string | null) {
  if (scope === 'school') return 'Entire centre'
  return name || (scope === 'programme' ? 'Programme' : 'Course')
}
