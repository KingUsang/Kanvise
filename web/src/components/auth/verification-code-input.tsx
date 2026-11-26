'use client'

import { useRef } from 'react'

type VerificationCodeInputProps = {
  id: string
  value: string
  onChange: (value: string) => void
  label: string
  disabled?: boolean
}

const CODE_LENGTH = 6

export function VerificationCodeInput({ id, value, onChange, label, disabled = false }: VerificationCodeInputProps) {
  const inputs = useRef<Array<HTMLInputElement | null>>([])
  const digits = Array.from({ length: CODE_LENGTH }, (_, index) => value[index] || '')

  function setDigit(index: number, digit: string) {
    const next = [...digits]
    next[index] = digit
    onChange(next.join(''))
  }

  function fillCode(rawValue: string, startIndex = 0) {
    const pastedDigits = rawValue.replace(/\D/g, '').slice(0, CODE_LENGTH - startIndex).split('')
    if (!pastedDigits.length) return
    const next = [...digits]
    pastedDigits.forEach((digit, offset) => { next[startIndex + offset] = digit })
    onChange(next.join(''))
    inputs.current[Math.min(startIndex + pastedDigits.length, CODE_LENGTH - 1)]?.focus()
  }

  return <fieldset disabled={disabled} className="border-0 p-0">
    <legend className="mb-2 block text-sm font-medium text-[#302c39]">{label}</legend>
    <div className="grid grid-cols-6 gap-2 sm:gap-3" role="group" aria-label={label}>
      {digits.map((digit, index) => <input
        key={index}
        ref={element => { inputs.current[index] = element }}
        id={index === 0 ? id : undefined}
        aria-label={`${label}, digit ${index + 1} of ${CODE_LENGTH}`}
        inputMode="numeric"
        autoComplete={index === 0 ? 'one-time-code' : 'off'}
        pattern="[0-9]*"
        maxLength={1}
        value={digit}
        onChange={event => {
          const nextValue = event.target.value
          if (nextValue.length > 1) {
            fillCode(nextValue, index)
            return
          }
          const nextDigit = nextValue.replace(/\D/g, '')
          setDigit(index, nextDigit)
          if (nextDigit && index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus()
        }}
        onPaste={event => {
          event.preventDefault()
          fillCode(event.clipboardData.getData('text'), index)
        }}
        onKeyDown={event => {
          if (event.key === 'Backspace' && !digit && index > 0) inputs.current[index - 1]?.focus()
          if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); inputs.current[index - 1]?.focus() }
          if (event.key === 'ArrowRight' && index < CODE_LENGTH - 1) { event.preventDefault(); inputs.current[index + 1]?.focus() }
        }}
        className="min-h-12 min-w-0 rounded-xl border border-[#c9c6d7] bg-white px-1 text-center text-lg font-medium text-[#211969] outline-none transition focus:border-[#2e2877] focus:ring-2 focus:ring-[#2e2877]/15 disabled:bg-[#f5f4f7] disabled:text-[#8b8794]"
      />)}
    </div>
  </fieldset>
}
