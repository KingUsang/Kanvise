'use client'

import { useState } from 'react'

const sizeClasses = {
  sm: 'size-8 text-dashboard-secondary',
  md: 'size-10 text-dashboard-small',
  lg: 'size-14 text-dashboard-section-title',
} as const

export function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : ''
  return `${first}${last}`.toUpperCase()
}

/**
 * Photo, or initials when there is no photo or it fails to load. `shape`
 * square is for agencies (logo or first letter in a rounded square, SH-02).
 * Decorative by default because the name is shown next to it; pass
 * `decorative={false}` when the avatar stands alone.
 */
export function Avatar({ name, src, size = 'md', shape = 'circle', decorative = true, className = '' }: {
  name: string
  src?: string | null
  size?: keyof typeof sizeClasses
  shape?: 'circle' | 'square'
  decorative?: boolean
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const shapeClass = shape === 'square' ? 'rounded-dashboard-control' : 'rounded-full'
  const base = `inline-flex shrink-0 items-center justify-center overflow-hidden font-semibold ${sizeClasses[size]} ${shapeClass} ${className}`.trim()
  const a11y = decorative ? { 'aria-hidden': true as const } : { role: 'img' as const, 'aria-label': name }

  if (src && !failed) {
    return (
      <span {...a11y} className={`${base} bg-dashboard-surface-subtle`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- avatars come from user storage with arbitrary hosts */}
        <img src={src} alt="" className="size-full object-cover" onError={() => setFailed(true)} />
      </span>
    )
  }
  return (
    <span {...a11y} className={`${base} bg-dashboard-entity-lesson-tint text-dashboard-entity-lesson`}>
      {shape === 'square' ? initialsFor(name).slice(0, 1) : initialsFor(name)}
    </span>
  )
}
