import Link from 'next/link'
import { forwardRef, useId, type ButtonHTMLAttributes, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

/** `outline` is the redesign name for `secondary`; both render the same. */
export type ActionControlVariant = 'primary' | 'secondary' | 'outline' | 'quiet' | 'danger'
export type ActionControlSize = 'default' | 'icon'

type ActionControlStyleOptions = {
  variant?: ActionControlVariant
  size?: ActionControlSize
  fullWidthMobile?: boolean
  className?: string
}

const variantClasses: Record<ActionControlVariant, string> = {
  primary: 'bg-dashboard-primary text-white hover:bg-dashboard-primary/90',
  secondary: 'border border-dashboard-outline bg-dashboard-surface text-dashboard-foreground hover:bg-dashboard-surface-subtle',
  outline: 'border border-dashboard-outline bg-dashboard-surface text-dashboard-foreground hover:bg-dashboard-surface-subtle',
  quiet: 'text-dashboard-muted hover:bg-dashboard-surface-subtle hover:text-dashboard-foreground',
  danger: 'bg-dashboard-danger text-white hover:bg-dashboard-danger/90',
}

const sizeClasses: Record<ActionControlSize, string> = {
  default: 'min-h-11 px-4 py-2.5 text-sm',
  icon: 'h-11 min-h-11 w-11 p-0',
}

export function actionControlClassName({
  variant = 'primary',
  size = 'default',
  fullWidthMobile = false,
  className = '',
}: ActionControlStyleOptions = {}) {
  return [
    'dashboard-press inline-flex items-center justify-center gap-2 rounded-dashboard-control font-semibold outline-none focus-visible:outline-2 focus-visible:outline-dashboard-focus focus-visible:outline-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60',
    variantClasses[variant],
    sizeClasses[size],
    fullWidthMobile ? 'w-full sm:w-auto' : '',
    className,
  ].filter(Boolean).join(' ')
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & ActionControlStyleOptions & {
  pending?: boolean
  pendingLabel?: ReactNode
  /**
   * Why the button is disabled, shown as text under the button and linked
   * with aria-describedby (SH-12, SH-13). Setting it disables the button.
   */
  disabledReason?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    className,
    disabled,
    disabledReason,
    fullWidthMobile,
    pending = false,
    pendingLabel,
    size,
    type = 'button',
    variant,
    'aria-describedby': describedBy,
    ...props
  },
  ref,
) {
  const reasonId = useId()
  const hasReason = disabledReason !== undefined && disabledReason !== null && disabledReason !== false
  const button = (
    <button
      {...props}
      ref={ref}
      type={type}
      disabled={disabled || pending || hasReason}
      aria-busy={pending || undefined}
      aria-describedby={[describedBy, hasReason ? reasonId : undefined].filter(Boolean).join(' ') || undefined}
      className={actionControlClassName({ variant, size, fullWidthMobile, className })}
    >
      {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
      {pending ? (pendingLabel ?? children) : children}
    </button>
  )
  if (!hasReason) return button
  return (
    <span className={`inline-flex max-w-full flex-col gap-1 ${fullWidthMobile ? 'w-full sm:w-auto' : ''}`.trim()}>
      {button}
      <span id={reasonId} className="text-dashboard-secondary text-dashboard-muted">{disabledReason}</span>
    </span>
  )
})

type LinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, 'className' | 'children'> & {
  children: ReactNode
} & ActionControlStyleOptions

export const LinkButton = forwardRef<HTMLAnchorElement, LinkProps>(function LinkButton(
  { children, className, fullWidthMobile, size, variant, ...props },
  ref,
) {
  return (
    <Link
      {...props}
      ref={ref}
      className={actionControlClassName({ variant, size, fullWidthMobile, className })}
    >
      {children}
    </Link>
  )
})

export type IconButtonProps = Omit<ButtonProps, 'children' | 'size'> & {
  label: string
  children: ReactNode
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { children, label, ...props },
  ref,
) {
  return (
    <Button {...props} ref={ref} size="icon" aria-label={label}>
      {children}
    </Button>
  )
})
