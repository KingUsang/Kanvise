/** Named course colours; values live in globals.css (--dashboard-course-*). */
export const courseColors = ['indigo', 'teal', 'purple', 'pink', 'amber', 'green', 'blue', 'slate'] as const
export type CourseColor = (typeof courseColors)[number]

const colorClasses: Record<CourseColor, string> = {
  indigo: 'bg-dashboard-course-indigo',
  teal: 'bg-dashboard-course-teal',
  purple: 'bg-dashboard-course-purple',
  pink: 'bg-dashboard-course-pink',
  amber: 'bg-dashboard-course-amber',
  green: 'bg-dashboard-course-green',
  blue: 'bg-dashboard-course-blue',
  slate: 'bg-dashboard-course-slate',
}

const sizeClasses = { sm: 'size-3 rounded-[3px]', md: 'size-4 rounded', lg: 'size-8 rounded-dashboard-control' } as const

/** Pick a stable colour for a course that has none stored yet. */
export function courseColorFor(seed: string): CourseColor {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return courseColors[hash % courseColors.length]
}

/**
 * A course's own colour as a small rounded square, never a round dot, so it
 * cannot be mistaken for a status dot (SH-15). Decorative: the course name
 * always appears next to it.
 */
export function CourseSwatch({ color, size = 'md', className = '' }: { color: CourseColor; size?: keyof typeof sizeClasses; className?: string }) {
  return <span aria-hidden="true" data-course-color={color} className={`inline-block shrink-0 ${sizeClasses[size]} ${colorClasses[color]} ${className}`.trim()} />
}
