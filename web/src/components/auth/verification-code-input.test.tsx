import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { VerificationCodeInput } from './verification-code-input'

function ControlledCodeInput() {
  const [value, setValue] = useState('')
  return <><VerificationCodeInput id="test-code" label="Verification code" value={value} onChange={setValue} /><output>{value}</output></>
}

describe('VerificationCodeInput', () => {
  it('accepts a complete pasted code and distributes it across the six fields', async () => {
    const user = userEvent.setup()
    render(<ControlledCodeInput />)

    await user.click(screen.getByLabelText('Verification code, digit 1 of 6'))
    await user.paste('123456')

    expect(screen.getByText('123456')).toBeInTheDocument()
    expect(screen.getByLabelText('Verification code, digit 6 of 6')).toHaveValue('6')
  })
})
