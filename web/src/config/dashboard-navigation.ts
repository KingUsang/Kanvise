export type DashboardCapabilities = {
  isAdmin: boolean
  isTutor: boolean
  setupRequired?: boolean
  organisationType?: 'centre' | 'independent'
}

export type DashboardAccess = 'all' | 'admin' | 'tutor' | 'shared'

/** Group labels from 01-app-shell SH-02 item 4. `top` is the ungrouped section. */
export type DashboardNavGroupId = 'top' | 'people' | 'work' | 'library' | 'account'

/** Icon names; the shell maps them to Lucide outline icons. */
export type DashboardNavIcon =
  | 'dashboard' | 'calendar' | 'timetable' | 'courses' | 'students' | 'tutors'
  | 'homework' | 'quizzes' | 'questionBanks' | 'resources' | 'settings' | 'payments' | 'setup'

/** Phone bottom bar areas (R-02). Everything else lives behind More. */
export type BottomBarArea = 'today' | 'calendar' | 'students' | 'more'

export type DashboardNavItem = {
  label: string
  href: string
  icon: DashboardNavIcon
  group: DashboardNavGroupId
  access: DashboardAccess
  /** Hidden for independent tutors (agency-only pages). */
  agencyOnly?: boolean
  keywords: string[]
  /** "Something needs you" count (SH-02). Never a total. */
  badge?: 'ungradedQuizzes'
}

export type DashboardNavGroup = {
  id: DashboardNavGroupId
  /** Small-caps label; the top section has none. */
  label: string | null
  items: DashboardNavItem[]
}

export const dashboardNavGroupLabels: Record<DashboardNavGroupId, string | null> = {
  top: null,
  people: 'People',
  work: 'Work',
  library: 'Library',
  account: 'Account',
}

/*
 * Build step 1 navigation (01-app-shell SH-02 item 4). Each spec item maps to
 * the page that exists on this branch, with today's access rules. Items whose
 * screens ship in a later build step are HIDDEN, not disabled (HANDOFF.md
 * "Build order"): nothing links to them.
 *
 * | Spec item  | Step 1 target            | Shown to                                         |
 * |------------|--------------------------|--------------------------------------------------|
 * | Setup      | HIDDEN (step 2)          |                                                  |
 * | Dashboard  | /dashboard               | all staff                                        |
 * | Calendar   | /dashboard/schedule      | shared                                           |
 * | Lessons    | HIDDEN (step 4)          | no lessons list yet                              |
 * | Courses    | /dashboard/classes       | shared (replaced in step 4)                      |
 * | Students   | /dashboard/students      | admins only, as today (tutor list in step 3)     |
 * | Tutors     | /dashboard/tutors        | agency admins only, as today                     |
 * | Team       | HIDDEN (step 3)          |                                                  |
 * | Homework   | /dashboard/assignments   | tutor access, as today                           |
 * | Quizzes    | /dashboard/mocks         | shared; badge = quizzes waiting to be marked     |
 * | Question banks | /dashboard/question-banks | transitional, WORK, shared (retires in step 7) |
 * | Recordings | HIDDEN (step 5)          |                                                  |
 * | Resources  | /dashboard/notes         | tutor access, as today                           |
 * | Settings   | /dashboard/settings      | access as today (admins)                         |
 * | Payments   | /dashboard/payments      | transitional, ACCOUNT, admins (payments on hold) |
 * | Timetable  | /dashboard/timetable     | transitional, agency admins (merges into Calendar in step 4) |
 *
 * Profile (/dashboard/profile, from the account menu) and tutoring agency
 * setup stay reachable as today through dashboardRouteRules.
 */
export const dashboardNavItems: DashboardNavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'dashboard', group: 'top', access: 'all', keywords: ['home', 'overview', 'today'] },
  { label: 'Calendar', href: '/dashboard/schedule', icon: 'calendar', group: 'top', access: 'shared', keywords: ['schedule', 'calendar', 'lessons'] },
  { label: 'Timetable', href: '/dashboard/timetable', icon: 'timetable', group: 'top', access: 'admin', agencyOnly: true, keywords: ['timetable', 'recurring', 'weekly'] },
  { label: 'Courses', href: '/dashboard/classes', icon: 'courses', group: 'top', access: 'shared', keywords: ['courses', 'subjects'] },
  { label: 'Students', href: '/dashboard/students', icon: 'students', group: 'people', access: 'admin', keywords: ['students', 'enrolments', 'invitations'] },
  { label: 'Tutors', href: '/dashboard/tutors', icon: 'tutors', group: 'people', access: 'admin', agencyOnly: true, keywords: ['tutors', 'invites'] },
  { label: 'Homework', href: '/dashboard/assignments', icon: 'homework', group: 'work', access: 'tutor', keywords: ['homework', 'submissions', 'marking'] },
  { label: 'Quizzes', href: '/dashboard/mocks', icon: 'quizzes', group: 'work', access: 'shared', keywords: ['quizzes', 'tests', 'marking'], badge: 'ungradedQuizzes' },
  // transitional: question banks retire in step 7 (14-old-flows-inventory)
  { label: 'Question banks', href: '/dashboard/question-banks', icon: 'questionBanks', group: 'work', access: 'shared', keywords: ['question banks', 'questions'] },
  { label: 'Resources', href: '/dashboard/notes', icon: 'resources', group: 'library', access: 'tutor', keywords: ['resources', 'notes', 'materials'] },
  { label: 'Settings', href: '/dashboard/settings', icon: 'settings', group: 'account', access: 'admin', keywords: ['settings', 'branding'] },
  { label: 'Payments', href: '/dashboard/payments', icon: 'payments', group: 'account', access: 'admin', keywords: ['payments', 'payouts'] },
]

