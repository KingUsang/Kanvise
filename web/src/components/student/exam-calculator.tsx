'use client'

import { Delete } from 'lucide-react'
import { useState } from 'react'

type Operation = '+' | '−' | '×' | '÷' | null

export function ExamCalculator({ mode, onClose }: { mode: 'basic' | 'scientific'; onClose: () => void }) {
  const [display, setDisplay] = useState('0')
  const [stored, setStored] = useState<number | null>(null)
  const [operation, setOperation] = useState<Operation>(null)
  const [fresh, setFresh] = useState(true)

  function number(value: string) {
    setDisplay(current => fresh || current === '0' ? value : current.length < 14 ? current + value : current)
    setFresh(false)
  }
  function choose(next: Operation) {
    if (stored !== null && operation && !fresh) {
      const current = Number(display)
      const result = operation === '+' ? stored + current : operation === '−' ? stored - current : operation === '×' ? stored * current : current === 0 ? NaN : stored / current
      setDisplay(Number.isFinite(result) ? String(Number(result.toPrecision(12))) : 'Error')
      setStored(result)
    } else setStored(Number(display))
    setOperation(next); setFresh(true)
  }
  function equals() {
    if (stored === null || !operation) return
    const current = Number(display)
    const result = operation === '+' ? stored + current : operation === '−' ? stored - current : operation === '×' ? stored * current : current === 0 ? NaN : stored / current
    setDisplay(Number.isFinite(result) ? String(Number(result.toPrecision(12))) : 'Error')
    setStored(null); setOperation(null); setFresh(true)
  }
  function unary(kind: 'sqrt' | 'square' | 'sin' | 'cos' | 'tan' | 'log') {
    const value = Number(display)
    const result = kind === 'sqrt' ? Math.sqrt(value) : kind === 'square' ? value ** 2
      : kind === 'sin' ? Math.sin(value * Math.PI / 180) : kind === 'cos' ? Math.cos(value * Math.PI / 180)
        : kind === 'tan' ? Math.tan(value * Math.PI / 180) : Math.log10(value)
    setDisplay(Number.isFinite(result) ? String(Number(result.toPrecision(12))) : 'Error'); setFresh(true)
  }
  const key = 'min-h-11 rounded-lg bg-white text-sm font-semibold text-[#302d36] shadow-sm hover:bg-[#eeeafe]'
  return <section aria-label={`${mode} calculator`} className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border border-[#ded8d3] bg-[#f3f0ed] p-4 shadow-2xl sm:inset-auto sm:bottom-6 sm:right-6 sm:w-80 sm:rounded-2xl">
    <div className="flex items-center justify-between"><h2 className="font-semibold capitalize">{mode} calculator</h2><button onClick={onClose} className="rounded-lg p-2 text-[#716c76]" aria-label="Close calculator">×</button></div>
    <div className="mt-3 overflow-hidden rounded-xl bg-[#29262f] px-4 py-3 text-right font-mono text-2xl text-white">{display}</div>
    {mode === 'scientific' && <div className="mt-3 grid grid-cols-6 gap-2">{([['√', 'sqrt'], ['x²', 'square'], ['sin', 'sin'], ['cos', 'cos'], ['tan', 'tan'], ['log', 'log']] as const).map(([label, kind]) => <button key={kind} onClick={() => unary(kind)} className={key}>{label}</button>)}</div>}
    <div className="mt-3 grid grid-cols-4 gap-2">
      <button onClick={() => { setDisplay('0'); setStored(null); setOperation(null); setFresh(true) }} className={`${key} text-[#9b2f20]`}>AC</button><button onClick={() => setDisplay(String(Number(display) * -1))} className={key}>+/−</button><button onClick={() => setDisplay(String(Number(display) / 100))} className={key}>%</button><button onClick={() => choose('÷')} className={key}>÷</button>
      {['7','8','9'].map(value => <button key={value} onClick={() => number(value)} className={key}>{value}</button>)}<button onClick={() => choose('×')} className={key}>×</button>
      {['4','5','6'].map(value => <button key={value} onClick={() => number(value)} className={key}>{value}</button>)}<button onClick={() => choose('−')} className={key}>−</button>
      {['1','2','3'].map(value => <button key={value} onClick={() => number(value)} className={key}>{value}</button>)}<button onClick={() => choose('+')} className={key}>+</button>
      <button onClick={() => setDisplay(current => current.length > 1 ? current.slice(0, -1) : '0')} className={key} aria-label="Delete digit"><Delete className="mx-auto" size={17} /></button><button onClick={() => number('0')} className={key}>0</button><button onClick={() => !display.includes('.') && setDisplay(current => `${current}.`)} className={key}>.</button><button onClick={equals} className="min-h-11 rounded-lg bg-[#994704] font-semibold text-white">=</button>
    </div>
  </section>
}
