import { supabase } from './supabase'

/*
 * Global search for the staff app shell (01-app-shell SH-05). Only entity
 * types whose pages exist on this branch are searched, and every group is
 * scoped to the active account and to what the caller may open:
 *
 * | Group    | Who                | Opens                        |
 * |----------|--------------------|------------------------------|
 * | Students | admins             | /dashboard/students          |
 * | Tutors   | agency admins      | /dashboard/tutors            |
 * | Courses  | admins, tutors     | /dashboard/classes/{id}      |
 * | Lessons  | admins, tutors     | /dashboard/schedule/{id}     |
 *
 * Tutors only find the Courses they teach and their own Lessons. The
 * Students and Tutors pages take no filter yet, so their results open the
 * list.
 */

export const SEARCH_MIN_LENGTH = 2
export const SEARCH_MAX_LENGTH = 100
export const SEARCH_GROUP_LIMIT = 5

export type SearchType = 'student' | 'tutor' | 'course' | 'lesson'
export type SearchLessonStatus = 'planned' | 'starting-soon' | 'live' | 'complete'

export type SearchResult = {
  id: string
  type: SearchType
  name: string
  detail: string | null
  href: string
  status?: SearchLessonStatus
  scheduled_at?: string
}

export type SearchGroup = { type: SearchType; label: string; results: SearchResult[] }

export type SearchCaller = {
  personId: string
  accountId: string
  role: 'admin' | 'tutor'
  timezone: string
}

const groupLabels: Record<SearchType, string> = {
  student: 'Students',
  tutor: 'Tutors',
  course: 'Courses',
  lesson: 'Lessons',
}

/** The classroom opens 15 minutes before a lesson (CFG-L default, SH-15). */
const CLASSROOM_OPENS_MS = 15 * 60_000

/**
 * Turns the typed text into an ILIKE "contains" pattern that matches it
 * literally. `%`, `_` and `\` are escaped; PostgREST also reads `*` as `%`,
 * which cannot be escaped, so it becomes a single-character wildcard.
 */
export function containsPattern(term: string) {
  const escaped = term.replace(/[\\%_]/g, (character) => `\\${character}`).replace(/\*/g, '_')
  return `%${escaped}%`
}

/** Trimmed search text, or null when it is too short or too long to search. */
export function normaliseSearchTerm(raw: unknown) {
  if (typeof raw !== 'string') return null
  const term = raw.trim().replace(/\s+/g, ' ')
  if (term.length < SEARCH_MIN_LENGTH || term.length > SEARCH_MAX_LENGTH) return null
  return term
}

function fullName(row: { first_name?: string | null; last_name?: string | null }) {
  return [row.first_name, row.last_name].map((part) => (part || '').trim()).filter(Boolean).join(' ')
}

function rethrow<T>(result: { data: T | null; error: unknown }) {
  if (result.error) throw result.error
  return result.data
}

type PersonRow = { id: string; first_name: string | null; last_name: string | null; email: string | null; created_at?: string }

/**
 * People in one account with a role, matched on first name, last name, email
 * and "first last". Separate parameterised filters keep typed text out of
 * PostgREST `or()` strings.
 */
async function searchPeople(accountId: string, role: 'student' | 'tutor', term: string) {
  const pattern = containsPattern(term)
  const base = () => supabase.from('user_profiles')
    .select('id, first_name, last_name, email, created_at')
    .eq('school_id', accountId)
    .eq('role', role)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(SEARCH_GROUP_LIMIT)
  const queries = [
    base().ilike('first_name', pattern),
    base().ilike('last_name', pattern),
    base().ilike('email', pattern),
  ]
  const space = term.indexOf(' ')
  if (space > 0) {
    queries.push(base()
      .ilike('first_name', containsPattern(term.slice(0, space)))
      .ilike('last_name', containsPattern(term.slice(space + 1))))
  }
  const results = await Promise.all(queries)
  const seen = new Map<string, PersonRow>()
  for (const result of results) {
    for (const row of (rethrow(result) || []) as PersonRow[]) {
      if (!seen.has(row.id)) seen.set(row.id, row)
    }
  }
  return [...seen.values()].slice(0, SEARCH_GROUP_LIMIT)
}

async function searchStudents(caller: SearchCaller, term: string): Promise<SearchResult[]> {
  const rows = await searchPeople(caller.accountId, 'student', term)
  return rows.map((row) => ({
    id: row.id,
    type: 'student',
    name: fullName(row) || row.email || 'Student',
    detail: row.email || 'No email',
    href: '/dashboard/students',
  }))
}

async function searchTutors(caller: SearchCaller, term: string): Promise<SearchResult[]> {
  const rows = await searchPeople(caller.accountId, 'tutor', term)
  return rows.map((row) => ({
    id: row.id,
    type: 'tutor',
    name: fullName(row) || row.email || 'Tutor',
    detail: row.email || 'No email',
    href: '/dashboard/tutors',
  }))
}

/**
 * The Course containers (programmes) a tutor teaches in: the same rule as
 * GET /classes, which shows a tutor only Courses with a subject assigned to
 * them. Returns null for admins, who see every Course in the account.
 */
