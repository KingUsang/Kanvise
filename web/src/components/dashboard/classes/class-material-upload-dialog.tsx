'use client'

import { useEffect, useRef, useState } from 'react'
import { FileText, UploadCloud, Video, X } from 'lucide-react'
import { toast } from 'sonner'
import { titleFromFileName, uploadFileWithProgress } from '@/lib/upload-with-progress'

type Subject = { id: string; name: string }

const documentTypes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
])
const videoTypes = new Set(['video/mp4', 'video/webm', 'video/quicktime'])
const maxDocumentBytes = 50 * 1024 * 1024
const maxVideoBytes = 500 * 1024 * 1024

export function ClassMaterialUploadDialog({
  open,
  onClose,
  subjects,
  initialSubjectId,
  api,
  token,
  onUploaded,
}: {
  open: boolean
  onClose: () => void
  subjects: Subject[]
  initialSubjectId?: string | null
  api: string | undefined
  token: string
  onUploaded: () => Promise<void> | void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [subjectId, setSubjectId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [stage, setStage] = useState<'idle' | 'uploading' | 'saving'>('idle')

  useEffect(() => {
    if (!open) return
    setSubjectId(initialSubjectId || (subjects.length === 1 ? subjects[0].id : ''))
    setFile(null)
    setTitle('')
    setDescription('')
    setProgress(null)
    setStage('idle')
  }, [initialSubjectId, open, subjects])

  if (!open) return null

  const chooseFile = (nextFile: File) => {
    const isVideo = videoTypes.has(nextFile.type)
    if (!isVideo && !documentTypes.has(nextFile.type)) {
      toast.error('Choose a PDF, DOCX, PPTX, JPG, PNG, MP4, WebM, or MOV file.')
      return
    }
    if (nextFile.size > (isVideo ? maxVideoBytes : maxDocumentBytes)) {
      toast.error(isVideo ? 'Videos must be 500 MB or smaller.' : 'Files must be 50 MB or smaller.')
      return
    }
    setFile(nextFile)
    setTitle(titleFromFileName(nextFile.name))
  }

  const submit = async () => {
    if (!subjectId) return toast.error('Choose the subject for this material.')
    if (!file) return toast.error('Choose a file to upload.')
    if (!title.trim()) return toast.error('Add a title students will recognise.')
    if (!api) return toast.error('Materials service is unavailable. Refresh and try again.')
    try {
      setStage('uploading')
      setProgress(0)
      const presign = await fetch(`${api}/storage/presign/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          file_name: file.name,
          content_type: file.type,
          file_size_bytes: file.size,
          entity_type: 'note',
          course_id: subjectId,
        }),
      })
      const presignBody = await presign.json().catch(() => null)
      if (!presign.ok) throw new Error(presignBody?.error || 'Could not prepare this upload')
      await uploadFileWithProgress(presignBody.data.presigned_url, file, setProgress)
      setStage('saving')
      const create = await fetch(`${api}/notes/${subjectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          file_key: presignBody.data.file_key,
          file_name: file.name,
          file_type: file.type,
          file_size_bytes: file.size,
        }),
      })
      const createBody = await create.json().catch(() => null)
      if (!create.ok) throw new Error(createBody?.error || 'Could not save this material')
      await onUploaded()
      toast.success('Material added to this subject')
      onClose()
    } catch (error) {
      toast.error('Could not add material', { description: error instanceof Error ? error.message : 'Try again.' })
    } finally {
      setStage('idle')
      setProgress(null)
    }
  }

  const uploading = stage !== 'idle'
  const isVideo = Boolean(file && videoTypes.has(file.type))
  return <div className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-[#180d62]/25 p-3 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="add-material-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !uploading) onClose() }}>
    <div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:max-h-[calc(100dvh-2rem)] sm:p-6 sm:pb-6">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-dashboard-accent">Class material</p><h2 id="add-material-title" className="mt-1 text-xl font-bold text-[#180d62]">Upload material</h2><p className="mt-1 text-sm leading-6 text-dashboard-muted">Attach it to one subject in this class.</p></div><button type="button" onClick={onClose} disabled={uploading} aria-label="Close" className="rounded-lg p-2 text-[#625e69] hover:bg-[#f1efff] disabled:opacity-50"><X size={20}/></button></div>
      <div className="mt-5 space-y-4">
        <label className="block text-sm font-bold text-[#27242d]">Subject <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} disabled={uploading || subjects.length === 1} className="mt-2 w-full rounded-lg border border-dashboard-outline bg-white px-3 py-2.5 text-sm font-medium outline-none focus:border-[#312783] focus:ring-4 focus:ring-[#312783]/10"><option value="" disabled>Choose subject</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
        <input ref={inputRef} type="file" className="hidden" accept=".pdf,.docx,.pptx,.jpg,.jpeg,.png,.mp4,.webm,.mov,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/jpeg,image/png,video/mp4,video/webm,video/quicktime" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) chooseFile(selected); event.currentTarget.value = '' }} />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="flex min-h-36 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#b8b0f2] bg-[#faf9ff] px-5 text-center hover:border-[#5146c7] hover:bg-[#f5f3ff] disabled:opacity-60"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#5146c7] shadow-sm">{isVideo ? <Video size={20}/> : <UploadCloud size={20}/>}</span><span className="mt-3 font-bold text-[#2e2877]">{file ? file.name : 'Choose a file'}</span><span className="mt-1 text-xs text-[#716c76]">PDF, DOCX, PPTX, JPG or PNG up to 50 MB · MP4, WebM or MOV up to 500 MB</span></button>
        <label className="block text-sm font-bold text-[#27242d]">Title <input value={title} onChange={(event) => setTitle(event.target.value)} disabled={uploading} className="mt-2 w-full rounded-lg border border-dashboard-outline px-3 py-2.5 text-sm font-normal outline-none focus:border-[#312783] focus:ring-4 focus:ring-[#312783]/10" placeholder="Filled from the filename" /></label>
        <label className="block text-sm font-bold text-[#27242d]">Description <span className="font-normal text-dashboard-muted">(optional)</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} disabled={uploading} rows={3} className="mt-2 w-full resize-none rounded-lg border border-dashboard-outline px-3 py-2.5 text-sm font-normal outline-none focus:border-[#312783] focus:ring-4 focus:ring-[#312783]/10" placeholder="What should students know about this material?" /></label>
        {uploading ? <div className="rounded-lg bg-[#f1efff] px-4 py-3"><div className="flex items-center justify-between gap-3 text-sm font-semibold text-[#312783]"><span>{stage === 'saving' ? 'Saving material…' : 'Uploading material…'}</span>{stage === 'uploading' && progress !== null ? <span>{progress}%</span> : null}</div>{stage === 'uploading' && progress !== null ? <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#ddd9f5]"><div className="h-full rounded-full bg-[#5146c7] transition-[width]" style={{ width: `${progress}%` }}/></div> : null}</div> : null}
      </div>
      <div className="mt-6 flex justify-end gap-3 border-t border-dashboard-outline pt-5"><button type="button" onClick={onClose} disabled={uploading} className="rounded-lg px-4 py-2.5 text-sm font-bold text-[#625e69] hover:bg-[#f5f3f2]">Cancel</button><button type="button" onClick={() => void submit()} disabled={uploading || !file || !subjectId || !title.trim()} className="inline-flex items-center gap-2 rounded-lg bg-[#312783] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#241c70] disabled:opacity-50"><FileText size={17}/>{uploading ? 'Uploading…' : 'Add material'}</button></div>
    </div>
  </div>
}
