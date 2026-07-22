export type StudentEnrolment = {
  programme_id: string | null
  sub_programme_id: string | null
  course_id: string | null
}

export type StudentCourse = {
  id: string
  programme_id: string | null
  sub_programme_id: string | null
}

export function resolveStudentCourses<T extends StudentCourse>(
  enrolments: StudentEnrolment[],
  courses: T[],
  subProgrammes: Array<{ id: string; programme_id: string }> = [],
) {
  const programmeIds = new Set(enrolments.flatMap((item) => item.programme_id ? [item.programme_id] : []))
  const subProgrammeIds = new Set(enrolments.flatMap((item) => item.sub_programme_id ? [item.sub_programme_id] : []))
  const courseIds = new Set(enrolments.flatMap((item) => item.course_id ? [item.course_id] : []))
  const subProgrammeParents = new Map(subProgrammes.map((item) => [item.id, item.programme_id]))

  return courses.filter((course) => courseIds.has(course.id)
    || Boolean(course.programme_id && programmeIds.has(course.programme_id))
    || Boolean(course.sub_programme_id && subProgrammeIds.has(course.sub_programme_id))
    || Boolean(course.sub_programme_id && programmeIds.has(subProgrammeParents.get(course.sub_programme_id) || '')))
}
