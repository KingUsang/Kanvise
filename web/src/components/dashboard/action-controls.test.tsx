import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button, IconButton, LinkButton, actionControlClassName } from './action-controls'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a>,
}))

describe('canonical action controls', () => {
  it('provides semantic variants with 44px default and icon targets', () => {
    render(
      <>
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="quiet">Quiet</Button>
        <Button variant="danger">Danger</Button>
        <IconButton label="Open menu"><span aria-hidden="true">⋯</span></IconButton>
      </>,
    )

    expect(screen.getByRole('button', { name: 'Primary' })).toHaveClass('bg-dashboard-primary', 'min-h-11')
    expect(screen.getByRole('button', { name: 'Secondary' })).toHaveClass('border', 'min-h-11')
    expect(screen.getByRole('button', { name: 'Quiet' })).toHaveClass('text-dashboard-muted', 'min-h-11')
    expect(screen.getByRole('button', { name: 'Danger' })).toHaveClass('bg-dashboard-danger', 'min-h-11')
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveClass('h-11', 'w-11')
  })

  it('defaults buttons to native button semantics and centralizes mobile composition', () => {
    render(<Button fullWidthMobile>Save class</Button>)

    const button = screen.getByRole('button', { name: 'Save class' })
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveClass('w-full', 'sm:w-auto', 'focus-visible:outline-2')
    expect(actionControlClassName({ variant: 'primary', size: 'icon' })).toContain('min-h-11')
  })

  it('makes pending actions legible and non-duplicable', () => {
    render(<Button pending pendingLabel="Saving class…">Save class</Button>)

    const button = screen.getByRole('button', { name: 'Saving class…' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toHaveTextContent('Saving class…')
  })

  it('keeps link actions as links with an accessible name', () => {
    render(<LinkButton href="/dashboard/classes/new" variant="primary" fullWidthMobile>Create class</LinkButton>)

    const link = screen.getByRole('link', { name: 'Create class' })
    expect(link).toHaveAttribute('href', '/dashboard/classes/new')
    expect(link).toHaveClass('w-full', 'sm:w-auto', 'min-h-11')
  })
})
