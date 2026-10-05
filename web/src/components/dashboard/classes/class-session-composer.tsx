'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'

type Subject = { id: string; name: string }
type Tutor = { id: string; first_name?: string | null; last_name?: string | null; email?: string | null }

export function ClassSessionComposer({ open, onClose, onSaved, classId, subjects, token, initialCourseId }: { open: boolean; onClose: () => void; onSaved: () => void; classId: string; subjects: Subject[]; token: string; initialCourseId?: string }) {
  const api = process.env.NEXT_PUBLIC_API_URL
  const headers = { Authorization: `Bearer ${token}` }
  const [courseId, setCourseId] = useState(initialCourseId || subjects[0]?.id || '')
  const [tutors, setTutors] = useState<Tutor[]>([])
  const [tutorId, setTutorId] = useState('')
  const [independent, setIndependent] = useState(false)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('10:00')
  const [duration, setDuration] = useState('60')
  const [repeat, setRepeat] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (initialCourseId) setCourseId(initialCourseId) }, [initialCourseId])
  useEffect(() => {
    if (!open || !courseId) return
    let active = true
    void Promise.all([
      fetch(`${api}/schools/me`, { headers }), 
      fetch(`${api}/courses/${courseId}/tutors`, { headers }),
      fetch(`${api}/users/tutors`, { headers }),
      fetch(`${api}/users/me`, { headers })
    ]).then(async ([school, assignments, tutorsRes, meRes]) => {
      const schoolBody = school.ok ? await school.json() : null
      const assignmentBody = assignments.ok ? await assignments.json() : { data: [] }
      const tutorsBody = tutorsRes.ok ? await tutorsRes.json() : { data: [] }
      const meBody = meRes.ok ? await meRes.json() : null
      
      const isIndependent = schoolBody?.data?.account_type === 'independent'
      if (!active) return
      setIndependent(isIndependent)
      
      const ids = (assignmentBody.data || []).map((item: { tutor_id: string }) => item.tutor_id)
      const allTutors = tutorsBody.data?.length ? tutorsBody.data : (meBody?.data ? [meBody.data] : [])
      const people = ids.length ? allTutors.filter((t: Tutor) => ids.includes(t.id)) : allTutors
      
      setTutors(people)
      setTutorId(ids.length === 1 ? ids[0] : (people.length === 1 ? people[0].id : ''))
    }).catch(() => { if (active) setTutors([]) })
    return () => { active = false }
  }, [api, courseId, open, token])

  if (!open) return null
  const selectedSubject = subjects.find((subject) => subject.id === courseId)
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!courseId || !title.trim() || !date || !time || (!independent && !tutorId)) return
    setSaving(true)
    try {
      const response = await fetch(`${api}/live-classes`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim(), course_id: courseId, tutor_id: tutorId || undefined, scheduled_at: new Date(`${date}T${time}:00`).toISOString(), duration_minutes: Number(duration), access_mode: 'enrolled_learners', recurrence: repeat ? 'weekly' : 'once', recurrence_days: repeat ? [new Date(`${date}T12:00:00`).getDay() || 7] : undefined, starts_on: repeat ? date : undefined, start_time: repeat ? time : undefined, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }) })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || 'Could not schedule this class')
      toast.success(repeat ? 'Recurring classes scheduled' : 'Class scheduled')
      onSaved(); onClose()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not schedule this class') } finally { setSaving(false) }
  }
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#180d62]/35 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="schedule-class-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><form onSubmit={submit} className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-6"><header className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-dashboard-accent">Class schedule</p><h2 id="schedule-class-title" className="mt-1 text-xl font-bold text-[#180d62]">Schedule a class</h2><p className="mt-1 text-sm text-dashboard-muted">This session is for students in this class.</p></div><button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-[#625e69] hover:bg-[#f1efff]"><X size={19}/></button></header><div className="mt-6 space-y-4"><label className="block text-sm font-bold text-[#27242d]">Class title<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder={selectedSubject ? `${selectedSubject.name} lesson` : 'Lesson title'} className="mt-2 min-h-11 w-full rounded-lg border border-[#beb8c5] px-3 text-sm outline-none focus:border-[#312783]" /></label>{subjects.length > 1 ? <label className="block text-sm font-bold text-[#27242d]">Subject<select value={courseId} onChange={(event) => setCourseId(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-[#beb8c5] bg-white px-3 text-sm"><option value="">Choose subject</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label> : <p className="rounded-lg bg-[#f8f7ff] px-3 py-3 text-sm text-[#514b5b]"><strong>{selectedSubject?.name}</strong> is the subject for this class.</p>}{!independent && <label className="block text-sm font-bold text-[#27242d]">Tutor<select required value={tutorId} onChange={(event) => setTutorId(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-[#beb8c5] bg-white px-3 text-sm"><option value="">Choose assigned tutor</option>{tutors.map((tutor) => <option key={tutor.id} value={tutor.id}>{[tutor.first_name, tutor.last_name].filter(Boolean).join(' ') || tutor.email}</option>)}</select></label>}<div className="grid grid-cols-2 gap-3"><label className="text-sm font-bold text-[#27242d]">Date<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-[#beb8c5] px-3 text-sm" /></label><label className="text-sm font-bold text-[#27242d]">Time<input required type="time" value={time} onChange={(event) => setTime(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-[#beb8c5] px-3 text-sm" /></label></div><label className="block text-sm font-bold text-[#27242d]">Duration<select value={duration} onChange={(event) => setDuration(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-[#beb8c5] bg-white px-3 text-sm"><option value="45">45 minutes</option><option value="60">1 hour</option><option value="90">1½ hours</option><option value="120">2 hours</option></select></label><label className="flex items-center gap-2 text-sm font-bold text-[#27242d]"><input type="checkbox" checked={repeat} onChange={(event) => setRepeat(event.target.checked)} /> Repeat weekly</label></div><footer className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="min-h-11 rounded-lg px-4 text-sm font-bold text-[#514b5b]">Cancel</button><button disabled={saving || !courseId || (!independent && !tutorId)} className="min-h-11 rounded-lg bg-[#312783] px-5 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Scheduling…' : repeat ? 'Schedule recurring classes' : 'Schedule class'}</button></footer></form></div>
}
