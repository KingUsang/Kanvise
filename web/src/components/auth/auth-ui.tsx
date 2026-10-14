'use client'

import { useEffect, useRef, type ReactNode } from 'react'

export function AuthHeading({ title, description }: { title: string; description: ReactNode }) {
  return <header className="mb-7">
    <h1 className="text-[1.75rem] font-semibold leading-[1.15] tracking-[-.03em] text-[#211969] sm:text-[2rem]">{title}</h1>
    <p className="mt-3 max-w-md text-sm leading-6 text-[#625e6e] sm:text-[15px]">{description}</p>
  </header>
}

export function AuthAlert({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'info' | 'success' }) {
  const alertRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (tone === 'error') alertRef.current?.focus()
  }, [tone])
  const styles = tone === 'error' ? 'border-[#efc9c4] bg-[#fff7f6] text-[#8d2f22]' : tone === 'success' ? 'border-[#bfe0cc] bg-[#f3fbf6] text-[#17653a]' : 'border-[#cbc8ed] bg-[#f6f5ff] text-[#342d78]'
  return <div ref={alertRef} tabIndex={tone === 'error' ? -1 : undefined} role={tone === 'error' ? 'alert' : 'status'} className={`mb-5 rounded-xl border px-4 py-3 text-sm leading-5 outline-none ${styles}`}>{children}</div>
}

export const authInputClass = 'min-h-12 w-full rounded-xl border border-[#c9c6d7] bg-white px-4 text-[16px] text-[#1b1c1c] outline-none transition placeholder:text-[#a09ca8] focus:border-[#2e2877] focus:ring-2 focus:ring-[#2e2877]/15'
export const authPrimaryButtonClass = 'flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#994704] px-5 text-sm font-semibold text-white transition hover:bg-[#7d3903] focus:outline-none focus:ring-4 focus:ring-[#994704]/20 disabled:cursor-not-allowed disabled:opacity-60'

export function AuthLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-[#302c39]">{children}</label>
}
