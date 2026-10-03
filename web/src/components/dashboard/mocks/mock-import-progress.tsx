export type MockImportPhase = 'reading' | 'extracting' | 'parsing' | 'validating' | 'complete' | 'error'

export type MockImportProgress = {
  id: string
  fileName: string
  phase: MockImportPhase
  percent: number | null
  message?: string
}

export function MockImportProgressCard({ progress }: { progress: MockImportProgress }) {
  const isComplete = progress.phase === 'complete'
  const isError = progress.phase === 'error'
  return (
    <div className={`w-full rounded-xl border p-4 text-left ${isError ? 'border-red-200 bg-red-50' : isComplete ? 'border-[#b7dec6] bg-[#f2fbf5]' : 'border-[#d9d3ef] bg-[#faf9ff]'}`} role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className={`material-symbols-outlined mt-0.5 text-xl ${isError ? 'text-red-700' : isComplete ? 'text-[#166534]' : 'animate-spin text-[#2e2877]'}`}>{isError ? 'error' : isComplete ? 'check_circle' : 'progress_activity'}</span>
        <div className="min-w-0">
          <p className="font-semibold text-[#1b1c1c]">{isComplete ? 'Questions ready to review' : isError ? 'Import stopped' : 'Reading your paper'}</p>
          <p className="mt-0.5 truncate text-xs text-[#716c76]">{progress.fileName}</p>
          {isError
            ? <p className="mt-3 text-sm leading-5 text-red-700">{progress.message || 'Kanvise could not read this document. Your mock has not changed.'}</p>
            : isComplete
              ? <p className="mt-2 text-sm leading-5 text-[#166534]">Kanvise found editable questions. Review them before publishing.</p>
              : <p className="mt-2 text-sm leading-5 text-[#474551]">Kanvise is reading question blocks and subject headings. This can take a little while for a full paper.</p>}
        </div>
      </div>
    </div>
  )
}

export function newMockImportProgress(fileName: string): MockImportProgress {
  return { id: crypto.randomUUID().replaceAll('-', '').slice(0, 8), fileName, phase: 'reading', percent: null }
}
