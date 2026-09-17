'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { startNavigationProgress } from '@/components/navigation/NavigationProgress'

type Course = { id: string; name: string }
type Programme = { id: string; name: string; courses: Course[] }
type Tutor = { id: string; first_name: string; last_name: string }

export function DashboardClassLauncher({
  token,
  user,
  isAdmin,
}: {
  token: string
  user: { id: string; firstName: string; lastName: string }
  isAdmin: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [courseId, setCourseId] = useState('')
  const [accessMode, setAccessMode] = useState<'anyone_with_link' | 'enrolled_learners'>('anyone_with_link')
  const [title, setTitle] = useState('')
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareClassId, setShareClassId] = useState<string | null>(null)
  const [tutorId, setTutorId] = useState(isAdmin ? '' : user.id)
  const [starting, setStarting] = useState(false)
  const headers = { Authorization: `Bearer ${token}` }

  const programmes = useQuery({
    queryKey: ['programmes', 'class-launcher', user.id],
    queryFn: async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/programmes`, { headers })
      if (!response.ok) throw new Error('Could not load subjects')
      return (await response.json()).data as Programme[]
    },
    enabled: open && accessMode === 'enrolled_learners',
    staleTime: 5 * 60_000,
  })
  const standaloneSubjects = useQuery({
    queryKey: ['standalone-subjects', 'class-launcher', user.id],
    queryFn: async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses?standalone=true`, { headers })
      if (!response.ok) throw new Error('Could not load subjects')
      return (await response.json()).data as Course[]
    },
    enabled: open && accessMode === 'enrolled_learners',
    staleTime: 5 * 60_000,
  })
  const subjectTutors = useQuery({
    queryKey: ['subject-tutors', 'class-launcher', user.id, courseId],
    queryFn: async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${courseId}/tutors`, { headers })
      if (!response.ok) throw new Error('Could not load tutors')
      return (await response.json()).data.map((item: { tutor_id: string }) => item.tutor_id) as string[]
    },
    enabled: open && accessMode === 'enrolled_learners' && isAdmin && Boolean(courseId),
    staleTime: 5 * 60_000,
  })
  const tutors = useQuery({
    queryKey: ['teaching-tutors', 'class-launcher', user.id],
    queryFn: async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users?roles=admin,tutor`, { headers })
      if (!response.ok) throw new Error('Could not load tutors')
      return (await response.json()).data as Tutor[]
    },
    enabled: open && accessMode === 'enrolled_learners' && isAdmin,
    staleTime: 5 * 60_000,
  })

  const assignedTutorIds = subjectTutors.data || []
  useEffect(() => {
    if (!isAdmin || !courseId) return
    if (assignedTutorIds.length === 1) setTutorId(assignedTutorIds[0])
    else if (assignedTutorIds.includes(user.id)) setTutorId(user.id)
    else setTutorId('')
  }, [assignedTutorIds, courseId, isAdmin, user.id])

  const subjectsLoading = programmes.isLoading || standaloneSubjects.isLoading || (isAdmin && tutors.isLoading)
  const subjectsFailed = programmes.isError || standaloneSubjects.isError || (isAdmin && tutors.isError)
  const canStart = accessMode === 'anyone_with_link'
    ? Boolean(!starting)
    : Boolean(courseId && tutorId && !starting && !subjectsLoading && (!isAdmin || assignedTutorIds.includes(tutorId)))

  const startClass = async () => {
    if (!canStart) return
    setStarting(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/live-classes/start-now`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: courseId || undefined, tutor_id: accessMode === 'anyone_with_link' ? user.id : tutorId, title: title.trim() || undefined, access_mode: accessMode, duration_minutes: 60 }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not start the class')
      if (body.data.share_token) {
        setShareUrl(`${window.location.origin}/class/${body.data.id}`)
        setShareClassId(body.data.id)
        setStarting(false)
        toast.success(accessMode === 'anyone_with_link' ? 'Your class is ready to share' : 'Your learner link is ready')
        return
      }
      toast.success(response.status === 202 ? 'Preparing your classroom' : 'Class started')
      startNavigationProgress()
      router.push(`/class/${body.data.id}?start=true`)
    } catch (error) {
      toast.error('Could not start the class', { description: error instanceof Error ? error.message : 'Check your connection and try again.' })
      setStarting(false)
    }
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#994704] px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#7a3903] sm:px-4">
      <span className="material-symbols-outlined text-xl" aria-hidden="true">videocam</span>Start live class
    </button>
    {open ? <div className="fixed inset-0 z-[70] flex items-end bg-black/45 p-0 sm:items-center sm:justify-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="start-class-title">
      <button type="button" aria-label="Close" onClick={() => !starting && setOpen(false)} className="absolute inset-0 cursor-default" />
      <section className="relative w-full rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-2xl sm:p-7">
        <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-[#ded8d3] sm:hidden" />
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#994704]">Live class</p><h2 id="start-class-title" className="mt-1 text-xl font-bold text-[#180d62]">Start a live class</h2><p className="mt-1 text-sm leading-5 text-[#66616c]">Share a class in seconds, or teach your enrolled learners.</p></div>
          <button type="button" aria-label="Close" onClick={() => !starting && setOpen(false)} className="hidden h-10 w-10 shrink-0 rounded-full text-[#66616c] hover:bg-[#f5f3f2] sm:inline-flex sm:items-center sm:justify-center"><span className="material-symbols-outlined">close</span></button>
        </div>
        {shareUrl ? <div className="mt-6"><p className="text-sm leading-5 text-[#66616c]">{accessMode === 'anyone_with_link' ? 'Anyone with this link can join while your class is live.' : 'Share this with enrolled learners. They will sign in before joining.'}</p><input readOnly value={shareUrl.replace('https://', '').replace('http://', '')} className="mt-4 min-h-12 w-full rounded-lg border border-[#8b8580] bg-[#fbf9f8] px-3 text-sm" /><div className="mt-4 grid grid-cols-2 gap-3"><button type="button" onClick={() => void navigator.clipboard.writeText(shareUrl.replace('https://', '').replace('http://', '')).then(() => toast.success('Class link copied'))} className="min-h-11 rounded-lg border border-[#2e2877] px-3 text-sm font-semibold text-[#2e2877]">Copy link</button><button type="button" disabled={!shareClassId} onClick={() => { if (!shareClassId) return; startNavigationProgress(); router.push(`/class/${shareClassId}?start=true`) }} className="min-h-11 rounded-lg bg-[#994704] px-3 text-sm font-semibold text-white disabled:opacity-50">Enter class</button></div></div> : <>
        <fieldset className="mt-6 grid grid-cols-2 gap-3"><button type="button" onClick={() => setAccessMode('anyone_with_link')} className={`rounded-xl border p-3 text-left text-sm font-semibold ${accessMode === 'anyone_with_link' ? 'border-[#2e2877] bg-[#eeeaff] text-[#180d62]' : 'border-[#d8d3d0] text-[#474551]'}`}>Anyone with the link<span className="mt-1 block text-xs font-normal">Best for free classes</span></button><button type="button" onClick={() => setAccessMode('enrolled_learners')} className={`rounded-xl border p-3 text-left text-sm font-semibold ${accessMode === 'enrolled_learners' ? 'border-[#2e2877] bg-[#eeeaff] text-[#180d62]' : 'border-[#d8d3d0] text-[#474551]'}`}>Enrolled learners<span className="mt-1 block text-xs font-normal">Use a teaching group</span></button></fieldset>
        <label className="mt-5 block text-sm font-semibold text-[#1b1c1c]">Class title <span className="font-normal text-[#66616c]">(optional)</span><input value={title} onChange={event => setTitle(event.target.value)} maxLength={160} className="mt-2 min-h-12 w-full rounded-lg border border-[#8b8580] px-3 font-normal" placeholder="e.g. JAMB Physics revision" /></label>
        {accessMode === 'enrolled_learners' && (subjectsFailed ? <div className="mt-6 rounded-xl bg-[#fff3e8] p-4 text-sm text-[#7a3903]">We could not load your subjects. Check your connection and reopen this.</div> : <>
          <label className="mt-6 block text-sm font-semibold text-[#1b1c1c]">Subject
            <select value={courseId} onChange={event => { setCourseId(event.target.value); if (!isAdmin) setTutorId(user.id) }} disabled={subjectsLoading} className="mt-2 min-h-12 w-full rounded-lg border border-[#8b8580] bg-white px-3 text-base font-normal outline-none focus:border-[#2e2877] focus:ring-2 focus:ring-[#ded8ff]">
              <option value="">{subjectsLoading ? 'Loading your subjects…' : 'Choose a subject'}</option>
              {(programmes.data || []).map(programme => <optgroup key={programme.id} label={programme.name}>{programme.courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}</optgroup>)}
              {(standaloneSubjects.data || []).length ? <optgroup label="Standalone subjects">{(standaloneSubjects.data || []).map(course => <option key={course.id} value={course.id}>{course.name}</option>)}</optgroup> : null}
            </select>
          </label>
          {isAdmin && courseId && assignedTutorIds.length > 1 ? <label className="mt-4 block text-sm font-semibold text-[#1b1c1c]">Tutor
            <select value={tutorId} onChange={event => setTutorId(event.target.value)} className="mt-2 min-h-12 w-full rounded-lg border border-[#8b8580] bg-white px-3 text-base font-normal">
              <option value="">Choose a tutor</option>{(tutors.data || []).filter(tutor => assignedTutorIds.includes(tutor.id)).map(tutor => <option key={tutor.id} value={tutor.id}>{tutor.first_name} {tutor.last_name}{tutor.id === user.id ? ' (you)' : ''}</option>)}
            </select>
          </label> : null}
          {isAdmin && courseId && subjectTutors.isLoading ? <p className="mt-3 text-xs text-[#66616c]">Checking who can teach this subject…</p> : null}
          {isAdmin && courseId && subjectTutors.isSuccess && !assignedTutorIds.length ? <p className="mt-4 rounded-xl bg-[#fff3e8] p-3 text-sm leading-5 text-[#7a3903]">Assign a tutor to this subject before starting a class.</p> : null}
        </>)}
          <button type="button" disabled={!canStart} onClick={() => void startClass()} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#994704] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{starting ? <><span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>Preparing classroom…</> : <>Start class now <span className="material-symbols-outlined text-lg">arrow_forward</span></>}</button>
        </>}
        <p className="mt-4 text-center text-sm text-[#66616c]">Need a different time? <Link href="/dashboard/schedule?mode=later" className="font-semibold text-[#2e2877] underline">Schedule for later</Link></p>
      </section>
    </div> : null}
  </>
}
