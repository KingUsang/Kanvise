import type { ReactNode } from 'react'

export function Field({
  id,
  label,
  required = false,
  optional = false,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  required?: boolean
  optional?: boolean
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-dashboard-foreground">
        {label}
        {required ? <span className="ml-1 text-dashboard-danger" aria-hidden="true">*</span> : null}
        {optional ? <span className="ml-1 font-normal text-dashboard-muted">(optional)</span> : null}
      </label>
      {hint ? <p id={`${id}-hint`} className="mt-1 text-xs text-dashboard-muted">{hint}</p> : null}
      {children}
      {error ? <p id={`${id}-error`} role="alert" aria-live="assertive" className="mt-1 text-sm text-dashboard-danger">{error}</p> : null}
    </div>
  )
}

export function fieldDescribedBy(id: string, hint?: string, error?: string) {
  return [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined
}

export const fieldControlClassName = 'mt-2 min-h-11 w-full rounded-dashboard-control border border-dashboard-outline bg-dashboard-surface px-3 text-sm text-dashboard-foreground outline-none transition focus-visible:outline-2 focus-visible:outline-dashboard-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:bg-dashboard-surface-subtle disabled:opacity-70'
