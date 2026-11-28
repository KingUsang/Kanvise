import { LogOut, Megaphone, MessageSquare, BookOpen, User } from 'lucide-react'
import type { MenuItem } from '@/components/ui/menu'

/** Name and email at the top of the account menu (SH-06). Not clickable. */
export function PersonHeader({ name, email }: { name: string; email: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-dashboard-small font-semibold text-dashboard-foreground">{name}</p>
      {email ? <p className="truncate text-dashboard-secondary text-dashboard-muted">{email}</p> : null}
    </div>
  )
}

export function accountMenuItems({ onSignOut, signingOut }: { onSignOut: () => void; signingOut: boolean }): MenuItem[] {
  return [
    // The spec's /profile ships with settings in build step 3; today's profile page is here.
    { label: 'My profile', href: '/dashboard/profile', icon: <User className="size-4" /> },
    { type: 'separator' },
    { label: signingOut ? 'Signing out…' : 'Sign out', onSelect: onSignOut, icon: <LogOut className="size-4" />, disabled: signingOut },
  ]
}

export function NewBadge() {
  return <span className="rounded-full bg-dashboard-info-surface px-2 py-0.5 text-dashboard-secondary font-semibold text-dashboard-info">New</span>
}

/** Help menu (SH-04). Help guide is hidden until the help site exists. */
export function helpMenuItems({ unread, helpUrl, onWhatsNew, onFeedback }: {
  unread: boolean
  helpUrl?: string
  onWhatsNew: () => void
  /** Left out when feedback can't be sent yet (no account during setup). */
  onFeedback?: () => void
}): MenuItem[] {
  const items: MenuItem[] = [
    { label: "What's new", onSelect: onWhatsNew, icon: <Megaphone className="size-4" />, detail: unread ? <NewBadge /> : undefined },
  ]
  if (helpUrl) items.push({ label: 'Help guide', href: helpUrl, external: true, icon: <BookOpen className="size-4" /> })
  if (onFeedback) items.push({ label: 'Share feedback', onSelect: onFeedback, icon: <MessageSquare className="size-4" /> })
  items.push({ type: 'separator' }, { label: 'Privacy policy', href: '/privacy', external: true, tone: 'subtle' })
  return items
}
