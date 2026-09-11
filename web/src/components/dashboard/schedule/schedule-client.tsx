'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { startNavigationProgress } from '@/components/navigation/NavigationProgress'

interface Capabilities {
  isAdmin: boolean
  isTutor: boolean
}

interface UserInfo {
  id: string
  first_name: string
  last_name: string
}

interface ScheduleClientProps {
  token: string
  capabilities: Capabilities
  user: UserInfo
}

interface LiveClass {
  id: string
  course_id: string
  tutor_id: string
  title: string
  scheduled_at: string
  duration_minutes: number
  status: 'scheduled' | 'live' | 'completed' | 'cancelled'
  livekit_room_name?: string
  course?: { name: string }
  tutor?: { first_name: string, last_name: string }
}

interface Course {
  id: string
  name: string
}

interface Programme {
  id: string
  name: string
  courses: Course[]
}

interface Tutor {
  id: string
  first_name: string
  last_name: string
}

export function ScheduleClient({ token, capabilities, user }: ScheduleClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [classes, setClasses] = useState<LiveClass[]>([])
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [tutors, setTutors] = useState<Tutor[]>([])
  const [assignedTutorIds, setAssignedTutorIds] = useState<string[]>([])
  
  const [title, setTitle] = useState('')
  const [courseId, setCourseId] = useState('')
  const [tutorId, setTutorId] = useState(capabilities.isAdmin ? '' : user.id)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState('60')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formMode, setFormMode] = useState<'now' | 'later' | null>(() => searchParams.get('mode') === 'now' ? 'now' : null)
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false)
  
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setLoadFailed(false)
        const classesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/live-classes`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (!classesRes.ok) throw new Error('Could not load scheduled classes')
        const classesData = await classesRes.json()
        
        const programmesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/programmes`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (!programmesRes.ok) throw new Error('Could not load programmes')
        const programmesData = await programmesRes.json()

        let tutorsData = { data: [] }
        if (capabilities.isAdmin) {
          // Admins can teach too. This list must use profile IDs because that
          // is what tutor_course_assignments and live_classes store.
          const tutorsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users?roles=admin,tutor`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          if (tutorsRes.ok) {
            tutorsData = await tutorsRes.json()
          }
        }

        setClasses(classesData.data || [])
        setProgrammes(programmesData.data || [])
        if (capabilities.isAdmin) setTutors(tutorsData.data || [])

      } catch (err) {
        console.error('Error fetching schedule data:', err)
        setLoadFailed(true)
        toast.error('Could not load the class schedule', {
          description: 'Check your connection and try again.',
        })
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [token, capabilities.isAdmin])

  const selectedCourse = programmes.flatMap(programme => programme.courses).find(course => course.id === courseId)

  useEffect(() => {
    if (!capabilities.isAdmin || !courseId) return
    const fetchCourseTutors = async () => {
      try {
        setAssignedTutorIds([])
        setTutorId('')
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${courseId}/tutors`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (res.ok) {
          const { data } = await res.json()
          const tutorIds = data.map((assignment: { tutor_id: string }) => assignment.tutor_id)
          setAssignedTutorIds(tutorIds)
          // A sole assignment makes the choice unambiguous. If several
          // people teach the course, prefer the signed-in admin when assigned.
          if (tutorIds.length === 1) setTutorId(tutorIds[0])
          else if (tutorIds.includes(user.id)) setTutorId(user.id)
        }
      } catch (err) {
        console.error('Failed to fetch assigned tutors:', err)
      }
    }
    fetchCourseTutors()
  }, [courseId, token, capabilities.isAdmin, user.id])

  const handleScheduleClass = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!courseId || (formMode === 'later' && (!date || !time))) return
    if (capabilities.isAdmin && !tutorId) return
    setIsSubmitting(true)
    try {
      const isStartingNow = formMode === 'now'
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/live-classes${isStartingNow ? '/start-now' : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          title: title.trim() || `${selectedCourse?.name || 'Live'} class`,
          course_id: courseId,
          tutor_id: tutorId,
          ...(!isStartingNow && { scheduled_at: new Date(`${date}T${time}`).toISOString() }),
          duration_minutes: parseInt(duration, 10),
        })
      })
      if (res.ok) {
        const responseBody = await res.json()
        if (isStartingNow) {
          toast.success('Class started')
          startNavigationProgress()
          router.push(`/class/${responseBody.data.id}?start=true`)
          return
        }
        const classesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/live-classes`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const classesData = await classesRes.json()
        if (classesRes.ok) setClasses(classesData.data || [])
        setTitle('')
        setCourseId('')
        if (capabilities.isAdmin) setTutorId('')
        setDate('')
        setTime('')
        setDuration('60')
        setFormMode(null)
        toast.success('Class scheduled')
      } else {
        const errData = await res.json()
        toast.error(isStartingNow ? 'Could not start the class' : 'Could not schedule the class', { description: errData.error })
      }
    } catch (err) {
      console.error(err)
      toast.error(formMode === 'now' ? 'Could not start the class' : 'Could not schedule the class', { description: 'Check your connection and try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStartClass = async (classId: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/live-classes/${classId}/start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        toast.success('Class started')
        const classesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/live-classes`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const classesData = await classesRes.json()
        if (classesRes.ok) setClasses(classesData.data || [])
      } else {
        const errData = await res.json()
        toast.error('Could not start the class', { description: errData.error })
      }
    } catch (err) {
      console.error(err)
      toast.error('Could not start the class', { description: 'Check your connection and try again.' })
    }
  }

  const handleJoinClass = (classId: string, classTutorId: string) => {
    const isStarting = user.id === classTutorId;
    startNavigationProgress();
    router.push(`/class/${classId}${isStarting ? '?start=true' : ''}`);
  }

  const liveClasses = classes.filter(c => c.status === 'live')
  
  let scheduledClasses = classes.filter(c => c.status === 'scheduled')
  if (selectedDate) {
    scheduledClasses = scheduledClasses.filter(c => {
      const d = new Date(c.scheduled_at)
      return d.getFullYear() === selectedDate.getFullYear() &&
             d.getMonth() === selectedDate.getMonth() &&
             d.getDate() === selectedDate.getDate()
    })
  }

  const completedClasses = classes.filter(c => c.status === 'completed')

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = (new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay() + 6) % 7
  const emptyDays = Array.from({ length: firstDayOfMonth }, (_, i) => i)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })
  
  const handlePrevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  const handleNextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  
  const scheduledDates = new Set(
    classes.filter(c => c.status === 'scheduled').map(c => {
      const d = new Date(c.scheduled_at)
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    })
  )

  const isToday = (d: Date | null) => {
    if (!d) return false;
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  }

  return (
    <div className="w-full">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#994704]">Teaching</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#1b1c1c] sm:text-3xl">Classes</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#474551]">
            Start teaching now or plan a class for later.
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#994704] px-4 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(153,71,4,0.22)]"
            onClick={() => setFormMode('now')}
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[19px]">videocam</span>Start now
          </button>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#2e2877] bg-white px-4 text-sm font-semibold text-[#2e2877]"
            onClick={() => setFormMode('later')}
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[19px]">calendar_add_on</span>Schedule
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {formMode && (
            <div id="class-action-form" className="rounded-2xl border border-[#C2B59B] bg-white p-5 shadow-[0px_4px_20px_rgba(61,61,61,0.08)] sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-3 border-b border-[#e5dfda] pb-4">
                <div>
                  <h3 className="text-xl font-bold text-[#180d62]">{formMode === 'now' ? 'Start a live class' : 'Schedule for later'}</h3>
                  <p className="mt-1 text-sm leading-5 text-[#474551]">{formMode === 'now' ? 'Choose a subject and enter the classroom.' : 'Choose a subject, date and time.'}</p>
                </div>
                <button type="button" onClick={() => setFormMode(null)} aria-label="Close class form" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#716c76] hover:bg-[#f5f3f2]"><span className="material-symbols-outlined">close</span></button>
              </div>

              <form className="flex flex-col gap-5" onSubmit={handleScheduleClass}>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="class-course" className="text-sm font-semibold text-[#1b1c1c]">What are you teaching?</label>
                  <select
                    id="class-course"
                    value={courseId}
                    onChange={event => { setCourseId(event.target.value); setAssignedTutorIds([]); setTutorId(capabilities.isAdmin ? '' : user.id) }}
                    required
                    className="min-h-12 w-full rounded-lg border border-[#8b8580] bg-white px-3 text-base text-[#1b1c1c] outline-none focus:border-[#2e2877] focus:ring-2 focus:ring-[#ded8ff]"
                  >
                    <option value="" disabled>Choose a subject</option>
                    {programmes.map(programme => (
                      <optgroup key={programme.id} label={programme.name}>
                        {programme.courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  {!programmes.length && <p className="text-xs leading-5 text-[#994704]">Create a course with at least one subject first.</p>}
                </div>

                {capabilities.isAdmin && courseId && assignedTutorIds.length > 1 && (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="class-tutor" className="text-sm font-semibold text-[#1b1c1c]">Who is teaching?</label>
                    <select id="class-tutor" value={tutorId} onChange={event => setTutorId(event.target.value)} required className="min-h-12 w-full rounded-lg border border-[#8b8580] bg-white px-3 text-base">
                      <option value="" disabled>Choose a tutor</option>
                      {tutors.filter(tutor => assignedTutorIds.includes(tutor.id)).map(tutor => <option key={tutor.id} value={tutor.id}>{tutor.first_name} {tutor.last_name}{tutor.id === user.id ? ' (you)' : ''}</option>)}
                    </select>
                  </div>
                )}
                {capabilities.isAdmin && courseId && assignedTutorIds.length === 0 && <p className="rounded-lg bg-[#fff3e8] px-3 py-2 text-xs leading-5 text-[#7a3903]">Assign a tutor to this subject before starting a class.</p>}

                {formMode === 'later' && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label htmlFor="class-date" className="text-sm font-semibold text-[#1b1c1c]">Date<input id="class-date" type="date" value={date} onChange={event => setDate(event.target.value)} required className="mt-1.5 min-h-12 w-full rounded-lg border border-[#8b8580] bg-white px-3 text-base" /></label>
                    <label htmlFor="class-time" className="text-sm font-semibold text-[#1b1c1c]">Start time<input id="class-time" type="time" value={time} onChange={event => setTime(event.target.value)} required className="mt-1.5 min-h-12 w-full rounded-lg border border-[#8b8580] bg-white px-3 text-base" /></label>
                  </div>
                )}

                <details className="rounded-xl border border-[#e3ded9]">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#2e2877]">Edit title or duration <span className="font-normal text-[#716c76]">(optional)</span></summary>
                  <div className="space-y-4 border-t border-[#e3ded9] px-4 py-4">
                    <label htmlFor="class-title-input" className="block text-sm font-medium text-[#1b1c1c]">Class title<input id="class-title-input" type="text" value={title} onChange={event => setTitle(event.target.value)} placeholder={selectedCourse ? `${selectedCourse.name} class` : 'Generated from the subject'} className="mt-1.5 min-h-11 w-full rounded-lg border border-[#8b8580] px-3" /></label>
                    <div><p className="text-sm font-medium text-[#1b1c1c]">Duration</p><div className="mt-2 grid grid-cols-4 gap-2">{[{ l: '45m', v: '45' }, { l: '1h', v: '60' }, { l: '1.5h', v: '90' }, { l: '2h', v: '120' }].map(option => <label key={option.v} className="cursor-pointer"><input type="radio" name="duration" value={option.v} checked={duration === option.v} onChange={event => setDuration(event.target.value)} className="peer sr-only" /><span className="flex min-h-10 items-center justify-center rounded-lg border border-[#C2B59B] text-sm text-[#474551] peer-checked:border-[#2e2877] peer-checked:bg-[#2e2877] peer-checked:text-white">{option.l}</span></label>)}</div></div>
                  </div>
                </details>

                <button type="submit" disabled={isSubmitting || !courseId || (capabilities.isAdmin && !tutorId)} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#994704] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                  {isSubmitting && <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>}{isSubmitting ? (formMode === 'now' ? 'Starting…' : 'Scheduling…') : (formMode === 'now' ? 'Enter classroom' : 'Schedule class')}
                </button>
              </form>
            </div>
          )}
          
          {/* Calendar Widget */}
          <div className="bg-white border border-[#C2B59B] rounded shadow-[0px_4px_20px_rgba(61,61,61,0.08)] p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[16px] leading-[24px] font-bold text-[#1b1c1c]">{monthName}</h3>
              <div className="flex gap-1">
                <button onClick={handlePrevMonth} className="w-8 h-8 rounded hover:bg-[#f5f3f2] flex items-center justify-center text-[#474551]">
                  <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                </button>
                <button onClick={handleNextMonth} className="w-8 h-8 rounded hover:bg-[#f5f3f2] flex items-center justify-center text-[#474551]">
                  <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {['MO','TU','WE','TH','FR','SA','SU'].map(d => (
                <span key={d} className="text-[10px] leading-[16px] tracking-[0.05em] font-semibold text-[#474551]">{d}</span>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-1 text-center text-[14px] leading-[20px]">
              {emptyDays.map(i => <div key={`empty-${i}`} className="h-8 flex items-center justify-center text-[#474551]/30"></div>)}
              {days.map(day => {
                const dateString = `${currentMonth.getFullYear()}-${currentMonth.getMonth()}-${day}`
                const hasClass = scheduledDates.has(dateString)
                const isSelected = selectedDate?.getFullYear() === currentMonth.getFullYear() && 
                                   selectedDate?.getMonth() === currentMonth.getMonth() && 
                                   selectedDate?.getDate() === day
                                   
                return (
                  <button 
                    key={day} 
                    onClick={() => setSelectedDate(isSelected ? null : new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))}
                    className={`h-8 flex items-center justify-center relative rounded hover:bg-[#f5f3f2] transition-colors
                      ${isSelected ? 'bg-[#2e2877] text-white font-bold hover:bg-[#180d62]' : 'text-[#1b1c1c]'}
                    `}
                  >
                    {day}
                    {hasClass && !isSelected && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[#994704]"></span>}
                    {hasClass && isSelected && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-white"></span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Live Classes Panel */}
          {liveClasses.length > 0 && (
            <div className="bg-white border-2 border-[#994704]/20 rounded shadow-[0px_4px_20px_rgba(61,61,61,0.08)] overflow-hidden">
              <div className="bg-[#C26627]/5 px-6 py-4 border-b border-[#994704]/20 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#994704] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-[#994704]"></span>
                  </span>
                  <h3 className="text-[20px] leading-[28px] font-bold text-[#C26627]">Live Now</h3>
                </div>
                <span className="text-[12px] leading-[16px] tracking-[0.05em] font-semibold text-[#994704] bg-white px-2 py-1 rounded border border-[#994704]/20">
                  {liveClasses.length} Active
                </span>
              </div>
              
              <div className="p-6 flex flex-col gap-4">
                {liveClasses.map(cls => (
                  <div key={cls.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white border border-[#C2B59B] rounded relative overflow-hidden group">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#994704]"></div>
                    <div className="flex-1 pl-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] leading-[16px] tracking-[0.05em] font-semibold uppercase text-[#474551] bg-[#f0eded] px-2 py-0.5 rounded">
                          {cls.course?.name || 'Subject'}
                        </span>
                        <span className="text-[12px] leading-[16px] tracking-[0.05em] font-bold text-[#994704]">
                          {new Date(cls.scheduled_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      <h4 className="text-[18px] leading-[28px] font-bold text-[#180d62] mb-1">{cls.title}</h4>
                      <div className="flex items-center gap-4 text-[14px] leading-[20px] text-[#474551]">
                        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">person</span> {cls.tutor?.first_name} {cls.tutor?.last_name}</span>
                      </div>
                    </div>
                    <div className="mt-4 sm:mt-0 flex gap-2 w-full sm:w-auto">
                      <button 
                        onClick={() => handleJoinClass(cls.id, cls.tutor_id)}
                        className="flex-1 sm:flex-none px-4 py-2 bg-[#994704] text-white text-[12px] leading-[16px] tracking-[0.05em] font-bold rounded hover:bg-[#a84e04] transition-colors flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(153,71,4,0.3)]"
                      >
                        <span className="material-symbols-outlined text-[18px]">login</span> Join Session
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scheduled Classes */}
          {!loading && loadFailed ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-[#c8c5d2] bg-white px-6 py-12 text-center shadow-[0px_4px_20px_rgba(61,61,61,0.08)]">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ffdad6] text-[#ba1a1a]">
                <span className="material-symbols-outlined text-[28px]">cloud_off</span>
              </div>
              <h3 className="mt-5 text-xl font-bold text-[#1b1c1c]">We could not load the schedule</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-[#474551]">Check that the API is running, then try loading this page again.</p>
              <button type="button" onClick={() => window.location.reload()} className="mt-6 rounded-md bg-[#2e2877] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#180d62]">
                Try again
              </button>
            </div>
          ) : !loading && classes.length === 0 ? (
            <div className="flex min-h-[430px] flex-col items-center justify-center rounded-lg border border-dashed border-[#c2b59b] bg-white px-6 py-12 text-center shadow-[0px_4px_20px_rgba(61,61,61,0.06)]">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f0eded] text-[#2e2877]">
                <span className="material-symbols-outlined text-[32px]">calendar_add_on</span>
              </div>
              <h3 className="mt-5 text-2xl font-bold text-[#180d62]">No classes scheduled yet</h3>
              <p className="mt-3 max-w-md text-sm leading-6 text-[#474551]">
                Use the form beside this message to choose a Subject, tutor, date, and time. The class will then appear here for everyone who needs it.
              </p>
              <button
                type="button"
                onClick={() => setFormMode('later')}
                className="mt-6 inline-flex items-center gap-2 rounded-md bg-[#994704] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#7a3903]"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">add</span>
                Schedule your first class
              </button>
              <div className="mt-8 grid w-full max-w-xl grid-cols-1 gap-3 border-t border-[#e4e2e1] pt-6 text-left sm:grid-cols-3">
                {[
                  ['1', 'Choose the Subject'],
                  ['2', 'Set the date and time'],
                  ['3', 'Students see the class'],
                ].map(([step, label]) => (
                  <div key={step} className="flex items-center gap-3 rounded-md bg-[#fbf9f8] px-3 py-3 text-xs font-semibold text-[#474551]">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2e2877] text-white">{step}</span>
                    {label}
                  </div>
                ))}
              </div>
            </div>
          ) : (
          <div className="bg-white border border-[#C2B59B] rounded shadow-[0px_4px_20px_rgba(61,61,61,0.08)] flex flex-col">
            <div className="px-6 py-4 border-b border-[#C2B59B] flex justify-between items-center">
              <div>
                <h3 className="text-[20px] leading-[28px] font-bold text-[#180d62]">Scheduled Classes</h3>
                <p className="text-[12px] leading-[16px] tracking-[0.05em] font-semibold text-[#474551] mt-1">
                  {selectedDate ? `Upcoming sessions for ${selectedDate.toLocaleDateString()}` : 'Upcoming sessions'}
                </p>
              </div>
              <div className="flex bg-[#f0eded] rounded p-1">
                <button 
                  onClick={() => setSelectedDate(new Date())}
                  className={`px-3 py-1 ${isToday(selectedDate) ? 'bg-white shadow-sm font-bold text-[#180d62]' : 'text-[#474551] hover:text-[#180d62]'} rounded text-[12px] leading-[16px] tracking-[0.05em] transition-colors`}
                >
                  Today
                </button>
                <button 
                  onClick={() => setSelectedDate(null)}
                  className={`px-3 py-1 ${!selectedDate ? 'bg-white shadow-sm font-bold text-[#180d62]' : 'text-[#474551] hover:text-[#180d62]'} rounded text-[12px] leading-[16px] tracking-[0.05em] transition-colors`}
                >
                  Week
                </button>
              </div>
            </div>
            
            <div className="divide-y divide-[#e8e2dc] sm:hidden">
              {scheduledClasses.length === 0 ? <p className="px-4 py-7 text-center text-sm text-[#474551]">No upcoming classes scheduled.</p> : scheduledClasses.map(cls => {
                const dt = new Date(cls.scheduled_at)
                return (
                  <article key={cls.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wide text-[#994704]">{cls.course?.name || 'Subject'}</p>
                        <h4 className="mt-1 truncate font-semibold text-[#1b1c1c]">{cls.title}</h4>
                      </div>
                      <p className="shrink-0 text-right text-sm font-semibold text-[#2e2877]">{dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}<span className="mt-0.5 block text-xs font-normal text-[#716c76]">{cls.duration_minutes} min</span></p>
                    </div>
                    <p className="mt-2 text-xs text-[#716c76]">{dt.toLocaleDateString()} · {cls.tutor?.first_name || 'Tutor'} {cls.tutor?.last_name || ''}</p>
                    {cls.tutor_id === user.id && <button onClick={() => handleStartClass(cls.id)} className="mt-3 min-h-11 w-full rounded-xl bg-[#2e2877] px-4 text-sm font-semibold text-white">Start class</button>}
                  </article>
                )
              })}
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#C2B59B]/10 text-[12px] leading-[16px] tracking-[0.05em] font-semibold text-[#474551] border-b border-[#C2B59B]">
                    <th className="py-3 px-6 font-bold w-[120px]">Time</th>
                    <th className="py-3 px-6 font-bold">Subject / Title</th>
                    <th className="py-3 px-6 font-bold w-[150px]">Tutor</th>
                    <th className="py-3 px-6 font-bold text-right w-[200px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-[14px] leading-[20px] divide-y divide-[#C2B59B]/50">
                  {loading ? (
                    <tr><td colSpan={4} className="text-center py-8 text-[#474551]">Loading...</td></tr>
                  ) : scheduledClasses.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-8 text-[#474551]">No upcoming classes scheduled.</td></tr>
                  ) : scheduledClasses.map(cls => {
                    const dt = new Date(cls.scheduled_at)
                    return (
                      <tr key={cls.id} className="hover:bg-[#180d62]/5 transition-colors group">
                        <td className="py-4 px-6 font-bold text-[#180d62] whitespace-nowrap">
                          {dt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          <br/><span className="text-[12px] leading-[16px] tracking-[0.05em] font-normal text-[#474551]">{cls.duration_minutes}m</span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex flex-col">
                            <span className="text-[10px] leading-[16px] tracking-[0.05em] font-bold uppercase text-[#994704]">{cls.course?.name || 'Subject'}</span>
                            <span className="font-bold text-[#1b1c1c] truncate max-w-[250px]">{cls.title}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-[#474551]">{cls.tutor?.first_name || 'Tutor'}</td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex justify-end gap-2">
                            {cls.tutor_id === user.id && (
                              <button 
                                onClick={() => handleStartClass(cls.id)}
                                className="px-3 py-1 bg-[#180d62] text-white text-[12px] leading-[16px] tracking-[0.05em] font-bold rounded hover:bg-[#2e2877] transition-colors ml-1"
                              >
                                Start Class
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          )}

          {/* Completed Classes (Simplified) */}
          {completedClasses.length > 0 && (
            <div className="bg-white border border-[#C2B59B] rounded shadow-[0px_4px_20px_rgba(61,61,61,0.08)] overflow-hidden transition-opacity">
              <button 
                onClick={() => setIsCompletedExpanded(!isCompletedExpanded)}
                className={`w-full px-6 py-4 flex justify-between items-center focus:outline-none hover:bg-[#f5f3f2] transition-colors ${!isCompletedExpanded ? 'opacity-80 hover:opacity-100' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#787582]">check_circle</span>
                  <h3 className="text-[16px] leading-[24px] font-bold text-[#1b1c1c]">Completed Classes</h3>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[12px] leading-[16px] tracking-[0.05em] font-semibold text-[#474551]">{completedClasses.length} Sessions</span>
                  <span className={`material-symbols-outlined text-[#474551] transition-transform duration-200 ${isCompletedExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                </div>
              </button>
              
              {isCompletedExpanded && (
                <div className="border-t border-[#C2B59B] p-6 flex flex-col gap-4 bg-[#fbf9f8]">
                  {completedClasses.map(cls => (
                    <div key={cls.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white border border-[#C2B59B] rounded relative overflow-hidden group opacity-80">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#787582]"></div>
                      <div className="flex-1 pl-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] leading-[16px] tracking-[0.05em] font-semibold uppercase text-[#474551] bg-[#f0eded] px-2 py-0.5 rounded">
                            {cls.course?.name || 'Subject'}
                          </span>
                          <span className="text-[12px] leading-[16px] tracking-[0.05em] font-bold text-[#474551]">
                            {new Date(cls.scheduled_at).toLocaleDateString()} at {new Date(cls.scheduled_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                        <h4 className="text-[18px] leading-[28px] font-bold text-[#1b1c1c] mb-1 line-through">{cls.title}</h4>
                        <div className="flex items-center gap-4 text-[14px] leading-[20px] text-[#474551]">
                          <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">person</span> {cls.tutor?.first_name} {cls.tutor?.last_name}</span>
                          <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">schedule</span> {cls.duration_minutes}m</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
        </div>
      </div>
    </div>
  )
}
