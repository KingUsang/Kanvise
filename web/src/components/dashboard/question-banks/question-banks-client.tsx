'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { getApiUrl } from '@/config/api'
import katex from 'katex'
import 'katex/contrib/mhchem'

type Bank = {
  id: string
  owner_id: string
  name: string
  description: string | null
  visibility: 'private' | 'centre'
  question_count: number
  can_edit: boolean
  updated_at: string
}

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'equation' | 'chemistry'; latex: string }
  | { type: 'image'; media_id: string; alt_text: string; url?: string; width?: number | null; height?: number | null }

type Question = {
  id: string
  author_id: string
  question_type: 'mcq' | 'theory'
  subject_name: string | null
  topic: string | null
  current_version: {
    id: string
    plain_text: string
    content_blocks: ContentBlock[]
    marks: number
    options: Array<{ id: string; plain_text: string; is_correct: boolean; order_index: number }>
  }
}

type Course = { id: string; name: string }

type ApiError = { error?: string; details?: string[] }

async function responseBody<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = body as ApiError
    throw new Error(error.details?.join('. ') || error.error || 'Something went wrong')
  }
  return body as T
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'QB'
}

function formattedDate(value: string) {
  return new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

function ScientificBlock({ block }: { block: Extract<ContentBlock, { type: 'equation' | 'chemistry' }> }) {
  const html = useMemo(() => katex.renderToString(block.latex, {
    displayMode: true,
    throwOnError: false,
    strict: false,
    trust: false,
    output: 'htmlAndMathml',
  }), [block.latex])
  return <div className="mt-2 overflow-x-auto rounded-md bg-[#f6f3f1] px-3 py-3 text-[#29262f]" dangerouslySetInnerHTML={{ __html: html }} />
}

function QuestionImage({ block }: { block: Extract<ContentBlock, { type: 'image' }> }) {
  if (!block.url) return <div className="mt-2 rounded-lg border border-dashed border-[#d0cbc7] bg-[#f8f5f3] p-4 text-sm text-[#6d6873]">Image preview is temporarily unavailable.</div>
  return <figure className="mt-3 overflow-hidden rounded-lg border border-[#dfdbd8] bg-[#f8f6f4] p-2">
    {/* Signed R2 URLs expire and use a deployment-specific host, so Next Image cannot safely optimize them. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={block.url} alt={block.alt_text} width={block.width || undefined} height={block.height || undefined} className="max-h-[420px] w-auto max-w-full rounded-md object-contain" />
    <figcaption className="px-1 pb-1 pt-2 text-xs text-[#706b76]">{block.alt_text}</figcaption>
  </figure>
}

export function buildQuestionOptions(options: string[], correctOption: number) {
  return options
    .map((option, originalIndex) => ({ option: option.trim(), originalIndex }))
    .filter(item => item.option)
    .map(({ option, originalIndex }) => ({
      plain_text: option,
      content_blocks: [{ type: 'text' as const, text: option }],
      is_correct: originalIndex === correctOption,
    }))
}

export function buildQuestionContent(plainText: string, blockType: 'none' | 'equation' | 'chemistry', latex: string): ContentBlock[] {
  const blocks: ContentBlock[] = []
  if (plainText.trim()) blocks.push({ type: 'text', text: plainText.trim() })
  if (blockType !== 'none' && latex.trim()) blocks.push({ type: blockType, latex: latex.trim() })
  return blocks
}

function imageDimensions(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read this image'))
    }
    image.src = url
  })
}

export function QuestionBanksClient({ token }: { token: string }) {
  const apiUrl = getApiUrl()
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])
  const [banks, setBanks] = useState<Bank[]>([])
  const [selectedBankId, setSelectedBankId] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [isLoadingBanks, setIsLoadingBanks] = useState(true)
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false)
  const [search, setSearch] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('')
  const [showCreateBank, setShowCreateBank] = useState(false)
  const [showQuestionEditor, setShowQuestionEditor] = useState(false)
  const [bankToArchive, setBankToArchive] = useState<Bank | null>(null)

  const selectedBank = banks.find(bank => bank.id === selectedBankId) || null

  const loadBanks = useCallback(async () => {
    setIsLoadingBanks(true)
    try {
      const response = await fetch(`${apiUrl}/question-banks?page_size=100`, { headers })
      const body = await responseBody<{ data: Bank[] }>(response)
      setBanks(body.data)
      setSelectedBankId(current => body.data.some(bank => bank.id === current) ? current : body.data[0]?.id || '')
    } catch (error) {
      toast.error('Could not load question banks', { description: error instanceof Error ? error.message : 'Please try again.' })
    } finally {
      setIsLoadingBanks(false)
    }
  }, [apiUrl, headers])

  const loadQuestions = useCallback(async () => {
    if (!selectedBankId) {
      setQuestions([])
      return
    }
    setIsLoadingQuestions(true)
    try {
      const params = new URLSearchParams({ page_size: '100' })
      if (search.trim()) params.set('q', search.trim())
      if (subjectFilter) params.set('subject_name', subjectFilter)
      const response = await fetch(`${apiUrl}/question-banks/${selectedBankId}/questions?${params}`, { headers })
      const body = await responseBody<{ data: Question[] }>(response)
      setQuestions(body.data)
    } catch (error) {
      toast.error('Could not load questions', { description: error instanceof Error ? error.message : 'Please try again.' })
    } finally {
      setIsLoadingQuestions(false)
    }
  }, [apiUrl, headers, search, selectedBankId, subjectFilter])

  useEffect(() => { void loadBanks() }, [loadBanks])
  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadQuestions() }, 250)
    return () => window.clearTimeout(timeout)
  }, [loadQuestions])
  useEffect(() => {
    fetch(`${apiUrl}/courses`, { headers }).then(responseBody<{ data: Course[] }>).then(body => setCourses(body.data || [])).catch(() => undefined)
  }, [apiUrl, headers])

  const subjects = [...new Set(questions.map(question => question.subject_name).filter(Boolean))] as string[]

  async function createBank(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      const response = await fetch(`${apiUrl}/question-banks`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          description: form.get('description'),
          visibility: form.get('visibility'),
        }),
      })
      const body = await responseBody<{ data: Bank }>(response)
      toast.success('Question bank created')
      setShowCreateBank(false)
      await loadBanks()
      setSelectedBankId(body.data.id)
    } catch (error) {
      toast.error('Could not create the bank', { description: error instanceof Error ? error.message : 'Please try again.' })
    }
  }

  async function archiveBank() {
    if (!bankToArchive) return
    try {
      const response = await fetch(`${apiUrl}/question-banks/${bankToArchive.id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      })
      await responseBody(response)
      toast.success('Question bank archived', { description: 'Published mocks and their question versions remain unchanged.' })
      setBankToArchive(null)
      await loadBanks()
    } catch (error) {
      toast.error('Could not archive the bank', { description: error instanceof Error ? error.message : 'Please try again.' })
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 bg-[#fbf9f8] p-4 md:p-8 lg:p-10">
      <header className="mb-7 flex flex-col gap-4 border-b border-[#e4e2e1] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#994704]">Mock preparation</p>
          <h1 className="text-[30px] font-bold leading-tight tracking-tight text-[#1b1c1c] md:text-[34px]">Question Banks</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f5c67] md:text-base">Keep your best questions in one place, share useful ones with tutors in your centre, and reuse them when building mocks.</p>
        </div>
        <button onClick={() => setShowCreateBank(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#994704] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#7a3903]">
          <span className="material-symbols-outlined text-xl">create_new_folder</span>Create a bank
        </button>
      </header>

      <div className="grid min-h-[620px] gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-[#dedbd8] bg-white p-3 shadow-[0_4px_20px_rgba(61,61,61,0.05)]">
          <div className="flex items-center justify-between px-2 pb-3 pt-1">
            <h2 className="text-sm font-semibold text-[#1b1c1c]">Your collections</h2>
            <span className="rounded-full bg-[#f3eee9] px-2 py-1 text-xs font-semibold text-[#744018]">{banks.length}</span>
          </div>
          <div className="space-y-2" aria-live="polite">
            {isLoadingBanks ? [0, 1, 2].map(item => <div key={item} className="h-20 animate-pulse rounded-lg bg-[#f4f1ef]" />) : banks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#c8c5d2] px-4 py-8 text-center">
                <span className="material-symbols-outlined text-3xl text-[#8b8792]">inventory_2</span>
                <p className="mt-2 text-sm font-semibold text-[#33313a]">No question banks yet</p>
                <p className="mt-1 text-xs leading-5 text-[#6d6974]">Create a private bank for yourself or a centre bank your tutors can use.</p>
              </div>
            ) : banks.map(bank => (
              <button key={bank.id} onClick={() => setSelectedBankId(bank.id)} className={`w-full rounded-lg border p-3 text-left transition ${selectedBankId === bank.id ? 'border-[#8f6b4b] bg-[#f8f3ed] shadow-sm' : 'border-transparent hover:border-[#e4e0dc] hover:bg-[#faf8f6]'}`}>
                <div className="flex items-start gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${bank.visibility === 'centre' ? 'bg-[#e8e6ff] text-[#2e2877]' : 'bg-[#f3e8df] text-[#8a440e]'}`}>{initials(bank.name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[#27252d]">{bank.name}</span>
                    <span className="mt-1 flex items-center gap-1 text-xs text-[#6d6974]"><span className="material-symbols-outlined text-sm">{bank.visibility === 'centre' ? 'groups' : 'lock'}</span>{bank.visibility === 'centre' ? 'Centre bank' : 'Private'} · {bank.question_count} questions</span>
                  </span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="min-w-0 rounded-xl border border-[#dedbd8] bg-white shadow-[0_4px_20px_rgba(61,61,61,0.05)]">
          {!selectedBank ? (
            <div className="flex min-h-[520px] flex-col items-center justify-center px-6 text-center">
              <span className="material-symbols-outlined rounded-full bg-[#f3efec] p-4 text-4xl text-[#77727e]">library_add</span>
              <h2 className="mt-4 text-xl font-semibold text-[#27252d]">Create your first question bank</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-[#6d6974]">Banks help you reuse questions instead of typing the same content for every mock.</p>
            </div>
          ) : (
            <>
              <div className="border-b border-[#e6e2df] p-5 md:p-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold text-[#1b1c1c] md:text-2xl">{selectedBank.name}</h2>
                      <span className="rounded-full bg-[#f3efec] px-2.5 py-1 text-[11px] font-semibold text-[#5f5b66]">{selectedBank.visibility === 'centre' ? 'Shared with centre' : 'Only you'}</span>
                    </div>
                    <p className="mt-1 text-sm text-[#6d6974]">{selectedBank.description || `Updated ${formattedDate(selectedBank.updated_at)}`}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedBank.can_edit && <button onClick={() => setBankToArchive(selectedBank)} className="min-h-10 rounded-lg border border-[#d5d1ce] px-3.5 text-sm font-semibold text-[#625e69] hover:bg-[#f7f4f2]">Archive</button>}
                    <button onClick={() => setShowQuestionEditor(true)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#2e2877] px-4 text-sm font-semibold text-white hover:bg-[#211c60]"><span className="material-symbols-outlined text-lg">add</span>Add question</button>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px]">
                  <label className="relative block">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-xl text-[#77727e]">search</span>
                    <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search question wording…" className="h-11 w-full rounded-lg border border-[#cbc7c4] bg-white pl-10 pr-3 text-sm text-[#27252d] outline-none focus:border-[#2e2877] focus:ring-2 focus:ring-[#2e2877]/10" />
                  </label>
                  <select value={subjectFilter} onChange={event => setSubjectFilter(event.target.value)} className="h-11 rounded-lg border border-[#cbc7c4] bg-white px-3 text-sm text-[#38353f] outline-none focus:border-[#2e2877]">
                    <option value="">All subjects</option>
                    {subjects.map(subject => <option key={subject} value={subject}>{subject}</option>)}
                  </select>
                </div>
              </div>

              <div className="divide-y divide-[#ebe7e4]">
                {isLoadingQuestions ? [0, 1, 2].map(item => <div key={item} className="m-5 h-24 animate-pulse rounded-lg bg-[#f5f2f0]" />) : questions.length === 0 ? (
                  <div className="flex min-h-[340px] flex-col items-center justify-center px-6 text-center">
                    <span className="material-symbols-outlined text-4xl text-[#8a8590]">quiz</span>
                    <h3 className="mt-3 text-lg font-semibold text-[#2b2931]">{search || subjectFilter ? 'No matching questions' : 'This bank is ready for questions'}</h3>
                    <p className="mt-1 max-w-sm text-sm leading-6 text-[#706c76]">{search || subjectFilter ? 'Try a different word or clear the subject filter.' : 'Add a question once, then reuse it across as many mocks as you need.'}</p>
                    {!search && !subjectFilter && <button onClick={() => setShowQuestionEditor(true)} className="mt-5 rounded-lg bg-[#994704] px-4 py-2.5 text-sm font-semibold text-white">Add the first question</button>}
                  </div>
                ) : questions.map((question, index) => (
                  <article key={question.id} className="p-5 transition hover:bg-[#fcfaf8] md:p-6">
                    <div className="flex items-start gap-4">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eeeafa] text-xs font-bold text-[#2e2877]">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap gap-2">
                          <span className="rounded bg-[#f1efed] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#5f5b66]">{question.question_type === 'mcq' ? 'Multiple choice' : 'Theory'}</span>
                          {question.subject_name && <span className="rounded bg-[#fff0e3] px-2 py-1 text-[10px] font-semibold text-[#8a440e]">{question.subject_name}</span>}
                          {question.topic && <span className="rounded bg-[#edf4ed] px-2 py-1 text-[10px] font-semibold text-[#35643a]">{question.topic}</span>}
                        </div>
                        <p className="whitespace-pre-wrap text-[15px] font-medium leading-6 text-[#29262f]">{question.current_version.plain_text || 'Rich-media question'}</p>
                        {question.current_version.content_blocks.map((block, blockIndex) => block.type === 'equation' || block.type === 'chemistry'
                          ? <ScientificBlock key={blockIndex} block={block} />
                          : block.type === 'image' ? <QuestionImage key={blockIndex} block={block} /> : null)}
                        <div className="mt-3 flex items-center gap-3 text-xs text-[#77727e]"><span>{question.current_version.marks} {question.current_version.marks === 1 ? 'mark' : 'marks'}</span><span>•</span><span>{question.question_type === 'mcq' ? `${question.current_version.options.length} options` : 'Tutor graded'}</span></div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      {showCreateBank && <BankDialog onClose={() => setShowCreateBank(false)} onSubmit={createBank} />}
      {showQuestionEditor && selectedBank && <QuestionDialog bank={selectedBank} courses={courses} token={token} apiUrl={apiUrl} onClose={() => setShowQuestionEditor(false)} onCreated={async () => { setShowQuestionEditor(false); await Promise.all([loadBanks(), loadQuestions()]) }} />}
      {bankToArchive && <ConfirmDialog title="Archive this question bank?" description={`${bankToArchive.name} will leave the active list. Questions already used in published mocks stay unchanged.`} confirmLabel="Archive bank" onCancel={() => setBankToArchive(null)} onConfirm={archiveBank} />}
    </main>
  )
}

function BankDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" role="dialog" aria-modal="true" aria-labelledby="create-bank-title">
    <form onSubmit={onSubmit} className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
      <h2 id="create-bank-title" className="text-xl font-bold text-[#25222b]">Create a question bank</h2>
      <p className="mt-1 text-sm leading-6 text-[#696570]">Use a private bank for your own questions or let tutors in your centre reuse a shared bank.</p>
      <label className="mt-5 block text-sm font-semibold text-[#3e3a45]">Bank name<input name="name" required maxLength={160} autoFocus placeholder="e.g. JAMB Physics — Mechanics" className="mt-2 h-11 w-full rounded-lg border border-[#cbc7c4] px-3 font-normal outline-none focus:border-[#2e2877]" /></label>
      <label className="mt-4 block text-sm font-semibold text-[#3e3a45]">Short description <span className="font-normal text-[#7a7580]">(optional)</span><textarea name="description" rows={3} placeholder="What kinds of questions belong here?" className="mt-2 w-full rounded-lg border border-[#cbc7c4] px-3 py-2 font-normal outline-none focus:border-[#2e2877]" /></label>
      <fieldset className="mt-4"><legend className="text-sm font-semibold text-[#3e3a45]">Who can use it?</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="flex cursor-pointer gap-3 rounded-lg border border-[#d9d5d2] p-3"><input type="radio" name="visibility" value="private" defaultChecked className="mt-1 accent-[#2e2877]" /><span><strong className="block text-sm text-[#302d36]">Only me</strong><span className="text-xs leading-5 text-[#716d77]">Keep it private while you build.</span></span></label>
        <label className="flex cursor-pointer gap-3 rounded-lg border border-[#d9d5d2] p-3"><input type="radio" name="visibility" value="centre" className="mt-1 accent-[#2e2877]" /><span><strong className="block text-sm text-[#302d36]">My centre</strong><span className="text-xs leading-5 text-[#716d77]">Tutors can find and reuse it.</span></span></label>
      </div></fieldset>
      <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-[#625e69]">Cancel</button><button className="rounded-lg bg-[#994704] px-5 py-2.5 text-sm font-semibold text-white">Create bank</button></div>
    </form>
  </div>
}

function QuestionDialog({ bank, courses, token, apiUrl, onClose, onCreated }: { bank: Bank; courses: Course[]; token: string; apiUrl: string; onClose: () => void; onCreated: () => void }) {
  const [type, setType] = useState<'mcq' | 'theory'>('mcq')
  const [options, setOptions] = useState(['', '', '', ''])
  const [correctOption, setCorrectOption] = useState(0)
  const [extraBlock, setExtraBlock] = useState<'none' | 'equation' | 'chemistry'>('none')
  const [latex, setLatex] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageAltText, setImageAltText] = useState('')
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [examSubject, setExamSubject] = useState('')

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl('')
      return
    }
    const url = URL.createObjectURL(imageFile)
    setImagePreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  function chooseImage(file: File | null) {
    if (!file) return setImageFile(null)
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Choose a JPG, PNG, or WebP image')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Question images must be 10 MB or smaller')
      return
    }
    setImageFile(file)
  }

  async function uploadQuestionImage() {
    if (!imageFile) return null
    if (!imageAltText.trim()) throw new Error('Describe the image for students who cannot see it')
    const dimensions = await imageDimensions(imageFile)
    const presignResponse = await fetch(`${apiUrl}/storage/presign/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity_type: 'question_media', bank_id: bank.id,
        file_name: imageFile.name, content_type: imageFile.type, file_size_bytes: imageFile.size,
      }),
    })
    const presign = await responseBody<{ data: { presigned_url: string; file_key: string } }>(presignResponse)
    const uploadResponse = await fetch(presign.data.presigned_url, {
      method: 'PUT', headers: { 'Content-Type': imageFile.type }, body: imageFile,
    })
    if (!uploadResponse.ok) throw new Error('The image could not be uploaded to storage')
    const confirmResponse = await fetch(`${apiUrl}/question-banks/media/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bank_id: bank.id, file_key: presign.data.file_key, file_name: imageFile.name,
        content_type: imageFile.type, file_size_bytes: imageFile.size,
        alt_text: imageAltText.trim(), ...dimensions,
      }),
    })
    const registered = await responseBody<{ data: { id: string; alt_text: string; width: number; height: number } }>(confirmResponse)
    return registered.data
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const plainText = String(form.get('plain_text') || '').trim()
    const normalizedLatex = String(form.get('latex') || '').trim()
    const nonEmptyOptionCount = options.map(value => value.trim()).filter(Boolean).length
    if (!plainText && !imageFile && !normalizedLatex) return toast.error('Add question text, an image, or scientific notation')
    if (type === 'mcq' && nonEmptyOptionCount < 2) return toast.error('Add at least two answer options')
    if (type === 'mcq' && !options[correctOption]?.trim()) return toast.error('Choose a completed option as the correct answer')
    setIsSaving(true)
    try {
      const contentBlocks = buildQuestionContent(plainText, extraBlock, normalizedLatex)
      const registeredImage = await uploadQuestionImage()
      if (registeredImage) contentBlocks.push({
        type: 'image', media_id: registeredImage.id, alt_text: registeredImage.alt_text,
        width: registeredImage.width, height: registeredImage.height,
      })
      const response = await fetch(`${apiUrl}/question-banks/${bank.id}/questions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_type: type,
          plain_text: plainText,
          content_blocks: contentBlocks,
          explanation_blocks: form.get('explanation') ? [{ type: 'text', text: String(form.get('explanation')) }] : [],
          grading_rubric_blocks: [],
          marks: Number(form.get('marks')),
          course_id: form.get('course_id') || null,
          subject_name: form.get('subject_name') || null,
          topic: form.get('topic') || null,
          options: type === 'mcq' ? buildQuestionOptions(options, correctOption) : [],
        }),
      })
      await responseBody(response)
      toast.success('Question added', { description: 'You can now reuse it in any mock linked to this bank.' })
      await onCreated()
    } catch (error) {
      toast.error('Could not add the question', { description: error instanceof Error ? error.message : 'Please try again.' })
    } finally {
      setIsSaving(false)
    }
  }

  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4 md:p-8" role="dialog" aria-modal="true" aria-labelledby="question-editor-title">
    <form onSubmit={submit} className="mx-auto w-full max-w-3xl rounded-xl bg-white shadow-2xl">
      <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[#e5e1de] bg-white px-5 py-4 md:px-7"><div><h2 id="question-editor-title" className="text-xl font-bold text-[#24212a]">Add to {bank.name}</h2><p className="mt-1 text-sm text-[#6e6974]">This creates version 1. Future edits create a new version.</p></div><button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-[#696570] hover:bg-[#f2efed]"><span className="material-symbols-outlined">close</span></button></div>
      <div className="space-y-5 p-5 md:p-7">
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-[#3b3742]">Question type<select value={type} onChange={event => { const value = event.target.value; if (value === 'mcq' || value === 'theory') setType(value) }} className="mt-2 h-11 w-full rounded-lg border border-[#cbc7c4] bg-white px-3 font-normal"><option value="mcq">Multiple choice</option><option value="theory">Theory / written answer</option></select></label><label className="text-sm font-semibold text-[#3b3742]">Marks<input name="marks" type="number" min="0.01" max="10000" step="0.01" defaultValue="1" required className="mt-2 h-11 w-full rounded-lg border border-[#cbc7c4] px-3 font-normal" /></label></div>
        <label className="block text-sm font-semibold text-[#3b3742]">Question text <span className="font-normal text-[#77727e]">(optional for image-only questions)</span><textarea name="plain_text" rows={4} placeholder="Write the question exactly as students should see it." className="mt-2 w-full rounded-lg border border-[#cbc7c4] px-3 py-3 font-normal leading-6 outline-none focus:border-[#2e2877]" /></label>
        <div className="rounded-lg border border-[#dfdbd8] bg-[#faf8f6] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="text-sm font-semibold text-[#3b3742]">Question image <span className="font-normal text-[#77727e]">(optional)</span></h3><p className="mt-1 text-xs leading-5 text-[#77727e]">Use this for diagrams, graphs, maps, circuits, or an image-only question. JPG, PNG, or WebP; maximum 10 MB.</p></div>{imageFile && <button type="button" onClick={() => { setImageFile(null); setImageAltText('') }} className="text-xs font-semibold text-[#994704]">Remove image</button>}</div>
          <label className="mt-3 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[#aaa4ad] bg-white px-4 py-3 text-sm font-semibold text-[#4f4a55] hover:border-[#2e2877]"><span className="material-symbols-outlined">add_photo_alternate</span>{imageFile ? 'Choose a different image' : 'Choose an image'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={event => chooseImage(event.target.files?.[0] || null)} /></label>
          {imagePreviewUrl && <div className="mt-4 grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]"><div className="rounded-lg border border-[#ddd8d5] bg-white p-2">
            {/* Local object URLs cannot be handled by Next Image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreviewUrl} alt="Local preview" className="max-h-40 w-full rounded object-contain" />
          </div><label className="text-sm font-semibold text-[#3b3742]">Describe the image for accessibility<textarea value={imageAltText} onChange={event => setImageAltText(event.target.value)} required rows={3} placeholder="e.g. A velocity-time graph rising steadily from 0 to 20 m/s" className="mt-2 w-full rounded-lg border border-[#cbc7c4] px-3 py-2 font-normal leading-5" /><span className="mt-1 block text-xs font-normal text-[#77727e]">Describe the information a student needs—not merely “an image”.</span></label></div>}
        </div>
        <div className="rounded-lg border border-[#dfdbd8] bg-[#faf8f6] p-4"><label className="text-sm font-semibold text-[#3b3742]">Scientific notation <span className="font-normal text-[#77727e]">(optional)</span><select value={extraBlock} onChange={event => { const value = event.target.value; if (value === 'none' || value === 'equation' || value === 'chemistry') { setExtraBlock(value); setLatex('') } }} className="mt-2 h-10 w-full rounded-lg border border-[#cbc7c4] bg-white px-3 font-normal"><option value="none">No equation block</option><option value="equation">Mathematical equation</option><option value="chemistry">Chemical equation or formula</option></select></label>{extraBlock !== 'none' && <><label className="mt-3 block text-sm font-semibold text-[#3b3742]">LaTeX / {extraBlock === 'chemistry' ? 'mhchem' : 'math'} notation<input name="latex" required value={latex} onChange={event => setLatex(event.target.value)} placeholder={extraBlock === 'chemistry' ? '\\ce{2H2 + O2 -> 2H2O}' : '\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}'} className="mt-2 h-11 w-full rounded-lg border border-[#cbc7c4] bg-white px-3 font-mono text-sm font-normal" /></label>{extraBlock === 'equation' && <p className="mt-1 text-xs text-[#77727e]">For example, use <code>v = f \\lambda</code> to display v = f λ.</p>}{latex.trim() && <div className="mt-3"><span className="text-xs font-semibold uppercase tracking-wider text-[#77727e]">Student preview</span><ScientificBlock block={{ type: extraBlock, latex }} /></div>}</>}</div>
        {type === 'mcq' && <fieldset><legend className="text-sm font-semibold text-[#3b3742]">Answer options</legend><p className="mt-1 text-xs text-[#77727e]">Select the circle beside the correct answer.</p><div className="mt-3 space-y-2">{options.map((option, index) => <div key={index} className="flex items-center gap-3"><input type="radio" name="correct" checked={correctOption === index} onChange={() => setCorrectOption(index)} aria-label={`Mark option ${index + 1} as correct`} className="h-4 w-4 accent-[#2e2877]" /><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#f0edeb] text-xs font-bold text-[#58535e]">{String.fromCharCode(65 + index)}</span><input value={option} onChange={event => setOptions(values => values.map((value, position) => position === index ? event.target.value : value))} placeholder={`Option ${String.fromCharCode(65 + index)}`} className="h-10 min-w-0 flex-1 rounded-lg border border-[#cbc7c4] px-3 text-sm" /></div>)}</div></fieldset>}
        <div className="grid gap-4 sm:grid-cols-3"><label className="text-sm font-semibold text-[#3b3742]">Programme subject<select name="course_id" onChange={event => { const selected = courses.find(course => course.id === event.target.value); if (selected) setExamSubject(selected.name) }} className="mt-2 h-11 w-full rounded-lg border border-[#cbc7c4] bg-white px-3 font-normal"><option value="">No programme subject yet</option>{courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label><label className="text-sm font-semibold text-[#3b3742]">Exam subject<input name="subject_name" value={examSubject} onChange={event => setExamSubject(event.target.value)} placeholder="e.g. Physics" className="mt-2 h-11 w-full rounded-lg border border-[#cbc7c4] px-3 font-normal" /></label><label className="text-sm font-semibold text-[#3b3742]">Topic<input name="topic" placeholder="e.g. Motion" className="mt-2 h-11 w-full rounded-lg border border-[#cbc7c4] px-3 font-normal" /></label></div>
        <label className="block text-sm font-semibold text-[#3b3742]">Answer explanation <span className="font-normal text-[#77727e]">(optional)</span><textarea name="explanation" rows={3} placeholder="Students may see this after results are released." className="mt-2 w-full rounded-lg border border-[#cbc7c4] px-3 py-2 font-normal" /></label>
      </div>
      <div className="sticky bottom-0 flex justify-end gap-3 border-t border-[#e5e1de] bg-white px-5 py-4 md:px-7"><button type="button" onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-[#625e69]">Cancel</button><button disabled={isSaving} className="rounded-lg bg-[#994704] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{isSaving ? (imageFile ? 'Uploading and saving…' : 'Saving…') : 'Save question'}</button></div>
    </form>
  </div>
}

function ConfirmDialog({ title, description, confirmLabel, onCancel, onConfirm }: { title: string; description: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"><h2 className="text-lg font-bold text-[#29262f]">{title}</h2><p className="mt-2 text-sm leading-6 text-[#696570]">{description}</p><div className="mt-6 flex justify-end gap-3"><button onClick={onCancel} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-[#625e69]">Cancel</button><button onClick={onConfirm} className="rounded-lg bg-[#994704] px-4 py-2.5 text-sm font-semibold text-white">{confirmLabel}</button></div></div></div>
}
