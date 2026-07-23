export type DashboardCapabilities = {
  isAdmin: boolean
  isTutor: boolean
}

export type DashboardArea = 'overview' | 'administration' | 'shared' | 'teaching'
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

export const dashboardNavItems: DashboardNavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'space_dashboard', area: 'overview', access: 'all', keywords: ['home', 'overview'] },
  { label: 'School Setup', href: '/dashboard/school-setup', icon: 'settings_applications', area: 'administration', access: 'admin', keywords: ['school', 'identity', 'branding', 'setup'] },
  { label: 'Programmes', href: '/dashboard/programmes', icon: 'library_books', area: 'administration', access: 'admin', keywords: ['programmes', 'courses', 'curriculum'] },
  { label: 'Tutors', href: '/dashboard/tutors', icon: 'groups_3', area: 'administration', access: 'admin', keywords: ['tutors', 'teachers', 'invites', 'directory'] },
  { label: 'Students', href: '/dashboard/students', icon: 'face', area: 'administration', access: 'admin', keywords: ['students', 'learners', 'roster', 'enrolments'] },
  { label: 'Payments', href: '/dashboard/payments', icon: 'payments', area: 'administration', access: 'admin', keywords: ['payments', 'revenue', 'payouts', 'financials'] },
  { label: 'Schedule', href: '/dashboard/schedule', icon: 'calendar_month', area: 'shared', access: 'shared', keywords: ['schedule', 'calendar', 'classes', 'sessions'] },
  { label: 'Attendance', href: '/dashboard/attendance', icon: 'fact_check', area: 'shared', access: 'shared', keywords: ['attendance', 'participation', 'sessions'] },
  { label: 'Mocks', href: '/dashboard/mocks', icon: 'quiz', area: 'shared', access: 'shared', keywords: ['mocks', 'exams', 'tests', 'grading'], badge: 'ungradedMocks' },
  { label: 'Question Banks', href: '/dashboard/question-banks', icon: 'inventory_2', area: 'shared', access: 'shared', keywords: ['questions', 'banks', 'mocks', 'reuse', 'import'] },
  { label: 'Notes', href: '/dashboard/notes', icon: 'description', area: 'teaching', access: 'tutor', keywords: ['notes', 'materials', 'teaching'] },
  { label: 'Assignments', href: '/dashboard/assignments', icon: 'assignment', area: 'teaching', access: 'tutor', keywords: ['assignments', 'tasks', 'submissions', 'grading'] },
]

export function canAccessDashboardItem(item: DashboardNavItem, capabilities: DashboardCapabilities) {
  if (item.access === 'all') return capabilities.isAdmin || capabilities.isTutor
  if (item.access === 'admin') return capabilities.isAdmin
  if (item.access === 'tutor') return capabilities.isTutor
  return capabilities.isAdmin || capabilities.isTutor
}

export function getDashboardNavItems(capabilities: DashboardCapabilities) {
  return dashboardNavItems.filter((item) => canAccessDashboardItem(item, capabilities))
}

export function getDashboardAccess(pathname: string): DashboardAccess | null {
  const item = dashboardNavItems
    .filter((candidate) => pathname === candidate.href || pathname.startsWith(`${candidate.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]

  return item?.access ?? null
}

export function canAccessDashboardPath(pathname: string, capabilities: DashboardCapabilities) {
  const access = getDashboardAccess(pathname)
  if (!access) return true
  if (access === 'all') return capabilities.isAdmin || capabilities.isTutor
  if (access === 'admin') return capabilities.isAdmin
  if (access === 'tutor') return capabilities.isTutor
  return capabilities.isAdmin || capabilities.isTutor
}
