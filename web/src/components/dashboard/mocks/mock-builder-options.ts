export type MockCourseOption = {
  id: string
  name: string
  programme?: { name: string } | Array<{ name: string }> | null
}

export function mockCourseLabel(course: MockCourseOption) {
  const programme = Array.isArray(course.programme) ? course.programme[0] : course.programme
  return programme?.name ? `${programme.name} → ${course.name}` : `${course.name} · Standalone`
}

export function unusedMockCourses<T extends { id: string }>(courses: T[], selectedCourseIds: Array<string | null>) {
  const selected = new Set(selectedCourseIds.filter((id): id is string => Boolean(id)))
  return courses.filter((course) => !selected.has(course.id))
}
