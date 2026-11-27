'use client'

import Link from 'next/link'
import { useDashboardSession } from '@/lib/dashboard-session'
import { productTerms } from '@/lib/product-terminology'

const accountItems = [
  { label: 'Teaching team', description: 'Invite tutors and manage subject assignments.', href: '/dashboard/tutors', icon: 'groups_3', accountOnly: true },
  { label: productTerms.learners, description: 'Manage learners, enrolments and invitations.', href: '/dashboard/students', icon: 'face' },
  { label: 'Payments', description: 'Review payments and payout details.', href: '/dashboard/payments', icon: 'payments' },
  { label: 'Timetable', description: `Manage your ${productTerms.tutoringAccount}'s recurring timetable.`, href: '/dashboard/timetable', icon: 'calendar_view_week', accountOnly: true },
  { label: 'Settings', description: `Update your ${productTerms.tutoringAccount} settings.`, href: '/dashboard/settings', icon: 'settings' },
]

export function MoreWorkspaceClient() {
  const query = useDashboardSession()
  if (query.isPending) return <div className="grid animate-pulse gap-3 sm:grid-cols-2" aria-busy="true" aria-label="Loading administration tools">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-28 rounded-2xl border border-dashboard-outline bg-white" />)}</div>
  if (query.isError || !query.data.capabilities.isAdmin) return <div className="rounded-2xl border border-[#f0c7c1] bg-white p-8 text-sm text-[#8d2f22]">These {productTerms.tutoringAccount} tools are available to administrators.</div>
  const independent = query.data.capabilities.organisationType === 'independent'
  const items = accountItems.filter(item => !item.accountOnly || !independent)

  return <div className="mx-auto w-full max-w-4xl">
    <header><p className="text-xs font-bold uppercase tracking-[.14em] text-dashboard-accent">Administration</p><h1 className="mt-2 break-words text-dashboard-page-title font-bold text-dashboard-foreground sm:text-dashboard-page-title-desktop">More</h1><p className="mt-2 text-sm text-dashboard-muted">Manage the people, money and settings behind your teaching.</p></header>
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      {items.map(item => <Link key={item.href} href={item.href} className="flex min-h-24 items-start gap-4 rounded-2xl border border-dashboard-outline bg-white p-5 shadow-dashboard-card transition hover:border-[#8e87bd] hover:bg-[#faf9ff]">
        <span className="material-symbols-outlined rounded-xl bg-[#eeecfa] p-2 text-[#2e2877]">{item.icon}</span>
        <span><strong className="block text-base text-[#27242d]">{item.label}</strong><span className="mt-1 block text-sm leading-5 text-dashboard-muted">{item.description}</span></span>
      </Link>)}
    </div>
  </div>
}
