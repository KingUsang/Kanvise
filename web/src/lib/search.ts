import { getApiUrl } from '@/config/api'
import { getDashboardNavItems, type DashboardCapabilities } from '@/config/dashboard-navigation'
import type { Entity } from '@/components/ui/entity-icon'
import type { LessonStatus } from '@/components/ui/status-chip'
import { apiRequest } from '@/lib/api-request'

/** Result types GET /search returns in build step 1 (SH-05). */
export type SearchType = 'student' | 'tutor' | 'course' | 'lesson'

export type SearchResult = {
  id: string
  type: SearchType
  name: string
  detail: string | null
  href: string
  status?: LessonStatus
  scheduled_at?: string
}

export type SearchGroup = { type: SearchType; label: string; results: SearchResult[] }
export type SearchResponse = { query: string; groups: SearchGroup[] }

/** Older responses are ignored by the caller, so requests are not aborted (an abort would be reported as a network failure). */
export type SearchFunction = (query: string) => Promise<SearchResponse>

export const SEARCH_MIN_LENGTH = 2
export const SEARCH_DEBOUNCE_MS = 200

/** GET /search through the shared client. The API filters by account and role. */
export const fetchSearch: SearchFunction = async (query) => {
  const params = new URLSearchParams({ q: query })
  try {
    params.set('tz', Intl.DateTimeFormat().resolvedOptions().timeZone)
  } catch {
    // The API falls back to its default timezone.
  }
  const body = await apiRequest<{ data: SearchResponse }>(
    `${getApiUrl()}/search?${params.toString()}`,
    "We couldn't search right now.",
  )
  return { query: body.data?.query ?? query, groups: Array.isArray(body.data?.groups) ? body.data.groups : [] }
}

export type BrowseType = { entity: Entity; label: string; href: string }

// SH-05 order. Lessons are left out until build step 4 adds a lessons list.
const browseOrder: BrowseType[] = [
  { entity: 'student', label: 'Students', href: '/dashboard/students' },
  { entity: 'tutor', label: 'Tutors', href: '/dashboard/tutors' },
  { entity: 'course', label: 'Courses', href: '/dashboard/classes' },
  { entity: 'homework', label: 'Homework', href: '/dashboard/assignments' },
  { entity: 'quiz', label: 'Quizzes', href: '/dashboard/mocks' },
  { entity: 'resource', label: 'Resources', href: '/dashboard/notes' },
  { entity: 'settings', label: 'Settings', href: '/dashboard/settings' },
]

/** "Browse by type": only types whose list page this person sees in the navigation. */
export function getBrowseTypes(capabilities: DashboardCapabilities): BrowseType[] {
  const visible = new Set(getDashboardNavItems(capabilities).map((item) => item.href))
  return browseOrder.filter((type) => visible.has(type.href))
}

export const searchEntity: Record<SearchType, Entity> = {
  student: 'student',
  tutor: 'tutor',
  course: 'course',
  lesson: 'lesson',
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Splits text into plain and matched parts, matching each typed word, any case. */
export function highlightParts(text: string, query: string): Array<{ text: string; match: boolean }> {
  const words = query.trim().split(/\s+/).filter(Boolean).sort((a, b) => b.length - a.length)
  if (!words.length || !text) return [{ text, match: false }]
  const pattern = new RegExp(`(${words.map(escapeRegExp).join('|')})`, 'gi')
  return text.split(pattern).filter(Boolean).map((part) => ({ text: part, match: words.some((word) => word.toLowerCase() === part.toLowerCase()) }))
}

export function resultCountMessage(count: number) {
  return count === 1 ? '1 result' : `${count} results`
}

/** "⌘K" on Apple devices, "Ctrl K" elsewhere (SH-02 item 2). */
export function shortcutHint(platform: string) {
  return /Mac|iPhone|iPad|iPod/i.test(platform) ? '⌘K' : 'Ctrl K'
}
