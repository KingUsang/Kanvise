import {
  BadgeQuestionMark,
  BookOpen,
  BookMarked,
  ClipboardCheck,
  Folder,
  GraduationCap,
  Settings,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react'

/**
 * Entities from 01-app-shell SH-05. Kavi is reserved in the table but has no
 * mark yet, so it is deliberately not part of this type.
 */
export type Entity = 'student' | 'tutor' | 'course' | 'lesson' | 'homework' | 'quiz' | 'resource' | 'recording' | 'settings'

// Lucide 1.21 has no square with a question mark, so Quiz uses the closest
// outline shape, BadgeQuestionMark.
export const entityConfig: Record<Entity, { icon: LucideIcon; label: string; className: string }> = {
  student: { icon: GraduationCap, label: 'Student', className: 'bg-dashboard-entity-student-tint text-dashboard-entity-student' },
  tutor: { icon: Users, label: 'Tutor', className: 'bg-dashboard-entity-tutor-tint text-dashboard-entity-tutor' },
  course: { icon: BookMarked, label: 'Course', className: 'bg-dashboard-entity-course-tint text-dashboard-entity-course' },
  lesson: { icon: BookOpen, label: 'Lesson', className: 'bg-dashboard-entity-lesson-tint text-dashboard-entity-lesson' },
  homework: { icon: ClipboardCheck, label: 'Homework', className: 'bg-dashboard-entity-homework-tint text-dashboard-entity-homework' },
  quiz: { icon: BadgeQuestionMark, label: 'Quiz', className: 'bg-dashboard-entity-quiz-tint text-dashboard-entity-quiz' },
  resource: { icon: Folder, label: 'Resource', className: 'bg-dashboard-entity-resource-tint text-dashboard-entity-resource' },
  recording: { icon: Video, label: 'Recording', className: 'bg-dashboard-entity-recording-tint text-dashboard-entity-recording' },
  settings: { icon: Settings, label: 'Settings', className: 'bg-dashboard-entity-settings-tint text-dashboard-entity-settings' },
}

const sizeClasses = {
  sm: { circle: 'size-8', icon: 'size-4' },
  md: { circle: 'size-10', icon: 'size-5' },
  lg: { circle: 'size-14', icon: 'size-7' },
} as const

/**
 * Entity icon in its tinted circle. Decorative by default; pass `label` when
 * the icon is the only thing that names the entity.
 */
export function EntityIcon({ entity, size = 'md', label, className = '' }: {
  entity: Entity
  size?: keyof typeof sizeClasses
  label?: string
  className?: string
}) {
  const config = entityConfig[entity]
  const Icon = config.icon
  return (
    <span
      data-entity={entity}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${sizeClasses[size].circle} ${config.className} ${className}`.trim()}
    >
      <Icon aria-hidden="true" className={sizeClasses[size].icon} strokeWidth={1.75} />
    </span>
  )
}