async function tutorCourseIds(caller: SearchCaller) {
  if (caller.role !== 'tutor') return null
  const assignments = rethrow(await supabase.from('tutor_course_assignments')
    .select('course_id')
    .eq('school_id', caller.accountId)
    .eq('tutor_id', caller.personId)) as Array<{ course_id: string }> | null
  const subjectIds = [...new Set((assignments || []).map((row) => row.course_id))]
  if (!subjectIds.length) return []
  const subjects = rethrow(await supabase.from('courses')
    .select('id, programme_id, sub_programme_id')
    .eq('school_id', caller.accountId)
    .in('id', subjectIds)) as Array<{ programme_id: string | null; sub_programme_id: string | null }> | null
  const ids = new Set<string>()
  const subProgrammeIds = new Set<string>()
  for (const subject of subjects || []) {
    if (subject.programme_id) ids.add(subject.programme_id)
    if (subject.sub_programme_id) subProgrammeIds.add(subject.sub_programme_id)
  }
  if (subProgrammeIds.size) {
    const parents = rethrow(await supabase.from('sub_programmes')
      .select('id, programme_id')
      .eq('school_id', caller.accountId)
      .in('id', [...subProgrammeIds])) as Array<{ programme_id: string | null }> | null
    for (const parent of parents || []) if (parent.programme_id) ids.add(parent.programme_id)
  }
  return [...ids]
}

async function searchCourses(caller: SearchCaller, term: string): Promise<SearchResult[]> {
  const visibleIds = await tutorCourseIds(caller)
  if (visibleIds && !visibleIds.length) return []
  let query = supabase.from('programmes')
    .select('id, name')
    .eq('school_id', caller.accountId)
    .ilike('name', containsPattern(term))
  if (visibleIds) query = query.in('id', visibleIds)
  const rows = rethrow(await query.order('name', { ascending: true }).limit(SEARCH_GROUP_LIMIT)) as Array<{ id: string; name: string }> | null
  return (rows || []).map((row) => ({
    id: row.id,
    type: 'course',
    name: row.name,
    detail: null,
    href: `/dashboard/classes/${encodeURIComponent(row.id)}`,
  }))
}

type LessonRow = {
  id: string
  title: string | null
  scheduled_at: string
  duration_minutes: number | null
  status: string
  classroom_provider?: string | null
  provider_room_status?: string | null
  course?: { name: string | null } | Array<{ name: string | null }> | null
}

/**
 * The status chip for a lesson (SH-15). A stale "live" row is not shown as
 * Live unless its room is verified, matching GET /live-classes.
 */
export function lessonChipStatus(
  row: Pick<LessonRow, 'status' | 'scheduled_at' | 'classroom_provider' | 'provider_room_status'> & { duration_minutes?: number | null },
  now: Date,
): SearchLessonStatus {
  if (row.status === 'live') {
    const verified = row.classroom_provider !== 'plugnmeet' || row.provider_room_status === 'active'
    if (verified) return 'live'
  }
  if (['completed', 'ending', 'interrupted'].includes(row.status)) return 'complete'
  // Starting soon: the classroom has opened and the lesson time has not run out.
  const startsIn = Date.parse(row.scheduled_at) - now.getTime()
  const lasts = (row.duration_minutes || 60) * 60_000
  return startsIn <= CLASSROOM_OPENS_MS && startsIn > -lasts ? 'starting-soon' : 'planned'
}

function lessonDate(iso: string, timezone: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: timezone, day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
}

async function searchLessons(caller: SearchCaller, term: string, now: Date): Promise<SearchResult[]> {
  const nowIso = now.toISOString()
  const base = () => {
    let query = supabase.from('live_classes')
      .select('id, title, scheduled_at, duration_minutes, status, classroom_provider, provider_room_status, course:courses!live_classes_course_id_fkey(name)')
      .eq('school_id', caller.accountId)
      .neq('status', 'cancelled')
      .ilike('title', containsPattern(term))
    if (caller.role === 'tutor') query = query.eq('tutor_id', caller.personId)
    return query
  }
  // Upcoming lessons first, soonest first; then past lessons, newest first.
  const [upcoming, past] = await Promise.all([
    base().gte('scheduled_at', nowIso).order('scheduled_at', { ascending: true }).limit(SEARCH_GROUP_LIMIT),
    base().lt('scheduled_at', nowIso).order('scheduled_at', { ascending: false }).limit(SEARCH_GROUP_LIMIT),
  ])
  const rows = [...((rethrow(upcoming) || []) as LessonRow[]), ...((rethrow(past) || []) as LessonRow[])].slice(0, SEARCH_GROUP_LIMIT)
  return rows.map((row) => {
    const course = Array.isArray(row.course) ? row.course[0] : row.course
    const date = lessonDate(row.scheduled_at, caller.timezone)
    return {
      id: row.id,
      type: 'lesson',
      name: row.title?.trim() || 'Lesson',
      detail: course?.name ? `${course.name} · ${date}` : date,
      href: `/dashboard/schedule/${encodeURIComponent(row.id)}`,
      status: lessonChipStatus(row, now),
      scheduled_at: row.scheduled_at,
    }
  })
}

async function accountIsAgency(accountId: string) {
  const school = rethrow(await supabase.from('schools').select('account_type').eq('id', accountId).maybeSingle()) as { account_type?: string | null } | null
  return school?.account_type !== 'independent'
}

/** Groups with at least one result, in the order the palette shows them. */
export async function globalSearch(caller: SearchCaller, term: string, now = new Date()): Promise<SearchGroup[]> {
  const isAdmin = caller.role === 'admin'
  const [students, tutors, courses, lessons] = await Promise.all([
    isAdmin ? searchStudents(caller, term) : Promise.resolve([]),
    isAdmin ? accountIsAgency(caller.accountId).then((agency) => (agency ? searchTutors(caller, term) : [])) : Promise.resolve([]),
    searchCourses(caller, term),
    searchLessons(caller, term, now),
  ])
  const groups: Array<[SearchType, SearchResult[]]> = [['student', students], ['tutor', tutors], ['course', courses], ['lesson', lessons]]
  return groups
    .filter(([, results]) => results.length > 0)
    .map(([type, results]) => ({ type, label: groupLabels[type], results }))
}
