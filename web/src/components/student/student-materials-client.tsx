'use client'

import { Download, File, FileImage, FileText, Presentation, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { StudentMaterial } from '@/lib/student-materials'

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

function FileIcon({ type }: { type: string }) {
  if (type === 'pdf') return <FileText aria-hidden="true" />
  if (type === 'pptx') return <Presentation aria-hidden="true" />
  if (type === 'image') return <FileImage aria-hidden="true" />
  return <File aria-hidden="true" />
}

export function filterMaterials(materials: StudentMaterial[], query: string, course: string, type: string) {
  const normalized = query.trim().toLowerCase()
  return materials.filter(item => (!course || item.course_id === course)
    && (!type || item.file_type === type)
    && (!normalized || item.title.toLowerCase().includes(normalized)
      || item.file_name.toLowerCase().includes(normalized)
      || item.course?.name.toLowerCase().includes(normalized)))
}

export function StudentMaterialsClient({ materials }: { materials: StudentMaterial[] }) {
  const [query, setQuery] = useState('')
  const [course, setCourse] = useState('')
  const [type, setType] = useState('')
  const courses = useMemo(() => [...new Map(materials.flatMap(item => item.course ? [[item.course.id, item.course] as const] : [])).values()], [materials])
  const visible = useMemo(() => filterMaterials(materials, query, course, type), [course, materials, query, type])

  return <main className="mx-auto max-w-[1440px] px-4 py-7 pb-24 sm:px-6 lg:px-10 lg:py-10">
    <header><p className="text-sm font-medium text-[#994704]">Study resources</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Materials</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#716c76]">Find notes, slides, and documents shared for the courses you can access.</p></header>
    <section className="mt-6 grid gap-3 rounded-2xl border border-[#e3ded9] bg-white p-4 sm:grid-cols-2 lg:grid-cols-[minmax(240px,1fr)_220px_180px]"><label className="relative"><span className="sr-only">Search materials</span><Search className="absolute left-3 top-3 text-[#8b858f]" size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search title or file name" className="min-h-11 w-full rounded-xl border border-[#ddd7d2] pl-10 pr-3 text-sm outline-none focus:border-[#2e2877]" /></label><label><span className="sr-only">Filter by course</span><select value={course} onChange={event => setCourse(event.target.value)} className="min-h-11 w-full rounded-xl border border-[#ddd7d2] bg-white px-3 text-sm"><option value="">All courses</option>{courses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span className="sr-only">Filter by file type</span><select value={type} onChange={event => setType(event.target.value)} className="min-h-11 w-full rounded-xl border border-[#ddd7d2] bg-white px-3 text-sm"><option value="">All file types</option><option value="pdf">PDF</option><option value="docx">Word</option><option value="pptx">PowerPoint</option><option value="image">Image</option></select></label></section>
    {visible.length ? <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visible.map(item => <article key={item.id} className="flex rounded-2xl border border-[#e3ded9] bg-white p-5"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#f0edff] text-[#2e2877]"><FileIcon type={item.file_type} /></span><div className="ml-4 min-w-0 flex-1"><p className="text-[11px] font-semibold uppercase tracking-wide text-[#994704]">{item.course?.name || 'Course'}</p><h2 className="mt-1 line-clamp-2 font-semibold leading-5">{item.title}</h2>{item.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#716c76]">{item.description}</p>}<p className="mt-3 truncate text-xs text-[#8b858f]">{item.file_name} · {fileSize(item.file_size_bytes)}</p><p className="mt-1 text-xs text-[#8b858f]">Shared {new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(item.created_at))}</p><a href={item.download_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#2e2877] px-4 text-sm font-semibold text-white"><Download size={16} />Download</a></div></article>)}</section>
      : <section className="mt-6 rounded-2xl border border-[#e3ded9] bg-white py-14 text-center"><FileText className="mx-auto text-[#aaa4ad]" /><h2 className="mt-4 text-lg font-semibold">No materials found</h2><p className="mt-1 text-sm text-[#716c76]">Try another filter, or check back after your tutor shares a resource.</p></section>}
  </main>
}
