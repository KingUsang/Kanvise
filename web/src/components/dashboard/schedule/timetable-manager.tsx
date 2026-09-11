'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarCheck, Loader2, Pencil, Plus, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { getApiUrl } from '@/config/api'

type Course = { id: string; name: string; tutor_ids?: string[] }
type Programme = { id: string; name: string; courses: Course[] }
type Tutor = { id: string; first_name: string; last_name: string }
type Slot = {
  id: string
  course_id: string
  tutor_id: string
  weekday: number
  start_time: string
  duration_minutes: number
  starts_on: string
  ends_on: string | null
  course?: { id: string; name: string }
  tutor?: Tutor
}
type Timetable = {
  id: string
  programme_id: string | null
  standalone_course_id: string | null
  status: 'draft' | 'published'
  timezone: string
  programme?: { id: string; name: string } | null
  standalone_course?: { id: string; name: string } | null
  slots: Slot[]
}

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function currentWeekStart(now = new Date()) {
  const date = new Date(now)
  const isoDay = date.getDay() || 7
  date.setDate(date.getDate() - isoDay + 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function TimetableManager({ token, programmes, standaloneCourses, tutors }: { token: string; programmes: Programme[]; standaloneCourses: Course[]; tutors: Tutor[] }) {
  const [timetables, setTimetables] = useState<Timetable[]>([])
  const [activeId, setActiveId] = useState('')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [scope, setScope] = useState('')
  const [courseId, setCourseId] = useState('')
  const [tutorId, setTutorId] = useState('')
  const [assignedTutorIds, setAssignedTutorIds] = useState<string[]>([])
  const [weekday, setWeekday] = useState(String(new Date().getDay() || 7))
  const [startTime, setStartTime] = useState('')
  const [duration, setDuration] = useState('60')
  const [recurrence, setRecurrence] = useState<'ongoing' | 'this_week'>('ongoing')

  const active = timetables.find(timetable => timetable.id === activeId) || timetables[0]
  const usedScopes = useMemo(() => new Set(timetables.map(timetable => timetable.programme_id ? `programme:${timetable.programme_id}` : `course:${timetable.standalone_course_id}`)), [timetables])
  const activeCourses = active?.programme_id
    ? programmes.find(programme => programme.id === active.programme_id)?.courses || []
    : standaloneCourses.filter(course => course.id === active?.standalone_course_id)

  async function load(preferredId?: string) {
    const response = await fetch(`${getApiUrl()}/timetables`, { headers: { Authorization: `Bearer ${token}` } })
    const body = await response.json().catch(() => null)
    if (!response.ok) throw new Error(body?.error || 'Could not load timetable')
    const next = body?.data || []
    setTimetables(next)
    setActiveId(preferredId || activeId || next[0]?.id || '')
    return next as Timetable[]
  }

  useEffect(() => {
    void load().catch(error => toast.error(error.message)).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!courseId) {
      setAssignedTutorIds([])
      setTutorId('')
      return
    }
    const known = activeCourses.find(course => course.id === courseId)?.tutor_ids || []
    if (known.length) {
      setAssignedTutorIds(known)
      setTutorId(known.length === 1 ? known[0] : '')
      return
    }
    void fetch(`${getApiUrl()}/courses/${courseId}/tutors`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async response => response.ok ? response.json() : { data: [] })
      .then(body => {
        const ids = (body.data || []).map((assignment: { tutor_id: string }) => assignment.tutor_id)
        setAssignedTutorIds(ids)
        setTutorId(ids.length === 1 ? ids[0] : '')
      })
      .catch(() => {
        setAssignedTutorIds([])
        setTutorId('')
      })
  }, [courseId])

  async function createTimetable() {
    if (!scope) return
    setWorking(true)
    try {
      const [kind, id] = scope.split(':')
      const response = await fetch(`${getApiUrl()}/timetables`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ programme_id: kind === 'programme' ? id : null, standalone_course_id: kind === 'course' ? id : null, timezone: 'Africa/Lagos' }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || 'Could not create timetable')
      await load(body.data.id)
      setScope('')
      toast.success('Timetable draft created')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create timetable')
    } finally {
      setWorking(false)
    }
  }

  async function addSlot(event: React.FormEvent) {
    event.preventDefault()
    if (!active || !courseId || !tutorId || !startTime) return
    const currentIsoDay = new Date().getDay() || 7
    if (recurrence === 'this_week' && Number(weekday) < currentIsoDay) {
      toast.error('That day has already passed this week')
      return
    }
    setWorking(true)
    try {
      const response = await fetch(`${getApiUrl()}/timetables/${active.id}/slots`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: courseId, tutor_id: tutorId, weekday: Number(weekday), start_time: startTime, duration_minutes: Number(duration), recurrence, week_start: currentWeekStart() }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || 'Could not add class')
      await load(active.id)
      setStartTime('')
      toast.success('Class added to the timetable')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add class')
    } finally {
      setWorking(false)
    }
  }

  async function removeSlot(slotId: string) {
    if (!active) return
    setWorking(true)
    try {
      const response = await fetch(`${getApiUrl()}/timetables/${active.id}/slots/${slotId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || 'Could not remove class')
      await load(active.id)
      toast.success('Class removed')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not remove class')
    } finally {
      setWorking(false)
    }
  }

  async function changePublication(action: 'publish' | 'edit') {
    if (!active) return
    setWorking(true)
    try {
      const response = await fetch(`${getApiUrl()}/timetables/${active.id}/${action}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || `Could not ${action} timetable`)
      await load(active.id)
      toast.success(action === 'publish' ? 'Timetable published to students' : 'Timetable is ready to edit')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Could not ${action} timetable`)
    } finally {
      setWorking(false)
    }
  }

  if (loading) return <div className="flex min-h-48 items-center justify-center text-sm text-[#716c76]" role="status"><Loader2 className="mr-2 animate-spin" size={18} />Loading timetable…</div>

  return (
    <section className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-[#e3ded9] bg-white p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f0edff] text-[#2e2877]"><CalendarCheck size={20} /></span>
          <div><h3 className="text-lg font-semibold text-[#1b1c1c]">Weekly timetable</h3><p className="mt-1 text-sm leading-6 text-[#716c76]">Set it up once. It repeats every week until you edit it.</p></div>
        </div>

        {timetables.length > 1 && <label htmlFor="active-timetable" className="mt-5 block text-sm font-medium">Course<select id="active-timetable" value={active?.id || ''} onChange={event => setActiveId(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-[#8b8580] bg-white px-3">{timetables.map(timetable => <option key={timetable.id} value={timetable.id}>{timetable.programme?.name || timetable.standalone_course?.name}</option>)}</select></label>}

        {active ? (
          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="font-semibold text-[#1b1c1c]">{active.programme?.name || active.standalone_course?.name}</p><p className="mt-0.5 text-xs text-[#716c76]">{active.slots.length} {active.slots.length === 1 ? 'class' : 'classes'} in this timetable</p></div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${active.status === 'published' ? 'bg-[#e7f5eb] text-[#196b37]' : 'bg-[#fff0e3] text-[#8a4307]'}`}>{active.status === 'published' ? 'Published' : 'Draft · students cannot see it'}</span>
            </div>

            <div className="mt-5 divide-y divide-[#ece7e3] rounded-xl border border-[#e3ded9]">
              {active.slots.map(slot => <article key={slot.id} className="flex items-center gap-3 p-3.5"><div className="min-w-0 flex-1"><p className="font-medium text-[#1b1c1c]">{slot.course?.name || 'Subject'}</p><p className="mt-1 text-xs text-[#716c76]">{weekdays[slot.weekday - 1]} · {slot.start_time.slice(0, 5)} · {slot.duration_minutes} min · {slot.ends_on ? 'This week only' : 'Every week'}</p><p className="mt-1 text-xs text-[#716c76]">{slot.tutor?.first_name} {slot.tutor?.last_name}</p></div>{active.status === 'draft' && <button type="button" disabled={working} onClick={() => void removeSlot(slot.id)} aria-label={`Remove ${slot.course?.name || 'class'}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#a43a2a] hover:bg-[#fff0ed]"><Trash2 size={17} /></button>}</article>)}
              {!active.slots.length && <p className="p-5 text-center text-sm text-[#716c76]">Add the first class below.</p>}
            </div>

            {active.status === 'published' ? <button type="button" disabled={working} onClick={() => void changePublication('edit')} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#2e2877] px-4 text-sm font-semibold text-[#2e2877]"><Pencil size={16} />Edit timetable</button> : (
              <>
                <form onSubmit={addSlot} className="mt-6 space-y-4 rounded-xl bg-[#f8f6f4] p-4">
                  <h4 className="font-semibold text-[#1b1c1c]">Add a class</h4>
                  <label htmlFor="timetable-course" className="block text-sm font-medium">Subject<select id="timetable-course" required value={courseId} onChange={event => setCourseId(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-[#8b8580] bg-white px-3"><option value="" disabled>Choose a subject</option>{activeCourses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>
                  {courseId && assignedTutorIds.length > 1 && <label htmlFor="timetable-tutor" className="block text-sm font-medium">Tutor<select id="timetable-tutor" required value={tutorId} onChange={event => setTutorId(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-[#8b8580] bg-white px-3"><option value="" disabled>Choose a tutor</option>{tutors.filter(tutor => assignedTutorIds.includes(tutor.id)).map(tutor => <option key={tutor.id} value={tutor.id}>{tutor.first_name} {tutor.last_name}</option>)}</select></label>}
                  {courseId && assignedTutorIds.length === 0 && <p className="rounded-lg bg-[#fff0e3] px-3 py-2 text-xs text-[#8a4307]">Assign a tutor to this subject first.</p>}
                  <div className="grid grid-cols-2 gap-3"><label htmlFor="timetable-day" className="text-sm font-medium">Day<select id="timetable-day" value={weekday} onChange={event => setWeekday(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-[#8b8580] bg-white px-3">{weekdays.map((day, index) => <option key={day} value={index + 1}>{day}</option>)}</select></label><label htmlFor="timetable-time" className="text-sm font-medium">Time<input id="timetable-time" required type="time" value={startTime} onChange={event => setStartTime(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-[#8b8580] bg-white px-3" /></label></div>
                  <fieldset><legend className="text-sm font-medium">Repeats</legend><div className="mt-2 grid grid-cols-2 gap-2"><label className="cursor-pointer"><input type="radio" name="recurrence" value="ongoing" checked={recurrence === 'ongoing'} onChange={() => setRecurrence('ongoing')} className="peer sr-only" /><span className="flex min-h-11 items-center justify-center rounded-lg border border-[#cfc9c4] bg-white px-3 text-sm peer-checked:border-[#2e2877] peer-checked:bg-[#f0edff] peer-checked:font-semibold peer-checked:text-[#2e2877]">Every week</span></label><label className="cursor-pointer"><input type="radio" name="recurrence" value="this_week" checked={recurrence === 'this_week'} onChange={() => setRecurrence('this_week')} className="peer sr-only" /><span className="flex min-h-11 items-center justify-center rounded-lg border border-[#cfc9c4] bg-white px-3 text-sm peer-checked:border-[#2e2877] peer-checked:bg-[#f0edff] peer-checked:font-semibold peer-checked:text-[#2e2877]">This week only</span></label></div></fieldset>
                  <details><summary className="cursor-pointer text-sm font-medium text-[#2e2877]">Change duration <span className="font-normal text-[#716c76]">(optional)</span></summary><select aria-label="Class duration" value={duration} onChange={event => setDuration(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-[#8b8580] bg-white px-3"><option value="45">45 minutes</option><option value="60">1 hour</option><option value="90">1½ hours</option><option value="120">2 hours</option></select></details>
                  <button type="submit" disabled={working || !courseId || !tutorId || !startTime} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#2e2877] bg-white px-4 text-sm font-semibold text-[#2e2877] disabled:opacity-50"><Plus size={16} />{working ? 'Adding…' : 'Add class'}</button>
                </form>
                <button type="button" disabled={working || !active.slots.length} onClick={() => void changePublication('publish')} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#994704] px-5 text-sm font-semibold text-white disabled:opacity-50"><Send size={16} />{working ? 'Publishing…' : 'Publish timetable'}</button>
              </>
            )}
          </div>
        ) : <p className="mt-6 rounded-xl bg-[#f8f6f4] p-4 text-sm leading-6 text-[#716c76]">Choose the course whose weekly timetable you want to set up.</p>}

        {(!active || [...usedScopes].length < programmes.length + standaloneCourses.length) && <div className="mt-6 border-t border-[#e3ded9] pt-5"><label htmlFor="timetable-scope" className="block text-sm font-medium">{active ? 'Set up another course' : 'Course'}<select id="timetable-scope" value={scope} onChange={event => setScope(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-[#8b8580] bg-white px-3"><option value="">Choose a course</option>{programmes.filter(programme => !usedScopes.has(`programme:${programme.id}`)).map(programme => <option key={programme.id} value={`programme:${programme.id}`}>{programme.name}</option>)}{standaloneCourses.filter(course => !usedScopes.has(`course:${course.id}`)).map(course => <option key={course.id} value={`course:${course.id}`}>{course.name} · standalone</option>)}</select></label><button type="button" disabled={!scope || working} onClick={() => void createTimetable()} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#2e2877] px-4 text-sm font-semibold text-white disabled:opacity-50"><Plus size={16} />Create timetable</button></div>}
      </div>
    </section>
  )
}
