export type MockImportPhase = 'reading' | 'extracting' | 'parsing' | 'validating' | 'complete' | 'error'

export type MockImportProgress = {
  id: string
  fileName: string
  phase: MockImportPhase
  percent: number | null
  message?: string
}

const STEPS: Array<{ phase: Exclude<MockImportPhase, 'error'>; label: string }> = [
  { phase: 'reading', label: 'Document received' },
  { phase: 'extracting', label: 'Text extracted from document' },
  { phase: 'parsing', label: 'AI parsing question blocks' },
  { phase: 'validating', label: 'Questions structured and validated' },
  { phase: 'complete', label: 'Editable questions ready' },
]

const ORDER = STEPS.map(step => step.phase)

export function MockImportProgressCard({ progress }: { progress: MockImportProgress }) {
  const currentIndex = progress.phase === 'error' ? -1 : ORDER.indexOf(progress.phase)
  return (
    <div className={`w-full rounded-xl border p-4 text-left ${progress.phase === 'error' ? 'border-red-200 bg-red-50' : 'border-[#d9d3ef] bg-[#faf9ff]'}`} role="status" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="font-semibold text-[#1b1c1c]">{progress.phase === 'complete' ? 'Questions parsed' : progress.phase === 'error' ? 'Parsing stopped' : 'Parsing questions'}</p><p className="mt-0.5 truncate text-xs text-[#716c76]">{progress.fileName}</p></div>
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-[#787582]">job {progress.id}</span>
      </div>

      {progress.phase !== 'error' && <>{progress.percent === null ? <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e4e2f2]" role="progressbar" aria-label="Question parsing progress"><div className="h-full w-1/3 animate-pulse rounded-full bg-[#2e2877]" /></div> : <><div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e4e2f2]" role="progressbar" aria-label="Question parsing progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}><div className="h-full rounded-full bg-[#2e2877] transition-[width] duration-300" style={{ width: `${progress.percent}%` }} /></div><p className="mt-2 text-xs font-semibold text-[#474551]">{progress.percent}% complete</p></>}{progress.message && <p className="mt-1 text-xs leading-5 text-[#716c76]">{progress.message}</p>}</>}
      {progress.phase === 'error' && <p className="mt-3 text-sm text-red-700">{progress.message || 'The document could not be parsed.'}</p>}

      <ol className="mt-4 space-y-2">
        {STEPS.map((step, index) => {
          const complete = progress.phase === 'complete' || currentIndex > index
          const current = currentIndex === index
          if (progress.phase === 'error' && index > 0) return null
          return <li key={step.phase} className={`flex items-center gap-2 text-xs ${complete ? 'text-green-700' : current ? 'font-semibold text-[#2e2877]' : 'text-[#8a8690]'}`}><span className="material-symbols-outlined text-base">{complete ? 'check_circle' : current ? 'progress_activity' : 'radio_button_unchecked'}</span><span>{step.label}</span></li>
        })}
      </ol>
    </div>
  )
}

export function newMockImportProgress(fileName: string): MockImportProgress {
  return { id: crypto.randomUUID().replaceAll('-', '').slice(0, 8), fileName, phase: 'reading', percent: null }
}
