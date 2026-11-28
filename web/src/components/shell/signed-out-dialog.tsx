'use client'

import { LogIn } from 'lucide-react'
import { LinkButton } from '@/components/dashboard/action-controls'
import { Dialog, useDialogIds } from '@/components/ui/dialog'

/**
 * Signed out while working (SH-14b). The page stays on screen behind this
 * dialog. It cannot be dismissed: the only way on is to sign in again, which
 * returns to the same page.
 */
export function SignedOutDialog({ open, signInHref }: { open: boolean; signInHref: string }) {
  const { titleId, descriptionId } = useDialogIds()
  if (!open) return null
  return (
    <Dialog
      role="alertdialog"
      layout="signed-out"
      labelledBy={titleId}
      describedBy={descriptionId}
      dismissOnBackdrop={false}
      className="animate-dashboard-scrim-in fixed inset-0 z-[99999] flex items-center justify-center bg-dashboard-scrim p-4 backdrop-blur-sm"
      panelClassName="animate-dashboard-dialog-in w-full min-w-[min(320px,100%)] max-w-[480px] rounded-dashboard-dialog bg-dashboard-surface p-6 shadow-dashboard-overlay outline-none"
    >
      <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-full bg-dashboard-surface-subtle text-dashboard-muted">
        <LogIn className="size-5" />
      </span>
      <h2 id={titleId} className="mt-4 text-dashboard-section-title font-bold text-dashboard-foreground">You&apos;ve been signed out</h2>
      <p id={descriptionId} className="mt-2 text-dashboard-small leading-6 text-dashboard-muted">
        For your security, sign-ins end after a while. Sign in again to carry on. Anything you typed is kept on this device.
      </p>
      <div className="mt-6 flex md:justify-end">
        <LinkButton href={signInHref} data-autofocus="" className="max-md:w-full">Sign in again</LinkButton>
      </div>
    </Dialog>
  )
}
