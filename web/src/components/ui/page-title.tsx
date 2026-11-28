'use client'

import { useState, type ReactNode } from 'react'

/**
 * The page's one h1: 24px on phones, 30px from 768px, foreground colour
 * (SH-03). On phones it stays on one line with an ellipsis; tapping it shows
 * the full title (R-03). `level` 2 is only for previews such as the
 * component catalog, where the page already has its own h1.
 */
export function PageTitle({ children, level = 1 }: { children: ReactNode; level?: 1 | 2 }) {
  const [expanded, setExpanded] = useState(false)
  const Heading = level === 2 ? 'h2' : 'h1'
  return (
    <Heading
      onClick={() => setExpanded((value) => !value)}
      data-expanded={expanded || undefined}
      className={`min-w-0 text-dashboard-page-title font-bold text-dashboard-foreground md:text-dashboard-page-title-desktop ${expanded ? 'break-words' : 'max-md:truncate md:break-words'}`}
    >
      {children}
    </Heading>
  )
}
