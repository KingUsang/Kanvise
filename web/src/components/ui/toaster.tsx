'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Toaster } from 'sonner'
import { CircleCheck, Info } from 'lucide-react'
import { closeActionToasts, TOAST_DURATION_MS } from '@/lib/toast'

const PHONE_QUERY = '(max-width: 767px)'
const TOAST_SELECTOR = '[data-sonner-toast]'
const TOASTER_SELECTOR = '[data-sonner-toaster]'

function usePhone() {
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    const media = window.matchMedia?.(PHONE_QUERY)
    if (!media) return
    const update = () => setPhone(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return phone
}

/**
 * The app's one toast region (SH-08, R-10): one toast at a time, 4 seconds,
 * bottom right on desktop and bottom centre on phones above
 * --shell-bottom-offset (the bottom bar and any fixed action bar). It stays
 * clickable over dialogs (the dialog leaves it out of `inert`). F6 moves focus
 * to the toasts; focus or hover pauses the timer. Leaving the page closes
 * any Undo window.
 */
export function AppToaster() {
  const phone = usePhone()
  const pathname = usePathname()
  const firstPath = useRef(pathname)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (firstPath.current === pathname) return
    firstPath.current = pathname
    closeActionToasts()
  }, [pathname])

  useEffect(() => {
    // Browsers use F6 to move to the address bar; take it only while a toast is showing.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'F6' && document.querySelector(TOAST_SELECTOR)) event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    // Sonner pauses its timers while the list is "expanded" (pointer over
    // it). Keyboard focus should pause them too, so mirror focus as pointer
    // presence on the list.
    const onFocusIn = (event: FocusEvent) => {
      const list = (event.target as Element | null)?.closest?.(TOASTER_SELECTOR)
      list?.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
    }
    const onFocusOut = (event: FocusEvent) => {
      const list = (event.target as Element | null)?.closest?.(TOASTER_SELECTOR)
      if (!list || list.contains(event.relatedTarget as Node | null)) return
      list.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }))
    }
    wrapper.addEventListener('focusin', onFocusIn)
    wrapper.addEventListener('focusout', onFocusOut)
    return () => {
      wrapper.removeEventListener('focusin', onFocusIn)
      wrapper.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  return (
    <div ref={wrapperRef} data-keep-interactive="">
      <Toaster
        position={phone ? 'bottom-center' : 'bottom-right'}
        visibleToasts={1}
        duration={TOAST_DURATION_MS}
        hotkey={['F6']}
        richColors
        offset={{ bottom: 'calc(var(--shell-bottom-offset, 0px) + 24px)', right: 24, left: 24 }}
        mobileOffset={{ bottom: 'calc(var(--shell-bottom-offset, 0px) + 16px + env(safe-area-inset-bottom))', left: 16, right: 16 }}
        icons={{
          success: <CircleCheck aria-hidden="true" className="size-4" />,
          info: <Info aria-hidden="true" className="size-4" />,
        }}
        toastOptions={{ closeButtonAriaLabel: 'Dismiss' }}
      />
    </div>
  )
}
