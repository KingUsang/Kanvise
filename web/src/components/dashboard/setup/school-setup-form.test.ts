import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SchoolSetupForm, slugifyCentreName, withCacheVersion } from './school-setup-form'

describe('centre setup helpers', () => {
  it('generates a stable student-page slug from the centre name', () => {
    expect(slugifyCentreName('  Emmanuel’s JAMB & WAEC Centre  ')).toBe('emmanuel-s-jamb-waec-centre')
    expect(slugifyCentreName('---')).toBe('')
  })

  it('cache-busts new media previews without damaging existing query strings', () => {
    expect(withCacheVersion('https://cdn.example.com/logo.png', 42)).toBe('https://cdn.example.com/logo.png?v=42')
    expect(withCacheVersion('https://cdn.example.com/logo.png?width=200', 42)).toBe('https://cdn.example.com/logo.png?width=200&v=42')
  })

  it('keeps first-time setup to the centre name and a generated link preview', async () => {
    const user = userEvent.setup()
    render(React.createElement(SchoolSetupForm, { initialData: null, token: 'test-token' }))

    expect(screen.getByRole('heading', { name: 'Name your centre' })).toBeInTheDocument()
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(screen.queryByText('Photos and Welcome Video')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Centre name'), 'Bright Future Tutorials')
    expect(screen.getByText(/bright-future-tutorials$/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue to dashboard' })).toBeEnabled()
  })

  it('only exposes discard and save after an existing profile changes', async () => {
    const user = userEvent.setup()
    render(React.createElement(SchoolSetupForm, {
      token: 'test-token',
      initialData: { id: 'school-1', name: 'Bright Future', slug: 'bright-future', is_active: true },
    }))

    expect(screen.queryByRole('button', { name: 'Discard' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()

    await user.type(screen.getByLabelText('Centre Name *'), ' Academy')
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()
  })
})
