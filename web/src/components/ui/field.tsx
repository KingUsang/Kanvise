import { useId, type ReactElement, cloneElement } from 'react'

export const fieldControlClassName = 'w-full rounded-dashboard-control border border-dashboard-outline bg-transparent px-3 py-2 text-base outline-none focus:border-dashboard-primary sm:text-sm'

/** Label + control + hint/error, wired with ids so assistive tech reads them together. */
export function Field({ label, hint, error, children }: {
  label: string
  hint?: string
  error?: string | null
  children: ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>
}) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-dashboard-foreground">{label}</label>
      {cloneElement(children, { id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {error ? <p id={`${id}-error`} role="alert" className="text-xs text-dashboard-danger">{error}</p>
        : hint ? <p id={`${id}-hint`} className="text-xs text-dashboard-muted">{hint}</p> : null}
    </div>
  )
}
