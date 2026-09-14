'use client'

import { ChevronLeft, ChevronRight, FileText, Presentation, SquarePen } from 'lucide-react'
import { usePresentationSession } from './presentation-session'

export default function PresentationControls() {
  const { mode, active, materials, setMaterialsOpen, closePresentation } = usePresentationSession()
  return (
    <div className="flex items-center gap-1 rounded-xl border border-[#dedce2] bg-[#f4f2f5] p-1">
      <button
        onClick={() => { if (mode === 'presentation') void closePresentation() }}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors ${mode === 'whiteboard' ? 'bg-white text-[#180d62] shadow-sm' : 'text-[#66636d] hover:bg-white/70'}`}
        title="Whiteboard"
      >
        <SquarePen size={16} /><span className="hidden xl:inline">Whiteboard</span>
      </button>
      <button
        onClick={() => setMaterialsOpen(true)}
        className={`relative flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors ${mode === 'presentation' ? 'bg-[#180d62] text-white shadow-sm' : 'text-[#66636d] hover:bg-white/70'}`}
        title="Presentation materials"
      >
        {active ? <Presentation size={16} /> : <FileText size={16} />}
        <span className="hidden xl:inline">Materials</span>
        {materials.length > 0 && <span className="ml-0.5 rounded-full bg-[#994704] px-1.5 text-[9px] leading-4 text-white">{materials.length}</span>}
      </button>
    </div>
  )
}

export function PresentationPageControls({ isHost }: { isHost: boolean }) {
  const { mode, active, changePage } = usePresentationSession()
  if (mode !== 'presentation' || !active?.page_count) return null

  return <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-[#dedce2] bg-[#f4f2f5] p-1" aria-label="Presentation pages">
    <button onClick={() => void changePage(active.current_page - 1)} disabled={!isHost || active.current_page === 1} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#180d62] hover:bg-white disabled:opacity-35" aria-label="Previous page"><ChevronLeft size={17} /></button>
    <span className="min-w-9 px-1 text-center text-[11px] font-bold tabular-nums text-[#474551]">{active.current_page}/{active.page_count}</span>
    <button onClick={() => void changePage(active.current_page + 1)} disabled={!isHost || active.current_page === active.page_count} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#180d62] hover:bg-white disabled:opacity-35" aria-label="Next page"><ChevronRight size={17} /></button>
  </div>
}
