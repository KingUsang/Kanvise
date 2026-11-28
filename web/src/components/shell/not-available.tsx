'use client'

import { EyeOff, ShieldCheck } from 'lucide-react'
import { LinkButton } from '@/components/dashboard/action-controls'
import { useShellChrome } from './shell-context'

/**
 * Not available (SH-14a): one page, inside the normal shell, for anything
 * the person cannot open. Deleted, never existed and someone else's look the
 * same, so the page never reveals that something exists.
 */
export function NotAvailable({ reason = 'unavailable', independent }: {
  /** `admin` for routes only admins may use. */
  reason?: 'admin' | 'unavailable'
  /** Independent tutors have no admin to ask. Read from the shell when omitted. */
  independent?: boolean
}) {
  const shell = useShellChrome()
  const isIndependent = independent ?? shell?.capabilities.organisationType === 'independent'
  const Icon = reason === 'admin' ? ShieldCheck : EyeOff
  return (
    <section className="mx-auto flex max-w-md flex-col items-center px-2 py-16 text-center md:py-24">
      <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-dashboard-surface-subtle text-dashboard-muted">
        <Icon className="size-6" />
      </span>
      <h1 className="mt-5 text-dashboard-page-title font-bold text-dashboard-foreground">
        {reason === 'admin' ? 'This page is for admins' : "We can't show this page"}
      </h1>
      <p className="mt-2 text-dashboard-small leading-6 text-dashboard-muted">
        It may have been removed, or it belongs to someone else.
        {isIndependent ? null : ' If you think you should see it, ask your admin.'}
      </p>
      <LinkButton href="/dashboard" className="mt-6">Go to dashboard</LinkButton>
    </section>
  )
}
