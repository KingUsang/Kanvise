import type { DashboardCapabilities } from '@/config/dashboard-navigation'
import type { ChangelogEntry } from '@/content/changelog'

export type ShellAccount = {
  id: string
  name: string
  logoUrl?: string | null
  /** The person's role in that account. */
  role: 'admin' | 'tutor' | 'learner'
}

/**
 * Everything the shell shows, loaded by DashboardShell (or a fixture in the
 * design preview). The shell itself never fetches.
 */
export type ShellData = {
  person: { id: string; name: string; email: string; photoUrl: string | null }
  capabilities: DashboardCapabilities
  /** The selected account. Null before an agency exists (setup). */
  account: { id: string | null; name: string; logoUrl: string | null } | null
  /** Every account this person belongs to; the switcher shows with two or more. */
  accounts: ShellAccount[]
  /** "Needs you" counts. Null when unknown or failed: nothing is shown. */
  badges: { ungradedQuizzes: number | null }
  /** Capabilities still loading: the nav shows skeleton rows. */
  loading?: boolean
}

export type ShellActions = {
  switchAccount: (account: ShellAccount) => Promise<void>
  signOut: () => Promise<void>
  sendFeedback: (message: string) => Promise<void>
  getPendingUploadCount: () => Promise<number>
}

export type ShellLinks = {
  /** Help site; the Help guide item is hidden without it. */
  helpUrl?: string
  /** Full changelog; the link is hidden without it. */
  changelogUrl?: string
  changelog: ChangelogEntry[]
}

/** Overlays the design preview can open on first render. */
export type ShellOverlay =
  | 'more'
  | 'help'
  | 'account-menu'
  | 'switcher'
  | 'whats-new'
  | 'feedback'
  | 'sign-out-confirm'
  | 'phone-menu'
