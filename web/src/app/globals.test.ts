import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(path.resolve(__dirname, 'globals.css'), 'utf8')

function reducedMotionBlock() {
  const start = css.lastIndexOf('@media (prefers-reduced-motion: reduce)')
  expect(start).toBeGreaterThan(-1)
  return css.slice(start)
}

describe('design tokens in globals.css', () => {
  it('defines the location, focus, status, entity and course roles', () => {
    for (const token of [
      '--dashboard-location:',
      '--dashboard-focus:',
      '--dashboard-scrim:',
      '--dashboard-status-planned:',
      '--dashboard-status-soon:',
      '--dashboard-status-live:',
      '--dashboard-info:',
      '--dashboard-success:',
      '--dashboard-danger:',
      '--dashboard-entity-student:',
      '--dashboard-entity-settings-tint:',
      '--dashboard-course-indigo:',
      '--color-dashboard-location: var(--dashboard-location)',
    ]) expect(css).toContain(token)
  })

  it('has the 8/12/16px radius tiers and 16/40px gutters switching at 1024px', () => {
    expect(css).toContain('--dashboard-radius-control: 0.5rem')
    expect(css).toContain('--dashboard-radius-panel: 0.75rem')
    expect(css).toContain('--dashboard-radius-dialog: 1rem')
    expect(css).toMatch(/--dashboard-gutter: 16px;[\s\S]*@media \(min-width: 1024px\) \{\s*:root \{\s*--dashboard-gutter: 40px;/)
  })

  it('uses a 2px focus ring outside the control', () => {
    expect(css).toMatch(/\*:focus-visible \{\s*outline: 2px solid var\(--dashboard-focus\);\s*outline-offset: 2px;/)
  })

  it('turns off every animation utility under reduced motion', () => {
    const block = reducedMotionBlock()
    for (const name of [
      '.animate-fade-up',
      '.animate-fade-in',
      '.animate-slide-right',
      '.animate-float',
      '.animate-float-delayed',
      '.animate-dashboard-dialog-in',
      '.animate-dashboard-menu-in',
      '.animate-dashboard-step-forward',
      '.animate-dashboard-shimmer',
      '.animate-dashboard-live-pulse',
      '[class*="animate-"]',
    ]) expect(block).toContain(name)
    expect(block).toContain('scroll-behavior: auto !important')
    expect(block).toContain('transition-duration: 0.01ms !important')
  })
})
