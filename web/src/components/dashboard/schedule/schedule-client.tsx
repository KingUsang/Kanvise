'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

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
  course?: { name: string, code: string }
  tutor?: { first_name: string, last_name: string }
}

interface Course {
  id: string
  name: string
  code: string
}

interface Tutor {
  id: string
  first_name: string
  last_name: string
}

export function ScheduleClient({ token, capabilities, user }: ScheduleClientProps) {
  const router = useRouter()
  
  const [classes, setClasses] = useState<LiveClass[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [tutors, setTutors] = useState<Tutor[]>([])
  const [assignedTutorIds, setAssignedTutorIds] = useState<string[]>([])
  
  const [title, setTitle] = useState('')
  const [courseId, setCourseId] = useState('')
  const [tutorId, setTutorId] = useState(capabilities.isAdmin ? '' : user.id)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState('60')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false)
  
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const classesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/live-classes`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const classesData = await classesRes.json()
        
        const coursesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/courses`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const coursesData = await coursesRes.json()

        let tutorsData = { data: [] }
        if (capabilities.isAdmin) {
          const tutorsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/users/tutors`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          if (tutorsRes.ok) {
            tutorsData = await tutorsRes.json()
          }
        }

        if (classesRes.ok) setClasses(classesData.data || [])
        if (coursesRes.ok) setCourses(coursesData.data || [])
        if (capabilities.isAdmin) setTutors(tutorsData.data || [])

      } catch (err) {
        console.error('Error fetching schedule data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [token, capabilities.isAdmin])

  useEffect(() => {
    if (!capabilities.isAdmin || !courseId) return
    const fetchCourseTutors = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/courses/${courseId}/tutors`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (res.ok) {
          const { data } = await res.json()
          setAssignedTutorIds(data.map((a: any) => a.tutor_id))
        }
      } catch (err) {
        console.error('Failed to fetch assigned tutors:', err)
      }
    }
    fetchCourseTutors()
  }, [courseId, token, capabilities.isAdmin])

  const handleScheduleClass = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !courseId || !date || !time) return
    if (capabilities.isAdmin && !tutorId) return
    setIsSubmitting(true)
    const scheduledAt = new Date(`${date}T${time}`).toISOString()
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/live-classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          title, course_id: courseId, tutor_id: tutorId, scheduled_at: scheduledAt, duration_minutes: parseInt(duration, 10)
        })
      })
      if (res.ok) {
        const classesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/live-classes`, {
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
      } else {
        const errData = await res.json()
        alert(`Error scheduling class: ${errData.error}`)
      }
    } catch (err) {
      console.error(err)
      alert('Network error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStartClass = async (classId: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/live-classes/${classId}/start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        alert('Class started! (LiveKit token generated)')
        const classesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/live-classes`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const classesData = await classesRes.json()
        if (classesRes.ok) setClasses(classesData.data || [])
      } else {
        const errData = await res.json()
        alert(`Error: ${errData.error}`)
      }
    } catch (err) {
      console.error(err)
      alert('Network error')
    }
  }

  const handleJoinClass = async (classId: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/live-classes/${classId}/join`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        alert('Joining class! (LiveKit token generated)')
      } else {
        const errData = await res.json()
        alert(`Error: ${errData.error}`)
      }
    } catch (err) {
      console.error(err)
      alert('Network error')
    }
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
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay()
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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="text-[32px] leading-[40px] font-bold text-[#1b1c1c] tracking-tight">Schedule Manager</h2>
          <p className="text-[16px] leading-[24px] text-[#474551] mt-1 max-w-2xl">
            Coordinate live sessions, manage tutor availability, and track class status across all active programmes.
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <button 
            className="h-10 px-4 rounded bg-[#fbf9f8] border border-[#2e2877] text-[#2e2877] text-[12px] leading-[16px] tracking-[0.05em] font-bold hover:bg-[#f5f3f2] transition-colors flex items-center gap-2"
            onClick={() => alert("Coming Soon: Export student roster")}
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export Roster
          </button>
          <button 
            className="h-10 px-5 rounded bg-[#994704] text-white text-[12px] leading-[16px] tracking-[0.05em] font-bold hover:bg-[#a84e04] transition-colors shadow-[0_4px_14px_rgba(153,71,4,0.3)] flex items-center gap-2"
            onClick={() => document.getElementById('class-title-input')?.focus()}
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Class
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Create Form Card */}
          <div className="bg-white border border-[#C2B59B] rounded shadow-[0px_4px_20px_rgba(61,61,61,0.08)] p-6">
            <div className="border-b border-[#C2B59B] pb-4 mb-6">
              <h3 className="text-[20px] leading-[28px] font-bold text-[#180d62]">Schedule New Class</h3>
              <p className="text-[12px] leading-[16px] tracking-[0.05em] font-semibold text-[#474551] mt-1">Book a session in the main roster</p>
            </div>
            
            <form className="flex flex-col gap-5" onSubmit={handleScheduleClass}>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] leading-[16px] tracking-[0.05em] font-bold text-[#1b1c1c]">Class Title</label>
                <input 
                  id="class-title-input"
                  type="text" 
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                  className="w-full h-10 px-3 bg-[#fbf9f8] border border-[#C2B59B] rounded text-[14px] leading-[20px] text-[#1b1c1c] focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877] transition-all outline-none" 
                  placeholder="e.g. Advanced Calculus Rev." 
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] leading-[16px] tracking-[0.05em] font-bold text-[#1b1c1c]">Programme / Course</label>
                <div className="relative">
                  <select 
                    value={courseId}
                    onChange={e => setCourseId(e.target.value)}
                    required
                    className="w-full h-10 px-3 pr-10 bg-[#fbf9f8] border border-[#C2B59B] rounded text-[14px] leading-[20px] text-[#1b1c1c] appearance-none focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877] transition-all outline-none cursor-pointer"
                  >
                    <option value="" disabled>Select active course...</option>
                    {courses.map(course => (
                      <option key={course.id} value={course.id}>{course.code} - {course.name}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[#474551] pointer-events-none">arrow_drop_down</span>
                </div>
              </div>

              {capabilities.isAdmin && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] leading-[16px] tracking-[0.05em] font-bold text-[#1b1c1c]">Assigned Tutor</label>
                  <div className="relative">
                    <select 
                      value={tutorId}
                      onChange={e => setTutorId(e.target.value)}
                      required
                      className="w-full h-10 px-3 pr-10 bg-[#fbf9f8] border border-[#C2B59B] rounded text-[14px] leading-[20px] text-[#1b1c1c] appearance-none focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877] transition-all outline-none cursor-pointer"
                    >
                      <option value="" disabled>Select tutor...</option>
                      {(!courseId || assignedTutorIds.includes(user.id)) && (
                        <option value={user.id}>Assign to Self ({user.first_name} {user.last_name})</option>
                      )}
                      {tutors.filter(t => t.id !== user.id && (!courseId || assignedTutorIds.includes(t.id))).map(tutor => (
                        <option key={tutor.id} value={tutor.id}>{tutor.first_name} {tutor.last_name}</option>
                      ))}
                      {courseId && assignedTutorIds.length === 0 && !assignedTutorIds.includes(user.id) && (
                        <option value="" disabled>No tutors are assigned to this course yet.</option>
                      )}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[#474551] pointer-events-none">arrow_drop_down</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] leading-[16px] tracking-[0.05em] font-bold text-[#1b1c1c]">Date</label>
                  <input 
                    type="date" 
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    required
                    className="w-full h-10 px-3 bg-[#fbf9f8] border border-[#C2B59B] rounded text-[14px] leading-[20px] text-[#1b1c1c] focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877] transition-all outline-none cursor-pointer" 
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] leading-[16px] tracking-[0.05em] font-bold text-[#1b1c1c]">Start Time</label>
                  <input 
                    type="time" 
                    value={time}
                    onChange={e => setTime(e.target.value)}
                    required
                    className="w-full h-10 px-3 bg-[#fbf9f8] border border-[#C2B59B] rounded text-[14px] leading-[20px] text-[#1b1c1c] focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877] transition-all outline-none cursor-pointer" 
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] leading-[16px] tracking-[0.05em] font-bold text-[#1b1c1c]">Duration</label>
                <div className="flex gap-2">
                  {[ {l: '45m', v: '45'}, {l: '1h', v: '60'}, {l: '1.5h', v: '90'}, {l: '2h', v: '120'} ].map(opt => (
                    <label key={opt.v} className="flex-1 cursor-pointer">
                      <input 
                        type="radio" 
                        name="duration" 
                        value={opt.v}
                        checked={duration === opt.v}
                        onChange={e => setDuration(e.target.value)}
                        className="peer sr-only" 
                      />
                      <div className="h-10 flex items-center justify-center border border-[#C2B59B] rounded bg-[#fbf9f8] text-[14px] leading-[20px] text-[#474551] peer-checked:bg-[#2e2877] peer-checked:border-[#2e2877] peer-checked:text-white transition-colors">
                        {opt.l}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-[#C2B59B] mt-2 flex justify-end gap-3">
                <button 
                  type="button" 
                  className="px-4 py-2 text-[12px] leading-[16px] tracking-[0.05em] font-bold text-[#3d3d3d] hover:bg-[#f5f3f2] rounded transition-colors"
                  onClick={() => {
                    setTitle('')
                    setCourseId('')
                    setDate('')
                    setTime('')
                  }}
                >
                  Reset
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-[#2e2877] text-white text-[12px] leading-[16px] tracking-[0.05em] font-bold rounded hover:bg-[#180d62] transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Scheduling...' : 'Schedule Class'}
                </button>
              </div>
            </form>
          </div>
          
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
                          {cls.course?.code || 'COURSE'}
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
                        onClick={() => handleJoinClass(cls.id)}
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

          {/* Scheduled Classes Data Table */}
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
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#C2B59B]/10 text-[12px] leading-[16px] tracking-[0.05em] font-semibold text-[#474551] border-b border-[#C2B59B]">
                    <th className="py-3 px-6 font-bold w-[120px]">Time</th>
                    <th className="py-3 px-6 font-bold">Course / Title</th>
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
                            <span className="text-[10px] leading-[16px] tracking-[0.05em] font-bold uppercase text-[#994704]">{cls.course?.code || 'COURSE'}</span>
                            <span className="font-bold text-[#1b1c1c] truncate max-w-[250px]">{cls.title}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-[#474551]">{cls.tutor?.first_name || 'Tutor'}</td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="w-8 h-8 rounded hover:bg-[#f0eded] flex items-center justify-center text-[#474551]" title="Edit">
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button className="w-8 h-8 rounded hover:bg-[#ba1a1a]/10 flex items-center justify-center text-[#ba1a1a]" title="Cancel">
                              <span className="material-symbols-outlined text-[18px]">cancel</span>
                            </button>
                            {(capabilities.isAdmin || cls.tutor_id === user.id) && (
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
                            {cls.course?.code || 'COURSE'}
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
