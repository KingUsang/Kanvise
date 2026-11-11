import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './action-controls'
import { CollectionToolbar } from './collection-controls'

describe('canonical collection toolbar', () => {
  it('exposes labelled search/filter controls, truthful count, and an action', () => {
    render(
      <CollectionToolbar
        ariaLabel="Class collection controls"
        searchLabel="Search classes"
        searchPlaceholder="Search classes or subjects"
        searchValue=""
        onSearchChange={vi.fn()}
        filterLabel="Filter classes by status"
        filterValue="all"
        filterOptions={[{ value: 'all', label: 'All' }, { value: 'draft', label: 'Draft' }]}
        onFilterChange={vi.fn()}
        resultCount={2}
        totalCount={4}
        itemLabel="class"
        itemPluralLabel="classes"
        action={<Button>Create class</Button>}
      />,
    )

    expect(screen.getByRole('toolbar', { name: 'Class collection controls' })).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search classes' })).toHaveClass('min-h-11')
    expect(screen.getByRole('combobox', { name: 'Filter classes by status' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('2 of 4 classes')
    expect(screen.getByRole('button', { name: 'Create class' })).toHaveClass('min-h-11')
  })

  it('forwards search and filter changes without owning collection state', () => {
    const onSearchChange = vi.fn()
    const onFilterChange = vi.fn()
    render(
      <CollectionToolbar
        ariaLabel="Class collection controls"
        searchLabel="Search classes"
        searchPlaceholder="Search classes or subjects"
        searchValue="math"
        onSearchChange={onSearchChange}
        filterLabel="Filter classes by status"
        filterValue="all"
        filterOptions={[{ value: 'all', label: 'All' }, { value: 'published', label: 'Active' }]}
        onFilterChange={onFilterChange}
        resultCount={1}
        totalCount={1}
        itemLabel="class"
        itemPluralLabel="classes"
      />,
    )

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search classes' }), { target: { value: 'physics' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter classes by status' }), { target: { value: 'published' } })

    expect(onSearchChange).toHaveBeenCalledWith('physics')
    expect(onFilterChange).toHaveBeenCalledWith('published')
    expect(screen.getByRole('status')).toHaveTextContent('1 class')
  })
})
