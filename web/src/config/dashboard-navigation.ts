export type DashboardCapabilities = {
  isAdmin: boolean
  isTutor: boolean
  setupRequired?: boolean
  organisationType?: 'centre' | 'independent'
}

export type DashboardArea = 'home' | 'classes' | 'calendar' | 'mocks' | 'centre'
export type DashboardAccess = 'all' | 'admin' | 'tutor' | 'shared'

export type DashboardNavItem = {
  label: string
  href: string
  icon: string
  area: DashboardArea
  access: DashboardAccess
  keywords: string[]
  badge?: 'ungradedMocks'
}

export type DashboardWorkspace = {
  label: string
  href: string
  icon: string
  area: DashboardArea
  access: DashboardAccess
}

export const dashboardWorkspaces: DashboardWorkspace[] = [
  { label: 'Home', href: '/dashboard', icon: 'space_dashboard', area: 'home', access: 'all' },
  { label: 'Classes', href: '/dashboard/classes', icon: 'library_books', area: 'classes', access: 'shared' },
  { label: 'Calendar', href: '/dashboard/schedule', icon: 'calendar_month', area: 'calendar', access: 'shared' },
  { label: 'Settings', href: '/dashboard/settings', icon: 'settings', area: 'centre', access: 'admin' },
]

export const dashboardNavItems: DashboardNavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'space_dashboard', area: 'home', access: 'all', keywords: ['home', 'overview'] },
  { label: 'Settings', href: '/dashboard/settings', icon: 'settings', area: 'centre', access: 'admin', keywords: ['settings', 'centre', 'school', 'branding', 'profile'] },
  { label: 'School Setup', href: '/dashboard/school-setup', icon: 'settings_applications', area: 'centre', access: 'admin', keywords: ['school', 'identity', 'branding', 'setup'] },
  { label: 'Tutors', href: '/dashboard/tutors', icon: 'groups_3', area: 'centre', access: 'admin', keywords: ['tutors', 'teachers', 'invites', 'directory'] },
  { label: 'Students', href: '/dashboard/students', icon: 'face', area: 'centre', access: 'admin', keywords: ['students', 'learners', 'roster', 'enrolments'] },
  { label: 'Payments', href: '/dashboard/payments', icon: 'payments', area: 'centre', access: 'admin', keywords: ['payments', 'revenue', 'payouts', 'financials'] },
  { label: 'Classes', href: '/dashboard/classes', icon: 'library_books', area: 'classes', access: 'shared', keywords: ['classes', 'subjects', 'curriculum'] },
  { label: 'Calendar', href: '/dashboard/schedule', icon: 'calendar_month', area: 'calendar', access: 'shared', keywords: ['schedule', 'calendar', 'sessions'] },
  { label: 'Timetable', href: '/dashboard/timetable', icon: 'calendar_view_week', area: 'centre', access: 'admin', keywords: ['timetable', 'recurring', 'weekly', 'sessions'] },
  { label: 'Mocks', href: '/dashboard/mocks', icon: 'quiz', area: 'mocks', access: 'shared', keywords: ['assessments', 'mocks', 'exams', 'tests', 'grading'], badge: 'ungradedMocks' },
  { label: 'Question Banks', href: '/dashboard/question-banks', icon: 'inventory_2', area: 'mocks', access: 'shared', keywords: ['questions', 'banks', 'mocks', 'reuse', 'import'] },
  { label: 'Materials', href: '/dashboard/notes', icon: 'description', area: 'classes', access: 'tutor', keywords: ['notes', 'materials', 'teaching'] },
  { label: 'Assignments', href: '/dashboard/assignments', icon: 'assignment', area: 'mocks', access: 'tutor', keywords: ['assignments', 'tasks', 'submissions', 'grading'] },
]

export function canAccessDashboardItem(item: Pick<DashboardNavItem, 'access'>, capabilities: DashboardCapabilities) {
  if (item.access === 'all') return capabilities.isAdmin || capabilities.isTutor
  if (item.access === 'admin') return capabilities.isAdmin
  if (item.access === 'tutor') return capabilities.isTutor
  return capabilities.isAdmin || capabilities.isTutor
}

export function getDashboardNavItems(capabilities: DashboardCapabilities) {
  return dashboardNavItems.filter((item) => {
    if (!canAccessDashboardItem(item, capabilities)) return false
    if (capabilities.organisationType !== 'independent') return true
    return item.href !== '/dashboard/timetable' && item.href !== '/dashboard/tutors'
  })
}

export function getDashboardWorkspaces(capabilities: DashboardCapabilities) {
  // A new centre admin has exactly one available task. Showing the usual tabs
  // only to redirect every tap back here makes the mobile navigation feel
  // broken, so represent setup as its own truthful destination.
  if (capabilities.setupRequired) {
    return [{ label: 'Set up centre', href: '/dashboard/school-setup', icon: 'storefront', area: 'centre' as const, access: 'admin' as const }]
  }
  return dashboardWorkspaces.filter((workspace) => canAccessDashboardItem(workspace, capabilities))
}

export function getDashboardWorkspaceForPath(pathname: string) {
  const item = dashboardNavItems
    .filter((candidate) => pathname === candidate.href || (candidate.href !== '/dashboard' && pathname.startsWith(`${candidate.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]
  return item?.area || (pathname === '/dashboard' ? 'home' : null)
}

export function getDashboardAccess(pathname: string): DashboardAccess | null {
  const item = dashboardNavItems
    .filter((candidate) => pathname === candidate.href || (candidate.href !== '/dashboard' && pathname.startsWith(`${candidate.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]

  return item?.access ?? null
}

export function canAccessDashboardPath(pathname: string, capabilities: DashboardCapabilities) {
  if (capabilities.setupRequired) {
    return pathname === '/dashboard/school-setup'
  }
  if (capabilities.organisationType === 'independent' && (
    pathname === '/dashboard/timetable' || pathname.startsWith('/dashboard/timetable/') ||
    pathname === '/dashboard/tutors' || pathname.startsWith('/dashboard/tutors/')
  )) return false
  const access = getDashboardAccess(pathname)
  if (!access) return true
  if (access === 'all') return capabilities.isAdmin || capabilities.isTutor
  if (access === 'admin') return capabilities.isAdmin
  if (access === 'tutor') return capabilities.isTutor
  return capabilities.isAdmin || capabilities.isTutor
}
