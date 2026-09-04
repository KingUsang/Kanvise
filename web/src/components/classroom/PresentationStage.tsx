'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Eraser, Expand,
  FileText, Loader2, Minus, Pencil, Plus, Trash2, Upload, X,
} from 'lucide-react'
import { toast } from 'sonner'
import CollaborativeWhiteboard from './CollaborativeWhiteboard'
import { AnnotationPoint, AnnotationStroke, usePresentationSession } from './presentation-session'
import { nextLocalZoom } from './presentation-state'

type PdfModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs')
type PdfDocument = Awaited<ReturnType<PdfModule['getDocument']>['promise']>

function PdfPage({ url, pageNumber, zoom, onSize }: {
  url: string
  pageNumber: number
  zoom: number
  onSize: (size: { width: number; height: number }) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [document, setDocument] = useState<PdfDocument | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const element = containerRef.current?.parentElement
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width))
    observer.observe(element)
    setContainerWidth(element.clientWidth)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    let loadingTask: ReturnType<PdfModule['getDocument']> | null = null
    void (async () => {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString()
      loadingTask = pdfjs.getDocument({ url })
      const next = await loadingTask.promise
      if (!cancelled) setDocument(next)
    })().catch((error) => {
      if (!cancelled) toast.error('Could not render this PDF', { description: error instanceof Error ? error.message : undefined })
    })
    return () => {
      cancelled = true
      setDocument(null)
      void loadingTask?.destroy()
    }
  }, [url])

  useEffect(() => {
    if (!document || !containerWidth || !canvasRef.current || !textRef.current) return
    let cancelled = false
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null = null
    let textLayer: { cancel: () => void } | null = null
    void (async () => {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
      const page = await document.getPage(pageNumber)
      const natural = page.getViewport({ scale: 1 })
      const available = Math.max(280, containerWidth - 32)
      const scale = (available / natural.width) * zoom
      const viewport = page.getViewport({ scale })
      const canvas = canvasRef.current!
      const textContainer = textRef.current!
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
      canvas.width = Math.floor(viewport.width * dpr)
      canvas.height = Math.floor(viewport.height * dpr)
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`
      const context = canvas.getContext('2d', { alpha: false })!
      renderTask = page.render({ canvas, canvasContext: context, viewport, transform: [dpr, 0, 0, dpr, 0, 0] })
      textContainer.replaceChildren()
      textContainer.style.width = `${viewport.width}px`
      textContainer.style.height = `${viewport.height}px`
      textContainer.style.setProperty('--total-scale-factor', String(scale))
      const content = await page.getTextContent()
      const layer = new pdfjs.TextLayer({ textContentSource: content, container: textContainer, viewport })
      textLayer = layer
      await Promise.all([renderTask.promise, layer.render()])
      if (!cancelled) onSize({ width: viewport.width, height: viewport.height })
    })().catch((error) => {
      if (error?.name !== 'RenderingCancelledException') console.error('PDF page render failed', error)
    })
    return () => { cancelled = true; renderTask?.cancel(); textLayer?.cancel() }
  }, [containerWidth, document, onSize, pageNumber, zoom])

  return (
    <div ref={containerRef} className="relative isolate bg-white shadow-[0_12px_42px_rgba(0,0,0,0.22)]">
      <canvas ref={canvasRef} className="block" aria-label={`PDF page ${pageNumber}`} />
      <div ref={textRef} className="kanvise-pdf-text-layer" />
    </div>
  )
}

function AnnotationLayer({ isHost, page, width, height }: {
  isHost: boolean
  page: number
  width: number
  height: number
}) {
  const { active, remotePointer, saveAnnotations, clearAnnotations, sendPointer } = usePresentationSession()
  const [drawing, setDrawing] = useState<AnnotationStroke | null>(null)
  const [penEnabled, setPenEnabled] = useState(false)
  const layerRef = useRef<SVGSVGElement>(null)
  const lastPointerSent = useRef(0)
  const annotations = active?.annotations[String(page)] || []

  const pointFromEvent = (event: React.PointerEvent<SVGSVGElement>): AnnotationPoint => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    }
  }
  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!isHost || !penEnabled) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrawing({ id: crypto.randomUUID(), color: '#d97706', width: 0.0035, points: [pointFromEvent(event)] })
  }
  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const point = pointFromEvent(event)
    if (isHost && Date.now() - lastPointerSent.current > 45) {
      lastPointerSent.current = Date.now()
      sendPointer(page, point)
    }
    if (drawing && drawing.points.length < 250) setDrawing({ ...drawing, points: [...drawing.points, point] })
  }
  const finish = () => {
    if (!drawing) return
    const finished = drawing
    setDrawing(null)
    if (finished.points.length > 1) void saveAnnotations(page, [...annotations, finished], finished)
  }
  const paths = drawing ? [...annotations, drawing] : annotations
  const toPath = (stroke: AnnotationStroke) => stroke.points.map((point, index) => `${index ? 'L' : 'M'} ${point.x * width} ${point.y * height}`).join(' ')

  return (
    <>
      <svg
        ref={layerRef}
        viewBox={`0 0 ${width} ${height}`}
        className={`absolute inset-0 z-20 h-full w-full touch-none ${isHost && penEnabled ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        aria-label="Tutor PDF annotations"
      >
        {paths.map((stroke) => (
          <path key={stroke.id} d={toPath(stroke)} fill="none" stroke={stroke.color} strokeWidth={Math.max(1.5, stroke.width * width)} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {!isHost && remotePointer?.page === page && (
          <g transform={`translate(${remotePointer.x * width} ${remotePointer.y * height})`}>
            <circle r={7} fill="#d97706" stroke="white" strokeWidth={2} />
            <text x={10} y={4} fontSize={12} fill="#1b1c1c" stroke="white" strokeWidth={3} paintOrder="stroke">Tutor</text>
          </g>
        )}
      </svg>
      {isHost && (
        <div className="absolute left-3 top-3 z-30 flex gap-1 rounded-xl border border-black/10 bg-white/95 p-1 shadow-lg backdrop-blur">
          <button onClick={() => setPenEnabled((value) => !value)} className={`rounded-lg p-2 ${penEnabled ? 'bg-[#180d62] text-white' : 'text-[#52505b] hover:bg-[#f1eff4]'}`} title="Annotate PDF" aria-pressed={penEnabled}>
            <Pencil size={16} />
          </button>
          <button onClick={() => void clearAnnotations(page)} disabled={!annotations.length} className="rounded-lg p-2 text-[#52505b] hover:bg-[#f1eff4] disabled:opacity-35" title="Clear page annotations">
            <Eraser size={16} />
          </button>
        </div>
      )}
    </>
  )
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
    <aside className="absolute inset-y-3 left-3 z-40 flex w-[min(360px,calc(100%-24px))] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl" aria-label="Presentation materials">
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
  )
}

export default function PresentationStage({ isHost }: { isHost: boolean }) {
  const { mode, active, legacySlides, loading, changePage, closePresentation, getViewUrl } = usePresentationSession()
  const [url, setUrl] = useState('')
  const [zoom, setZoom] = useState(1)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const stageRef = useRef<HTMLDivElement>(null)
  const onSize = useCallback((next: { width: number; height: number }) => setSize(next), [])
  const activeId = active?.id
  const activeUpdatedAt = active?.updated_at

  useEffect(() => {
    setUrl('')
    setZoom(1)
    if (!activeId) return
    let cancelled = false
    void getViewUrl(activeId).then((next) => { if (!cancelled) setUrl(next) }).catch((error) => {
      if (!cancelled) toast.error('Could not open teaching material', { description: error instanceof Error ? error.message : undefined })
    })
    return () => { cancelled = true }
  }, [activeId, activeUpdatedAt, getViewUrl])

  if (mode === 'whiteboard' || (!active && !loading)) {
    return <div className="absolute inset-0"><CollaborativeWhiteboard /><MaterialsDrawer /></div>
  }

  if (!active || active.processing_status !== 'ready' || !active.page_count) {
    return <div className="absolute inset-0 flex items-center justify-center bg-[#202124] text-white"><Loader2 className="animate-spin" /></div>
  }

  return (
    <div ref={stageRef} className="absolute inset-0 flex flex-col bg-[#202124]" data-presentation-stage>
      <div className="absolute left-1/2 top-3 z-30 flex max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-1 rounded-xl border border-white/10 bg-[#292a2d]/95 p-1 text-white shadow-xl backdrop-blur">
        <button onClick={() => void changePage(active.current_page - 1)} disabled={active.current_page === 1 || !isHost} className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-35" title="Previous page"><ChevronLeft size={17} /></button>
        <select value={active.current_page} onChange={(event) => void changePage(Number(event.target.value))} disabled={!isHost} className="rounded-lg bg-white/10 px-2 py-1.5 text-xs font-semibold outline-none">
          {Array.from({ length: active.page_count }, (_, index) => <option className="text-black" key={index + 1} value={index + 1}>Page {index + 1} / {active.page_count}</option>)}
        </select>
        <button onClick={() => void changePage(active.current_page + 1)} disabled={active.current_page === active.page_count || !isHost} className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-35" title="Next page"><ChevronRight size={17} /></button>
        <span className="mx-1 h-5 w-px bg-white/15" />
        <button onClick={() => setZoom((value) => nextLocalZoom(value, -.1))} className="rounded-lg p-2 hover:bg-white/10" title="Zoom out"><Minus size={15} /></button>
        <button onClick={() => setZoom(1)} className="min-w-12 rounded-lg px-1 py-2 text-[11px] font-bold hover:bg-white/10" title="Fit to width">{Math.round(zoom * 100)}%</button>
        <button onClick={() => setZoom((value) => nextLocalZoom(value, .1))} className="rounded-lg p-2 hover:bg-white/10" title="Zoom in"><Plus size={15} /></button>
        <button onClick={() => void stageRef.current?.requestFullscreen()} className="rounded-lg p-2 hover:bg-white/10" title="Fullscreen"><Expand size={15} /></button>
        {isHost && <button onClick={() => void closePresentation()} className="rounded-lg p-2 text-red-300 hover:bg-white/10" title="Close presentation"><X size={16} /></button>}
      </div>

      <div className="flex-1 overflow-auto px-4 pb-4 pt-16" data-pdf-scroll-area>
        <div className="mx-auto w-fit">
          {!url ? <div className="flex h-72 w-64 items-center justify-center text-white"><Loader2 className="animate-spin" /></div> : (
            <div className="relative">
              <PdfPage url={url} pageNumber={active.current_page} zoom={zoom} onSize={onSize} />
              {size.width > 0 && <AnnotationLayer isHost={isHost} page={active.current_page} width={size.width} height={size.height} />}
            </div>
          )}
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 max-w-[60%] -translate-x-1/2 truncate rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-medium text-white/90">{active.filename}</div>
      {legacySlides.length > 0 && <span className="sr-only">Legacy slide materials remain available for this class.</span>}
      {isHost && <MaterialsDrawer />}
    </div>
  )
}
