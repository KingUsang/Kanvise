'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronDown, ChevronUp, FileText, Loader2, Trash2, Upload, X,
} from 'lucide-react'
import { toast } from 'sonner'
import CollaborativeWhiteboard from './CollaborativeWhiteboard'
import { usePresentationSession } from './presentation-session'

// Kept as a small pure helper for the presentation-state tests. The board now
// owns zooming, rather than a separate PDF scroll view.
export function pdfRenderScale(scrollAreaWidth: number, naturalPageWidth: number, zoom: number) {
  const availableWidth = Math.max(280, scrollAreaWidth - 32)
  return (availableWidth / naturalPageWidth) * zoom
}

function MaterialsDrawer() {
  const { materials, active, materialsOpen, setMaterialsOpen, upload, replace, activate, rename, reorder, remove } = usePresentationSession()
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [replaceTarget, setReplaceTarget] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  if (!materialsOpen) return null

  const onUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.type !== 'application/pdf' || file.size > 25 * 1024 * 1024) {
      toast.error('Choose a PDF no larger than 25 MB')
      return
    }
    setUploading(true)
    try {
      if (replaceTarget) await replace(replaceTarget, file)
      else await upload(file, setUploadProgress)
    }
    catch (error) { toast.error('Could not upload the PDF', { description: error instanceof Error ? error.message : undefined }) }
    finally { setUploading(false); setUploadProgress(0); setReplaceTarget(null) }
  }

  return (
    <>
      <button className="absolute inset-0 z-30 cursor-default bg-black/30" aria-label="Close materials" onClick={() => setMaterialsOpen(false)} />
      <aside className="absolute inset-x-2 bottom-2 z-40 flex max-h-[min(58dvh,480px)] flex-col overflow-hidden rounded-t-3xl border border-black/10 bg-white shadow-2xl sm:inset-y-3 sm:left-3 sm:right-auto sm:max-h-none sm:w-[min(360px,calc(100%-24px))] sm:rounded-2xl" aria-label="Presentation materials">
      <div className="flex h-14 items-center justify-between border-b border-[#e5e3e8] px-4">
        <div><h2 className="font-bold text-[#180d62]">Materials</h2><p className="text-[11px] text-[#716e79]">PDFs for this class</p></div>
        <button onClick={() => setMaterialsOpen(false)} className="rounded-lg p-2 text-[#716e79] hover:bg-[#f2f0f4]" aria-label="Close materials"><X size={18} /></button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {!materials.length && <div className="rounded-xl border border-dashed border-[#cbc7d2] p-6 text-center text-sm text-[#716e79]">Add the first PDF for this lesson.</div>}
        {materials.map((material, index) => (
          <div key={material.id} className={`rounded-xl border p-3 ${active?.id === material.id ? 'border-[#2e2877] bg-[#f2f0ff]' : 'border-[#e5e3e8]'}`}>
            <button onClick={() => void activate(material.id)} className="flex w-full items-start gap-3 text-left">
              <span className="rounded-lg bg-white p-2 text-[#994704] shadow-sm"><FileText size={18} /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[#24212b]">{material.filename}</span><span className="text-[11px] text-[#716e79]">{material.processing_status === 'ready' ? `${material.page_count} pages` : material.processing_status === 'failed' ? material.processing_error || 'Could not read PDF' : material.processing_status === 'processing' ? 'Checking PDF…' : 'Waiting for upload…'}</span></span>
            </button>
            <div className="mt-2 flex justify-end gap-1 border-t border-black/5 pt-2">
              <button disabled={index === 0} onClick={() => void reorder(material.id, -1)} className="rounded p-1.5 hover:bg-white disabled:opacity-30" title="Move up"><ChevronUp size={14} /></button>
              <button disabled={index === materials.length - 1} onClick={() => void reorder(material.id, 1)} className="rounded p-1.5 hover:bg-white disabled:opacity-30" title="Move down"><ChevronDown size={14} /></button>
              <button onClick={() => { const next = window.prompt('Material name', material.filename); if (next?.trim()) void rename(material.id, next.trim()) }} className="rounded px-2 py-1 text-[11px] font-semibold hover:bg-white">Rename</button>
              <button onClick={() => { setReplaceTarget(material.id); inputRef.current?.click() }} className="rounded px-2 py-1 text-[11px] font-semibold hover:bg-white">Replace</button>
              <button onClick={() => { if (window.confirm(`Remove ${material.filename}?`)) void remove(material.id) }} className="rounded p-1.5 text-red-700 hover:bg-red-50" title="Remove"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-[#e5e3e8] p-3">
        <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={onUpload} />
        <button disabled={uploading} onClick={() => { setReplaceTarget(null); inputRef.current?.click() }} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#180d62] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
          {uploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}{uploading ? `Uploading ${uploadProgress}%` : 'Add PDF'}
        </button>
      </div>
      </aside>
    </>
  )
}

export default function PresentationStage({ isHost }: { isHost: boolean }) {
  const { mode, active, legacySlides, loading, getPageViewUrl } = usePresentationSession()
  const [url, setUrl] = useState('')
  const [displayedPage, setDisplayedPage] = useState<number | null>(null)
  const displayedMaterialIdRef = useRef<string | null>(null)
  const [isLoadingPage, setIsLoadingPage] = useState(false)
  const [isRenderingPage, setIsRenderingPage] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const activeId = active?.id
  const activeUpdatedAt = active?.updated_at
  const activePage = active?.current_page
  const handlePdfRenderStateChange = useCallback((rendering: boolean) => setIsRenderingPage(rendering), [])

  useEffect(() => {
    setPageError(null)
    if (!activeId) return
    let cancelled = false
    if (!activePage) return
    const materialChanged = displayedMaterialIdRef.current !== activeId
    if (materialChanged) {
      setUrl('')
      setDisplayedPage(null)
      displayedMaterialIdRef.current = activeId
    }
    setIsLoadingPage(true)
    void getPageViewUrl(activeId, activePage).then((next) => {
      if (cancelled) return
      setUrl(next)
      setDisplayedPage(activePage)
      displayedMaterialIdRef.current = activeId
    }).catch((error) => {
      if (!cancelled) toast.error('Could not open teaching material', { description: error instanceof Error ? error.message : undefined })
    }).finally(() => { if (!cancelled) setIsLoadingPage(false) })
    return () => { cancelled = true }
  }, [activeId, activePage, activeUpdatedAt, getPageViewUrl])

  if (mode === 'whiteboard' || (!active && !loading)) {
    return <div className="absolute inset-0"><CollaborativeWhiteboard /><MaterialsDrawer /></div>
  }

  if (!active || active.processing_status !== 'ready' || !active.page_count) {
    return <div className="absolute inset-0 flex items-center justify-center bg-[#202124] text-white"><Loader2 className="animate-spin" /></div>
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-[#202124]" data-presentation-stage>
      <div className="absolute inset-0">
        {!url ? <div className="flex h-full items-center justify-center text-white"><Loader2 className="animate-spin" /></div> : (
          <CollaborativeWhiteboard pdfDocument={{
            materialId: active.id,
            url,
            page: displayedPage || active.current_page,
            pageCount: active.page_count,
          }} onPdfRenderStateChange={handlePdfRenderStateChange} onPdfRenderError={(error) => setPageError(error.message)} />
        )}
      </div>
      {(isRenderingPage || isLoadingPage) && <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/35" role="status" aria-live="polite">
        <div className="flex items-center gap-3 rounded-xl bg-[#292a2d]/95 px-4 py-3 text-sm font-semibold text-white shadow-xl">
          <Loader2 size={18} className="animate-spin" /> Rendering page {active.current_page} of {active.page_count}…
        </div>
      </div>}
      {pageError && <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#202124]/80 p-6" role="alert">
        <div className="max-w-sm rounded-2xl bg-white p-5 text-center shadow-2xl">
          <p className="font-semibold text-[#180d62]">This page could not be displayed</p>
          <p className="mt-1 text-sm text-[#716e79]">Check the connection and try again. Your annotations are still safe.</p>
          <button className="mt-4 rounded-xl bg-[#180d62] px-4 py-2 text-sm font-bold text-white" onClick={() => {
            setPageError(null)
            if (activeId && activePage) void getPageViewUrl(activeId, activePage).then(setUrl).catch((error) => setPageError(error instanceof Error ? error.message : 'Could not load this page'))
          }}>
            Try again
          </button>
        </div>
      </div>}
      <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 max-w-[60%] -translate-x-1/2 truncate rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-medium text-white/90">{active.filename}</div>
      {legacySlides.length > 0 && <span className="sr-only">Legacy slide materials remain available for this class.</span>}
      {isHost && <MaterialsDrawer />}
    </div>
  )
}
