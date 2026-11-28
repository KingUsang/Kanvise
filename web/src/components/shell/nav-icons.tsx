import {
  BadgeQuestionMark,
  BookMarked,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  Ellipsis,
  Folder,
  GraduationCap,
  House,
  Library,
  Rocket,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { DashboardNavIcon } from '@/config/dashboard-navigation'

/** Lucide outline icons for the nav (standard 07, SH-02, SH-05 entity icons). */
export const navIcons: Record<DashboardNavIcon | 'more', LucideIcon> = {
  dashboard: House,
  calendar: CalendarDays,
  timetable: CalendarRange,
  courses: BookMarked,
  students: GraduationCap,
  tutors: Users,
  homework: ClipboardCheck,
  quizzes: BadgeQuestionMark,
  questionBanks: Library,
  resources: Folder,
  settings: Settings,
  payments: Wallet,
  setup: Rocket,
  more: Ellipsis,
}