/** The only item a new agency admin sees until the agency exists. */
export const setupNavItem: DashboardNavItem = {
  label: 'Set up tutoring agency',
  href: '/dashboard/school-setup',
  icon: 'setup',
  group: 'top',
  access: 'admin',
  keywords: ['setup', 'agency'],
}

type RouteRule = { href: string; access: DashboardAccess; agencyOnly?: boolean; title: string }

/** Access rules and phone titles for every staff route, linked or not. */
export const dashboardRouteRules: RouteRule[] = [
  ...dashboardNavItems.map(({ href, access, agencyOnly, label }) => ({ href, access, agencyOnly, title: label })),
  { href: '/dashboard/profile', access: 'shared', title: 'My profile' },
  { href: '/dashboard/school-setup', access: 'admin', title: 'Set up tutoring agency' },
]

function matchRule(pathname: string) {
  return dashboardRouteRules
    .filter((rule) => pathname === rule.href || (rule.href !== '/dashboard' && pathname.startsWith(`${rule.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]
}

function hasAccess(access: DashboardAccess, capabilities: DashboardCapabilities) {
  if (access === 'admin') return capabilities.isAdmin
  if (access === 'tutor') return capabilities.isTutor
  return capabilities.isAdmin || capabilities.isTutor
}

export function canAccessDashboardItem(item: Pick<DashboardNavItem, 'access' | 'agencyOnly'>, capabilities: DashboardCapabilities) {
  if (item.agencyOnly && capabilities.organisationType === 'independent') return false
  return hasAccess(item.access, capabilities)
}

export function getDashboardNavItems(capabilities: DashboardCapabilities) {
  if (capabilities.setupRequired) return [setupNavItem]
  return dashboardNavItems.filter((item) => canAccessDashboardItem(item, capabilities))
}

/** Visible items in SH-02 groups. A group with no visible items is left out. */
export function getDashboardNavGroups(capabilities: DashboardCapabilities): DashboardNavGroup[] {
  const items = getDashboardNavItems(capabilities)
  return (Object.keys(dashboardNavGroupLabels) as DashboardNavGroupId[])
    .map((id) => ({ id, label: dashboardNavGroupLabels[id], items: items.filter((item) => item.group === id) }))
    .filter((group) => group.items.length > 0)
}

export type BottomBarTab = { area: BottomBarArea; label: string; href?: string; icon: DashboardNavIcon | 'more' }

/**
 * Phone bottom bar (R-02): Today, Calendar, Students (when the person sees
 * the Students item), More. Lessons is hidden until build step 4.
 */
export function getBottomBarTabs(capabilities: DashboardCapabilities): BottomBarTab[] {
  if (capabilities.setupRequired) return [{ area: 'today', label: setupNavItem.label, href: setupNavItem.href, icon: 'setup' }]
  const visible = new Set(getDashboardNavItems(capabilities).map((item) => item.href))
  const tabs: BottomBarTab[] = [{ area: 'today', label: 'Today', href: '/dashboard', icon: 'dashboard' }]
  if (visible.has('/dashboard/schedule')) tabs.push({ area: 'calendar', label: 'Calendar', href: '/dashboard/schedule', icon: 'calendar' })
  if (visible.has('/dashboard/students')) tabs.push({ area: 'students', label: 'Students', href: '/dashboard/students', icon: 'students' })
  tabs.push({ area: 'more', label: 'More', icon: 'more' })
  return tabs
}

/** Which bottom bar tab a page belongs to. Pages without a tab belong to More. */
export function getBottomBarArea(pathname: string): BottomBarArea {
  if (pathname === '/dashboard' || pathname === '/dashboard/school-setup') return 'today'
  if (pathname === '/dashboard/schedule' || pathname.startsWith('/dashboard/schedule/')) return 'calendar'
  if (pathname === '/dashboard/students' || pathname.startsWith('/dashboard/students/')) return 'students'
  return 'more'
}

/** Title for the phone top bar. On the dashboard it reads Today (SH-16). */
export function getDashboardPageTitle(pathname: string) {
  if (pathname === '/dashboard') return 'Today'
  return matchRule(pathname)?.title ?? 'Kanvise'
}

export function isActiveNavHref(pathname: string, href: string) {
  return pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`))
}

export function getDashboardAccess(pathname: string): DashboardAccess | null {
  return matchRule(pathname)?.access ?? null
}

export function canAccessDashboardPath(pathname: string, capabilities: DashboardCapabilities) {
  if (capabilities.setupRequired) {
    return pathname === '/dashboard/school-setup'
  }
  const rule = matchRule(pathname)
  if (!rule) return true
  return canAccessDashboardItem(rule, capabilities)
}

/**
 * Why a page is not available, for the Not available page (SH-14a): `admin`
 * when only admins may use it and this person is not one.
 */
export function deniedReason(pathname: string, capabilities: DashboardCapabilities): 'admin' | 'unavailable' {
  const rule = matchRule(pathname)
  if (rule?.access === 'admin' && !capabilities.isAdmin && !(rule.agencyOnly && capabilities.organisationType === 'independent')) return 'admin'
  return 'unavailable'
}
