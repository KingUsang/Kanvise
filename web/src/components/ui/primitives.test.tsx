import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Alert } from './alert'
import { Badge } from './badge'
import { Field, fieldControlClassName } from './field'

describe('shared ui primitives', () => {
  it('Alert announces danger as alert and other tones as status', () => {
    render(<><Alert>Broke</Alert><Alert tone="info">FYI</Alert></>)
    expect(screen.getByRole('alert')).toHaveTextContent('Broke')
    expect(screen.getByRole('status')).toHaveTextContent('FYI')
  })

  it('Badge applies tone classes', () => {
    render(<Badge tone="success">Live</Badge>)
    expect(screen.getByText('Live')).toHaveClass('text-green-800')
  })

  it('Field links label, control and error', () => {
    render(<Field label="Email" error="Required"><input className={fieldControlClassName} /></Field>)
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Required')
  })
})
