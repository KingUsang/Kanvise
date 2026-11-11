import { render, screen } from '@testing-library/react'
import Link from 'next/link'
import { describe, expect, it } from 'vitest'
import { PageHeader, WorkspaceHeader } from './page-header'

describe('canonical dashboard headers', () => {
  it('keeps one heading and wraps mobile actions without a fixed grid', () => {
    render(
      <PageHeader
        title="Classes"
        description="Create the teaching groups where your subjects live."
        actions={
          <>
            <button type="button" className="min-h-11">Create class</button>
            <button type="button" className="min-h-11">More actions</button>
          </>
        }
      />,
    )

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'Classes' })).toBeInTheDocument()
    expect(screen.getByRole('banner')).toHaveClass('flex-col')
    expect(screen.getByRole('button', { name: 'Create class' })).toHaveClass('min-h-11')
    expect(screen.getByRole('button', { name: 'More actions' })).toHaveClass('min-h-11')
  })

  it('keeps workspace back navigation, status, long titles and contextual actions accessible', () => {
    const title = 'A very long Class title that must remain readable at narrow widths and zoom'
    render(
      <WorkspaceHeader
        title={title}
        back={<Link href="/dashboard/classes">Classes</Link>}
        status="Draft"
        description="Single-subject class"
        actions={<button type="button" className="min-h-11">Add subject</button>}
      />,
    )

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Classes' })).toHaveAttribute('href', '/dashboard/classes')
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add subject' })).toHaveClass('min-h-11')
    expect(screen.getByRole('banner')).toHaveClass('min-w-0')
  })
})
