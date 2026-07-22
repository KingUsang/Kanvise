'use client'

import React, { useState, useEffect, useCallback } from 'react'

interface AttendanceClientProps {
  token: string
}

export function AttendanceClient({ token }: AttendanceClientProps) {
  const [metrics, setMetrics] = useState<any>(null)
  const [records, setRecords] = useState<any[]>([])
  const [meta, setMeta] = useState<any>(null)
  
  const [availableProgrammes, setAvailableProgrammes] = useState<any[]>([])
  const [availableClasses, setAvailableClasses] = useState<any[]>([])
  const [courses, setCourses] = useState<any[]>([])
  
  const [isLoading, setIsLoading] = useState(true)
  
  // Filters
  const [programmeId, setProgrammeId] = useState('')
  const [classId, setClassId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [page, setPage] = useState(1)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL

  // Fetch dropdown data on mount
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const headers = { 'Authorization': `Bearer ${token}` }
        const [progRes, classRes, courseRes] = await Promise.all([
          fetch(`${apiUrl}/programmes`, { headers }),
          fetch(`${apiUrl}/live-classes`, { headers }),
          fetch(`${apiUrl}/courses`, { headers })
        ])
        if (progRes.ok) {
          const { data } = await progRes.json()
          setAvailableProgrammes(data || [])
        }
        if (classRes.ok) {
          const { data } = await classRes.json()
          setAvailableClasses(data || [])
        }
        if (courseRes.ok) {
          const { data } = await courseRes.json()
          setCourses(data || [])
        }
      } catch (e) {
        console.error('Failed to fetch filters', e)
      }
    }
    fetchFilters()
  }, [apiUrl, token])

  const fetchRecords = useCallback(async () => {
    setIsLoading(true)
    try {
      const query = new URLSearchParams()
      if (programmeId) query.append('programme_id', programmeId)
      if (classId) query.append('class_id', classId)
      if (startDate) query.append('start_date', startDate)
      query.append('page', String(page))

      const headers = { 'Authorization': `Bearer ${token}` }
      const [metricsRes, recordsRes] = await Promise.all([
        fetch(`${apiUrl}/attendance/metrics?${query.toString()}`, { headers }),
        fetch(`${apiUrl}/attendance/records?${query.toString()}`, { headers })
      ])

      if (metricsRes.ok) {
        const { data } = await metricsRes.json()
        setMetrics(data)
      }
      if (recordsRes.ok) {
        const { data, meta } = await recordsRes.json()
        setRecords(data || [])
        setMeta(meta)
      }
    } catch (e) {
      console.error('Failed to fetch records', e)
    } finally {
      setIsLoading(false)
    }
  }, [apiUrl, token, programmeId, classId, startDate, page])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  const handleProgrammeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setProgrammeId(e.target.value)
    setClassId('') // Reset class when programme changes
    setPage(1)
  }

  // Dynamically filter classes based on selected programme
  const filteredClasses = availableClasses.filter(c => {
    if (!programmeId) return true
    const course = courses.find(cr => cr.id === c.course_id)
    if (programmeId === 'standalone') {
      return !course?.programme_id
    }
    return course?.programme_id === programmeId
  })

  return (
    <div className="animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <h2 className="text-[32px] leading-[40px] font-bold tracking-tight text-[#1b1c1c]">Attendance Records</h2>
          <p className="text-[16px] text-[#474551] mt-1">Detailed attendance data for all active sessions.</p>
        </div>
      </div>

      {/* Filters Grid */}
      <div className="bg-white border border-[#c2b59b] p-6 rounded-lg mb-8 shadow-sm">
        <h3 className="text-[12px] font-semibold text-[#474551] mb-4 uppercase tracking-wider">Filter Criteria</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-[#787582] uppercase tracking-wider mb-1">Course Programme</label>
            <select value={programmeId} onChange={handleProgrammeChange} className="w-full border border-[#c2b59b] rounded text-[14px] p-2.5 focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877] bg-[#fbf9f8] outline-none">
              <option value="">All Programmes</option>
              {availableProgrammes?.map(p => (
                 <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              <option value="standalone">Standalone Courses</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-[#787582] uppercase tracking-wider mb-1">Specific Class</label>
            <select value={classId} onChange={(e) => { setClassId(e.target.value); setPage(1) }} className="w-full border border-[#c2b59b] rounded text-[14px] p-2.5 focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877] bg-[#fbf9f8] outline-none">
              <option value="">All Classes</option>
              {filteredClasses?.map(c => (
                 <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-[#787582] uppercase tracking-wider mb-1">Date Range</label>
            <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1) }} className="w-full border border-[#c2b59b] rounded text-[14px] p-2.5 focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877] bg-[#fbf9f8] outline-none" />
          </div>
        </div>
      </div>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-[#c2b59b] p-6 rounded-lg shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-[#2e2877]/5 rounded-bl-full -mr-4 -mt-4"></div>
          <p className="text-[12px] font-semibold text-[#474551] uppercase tracking-wider mb-2">Average Attendance</p>
          <div className="flex items-baseline gap-2">
            <span className="text-[40px] leading-[48px] font-bold text-[#2e2877]">{metrics?.average_attendance || 0}<span className="text-[24px]">%</span></span>
          </div>
          <div className="mt-4 flex items-center gap-1 text-[12px] text-green-700 font-semibold">
            <span className="material-symbols-outlined text-[14px]">trending_up</span>
            Current Period
          </div>
        </div>
        
        <div className="bg-white border border-[#c2b59b] p-6 rounded-lg shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-[#c26627]/10 rounded-bl-full -mr-4 -mt-4"></div>
          <p className="text-[12px] font-semibold text-[#474551] uppercase tracking-wider mb-2">Total Sessions Monitored</p>
          <div className="flex items-baseline gap-2">
            <span className="text-[40px] leading-[48px] font-bold text-[#2e2877]">{metrics?.total_sessions || 0}</span>
          </div>
          <div className="mt-4 flex items-center gap-1 text-[12px] text-[#474551] font-semibold">
            Across active classes
          </div>
        </div>

        <div className="bg-white border border-[#c2b59b] p-6 rounded-lg shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-[#ba1a1a]/10 rounded-bl-full -mr-4 -mt-4"></div>
          <p className="text-[12px] font-semibold text-[#474551] uppercase tracking-wider mb-2">At-Risk Students</p>
          <div className="flex items-baseline gap-2">
            <span className="text-[40px] leading-[48px] font-bold text-[#ba1a1a]">{metrics?.at_risk_students || 0}</span>
          </div>
          <div className="mt-4 flex items-center gap-1 text-[12px] text-[#ba1a1a] font-semibold">
            <span className="material-symbols-outlined text-[14px]">warning</span>
            Below 70% threshold
          </div>
        </div>
      </div>

      {/* Detailed Records Table */}
      <div className="bg-white border border-[#c2b59b] rounded-lg shadow-sm overflow-hidden flex flex-col">
        <div className="p-6 border-b border-[#c2b59b] flex justify-between items-center bg-[#fbf9f8]">
          <div>
            <h3 className="text-[20px] font-semibold text-[#1b1c1c]">Session Data Log</h3>
            <p className="text-[14px] text-[#474551]">Live view of student check-ins and duration.</p>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-[#f5f3f2] border-b border-[#c2b59b]">
                <th className="p-4 text-[12px] font-semibold text-[#474551] uppercase tracking-wider whitespace-nowrap">Student Name</th>
                <th className="p-4 text-[12px] font-semibold text-[#474551] uppercase tracking-wider whitespace-nowrap">Class / Cohort</th>
                <th className="p-4 text-[12px] font-semibold text-[#474551] uppercase tracking-wider whitespace-nowrap">Join Time</th>
                <th className="p-4 text-[12px] font-semibold text-[#474551] uppercase tracking-wider whitespace-nowrap">Duration</th>
                <th className="p-4 text-[12px] font-semibold text-[#474551] uppercase tracking-wider whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="text-[14px] text-[#1b1c1c]">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-[#474551]">
                    <div className="flex justify-center items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#2e2877]" />
                      Loading records...
                    </div>
                  </td>
                </tr>
              ) : records?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-[#474551]">
                    No attendance records found for the selected criteria.
                  </td>
                </tr>
              ) : records?.map((r: any) => (
                <tr key={r.id} className="border-b border-[#c2b59b] hover:bg-[#2e2877]/5 transition-colors">
                  <td className="p-4 flex items-center gap-3">
                    {r.avatar_url ? (
                      <div className="w-8 h-8 rounded-full bg-[#e4e2e1] overflow-hidden">
                        <img src={r.avatar_url} alt={r.student_name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#2e2877] text-white flex items-center justify-center text-xs font-bold">
                        {r.student_name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="font-semibold">{r.student_name}</span>
                  </td>
                  <td className="p-4 text-[#474551]">
                    {r.course_name}
                    <br/>
                    <span className="text-[11px] text-[#787582]">{r.class_title}</span>
                  </td>
                  <td className={`p-4 ${r.join_time === '--:--' ? 'text-[#787582]' : ''}`}>{r.join_time}</td>
                  <td className={`p-4 ${r.duration === '--' ? 'text-[#787582]' : ''}`}>{r.duration}</td>
                  <td className="p-4">
                    {r.status === 'Present' && (
                      <span className="inline-flex items-center px-2 py-1 rounded-sm text-[10px] font-bold bg-[#b5f299]/30 text-[#386a1f] uppercase tracking-wide border border-[#b5f299]">Present</span>
                    )}
                    {r.status === 'Late' && (
                      <span className="inline-flex items-center px-2 py-1 rounded-sm text-[10px] font-bold bg-[#ffeb99]/40 text-[#7a5c00] uppercase tracking-wide border border-[#ffeb99]">Late</span>
                    )}
                    {r.status === 'Absent' && (
                      <span className="inline-flex items-center px-2 py-1 rounded-sm text-[10px] font-bold bg-[#ffdad6] text-[#ba1a1a] uppercase tracking-wide border border-[#ba1a1a]/30">Absent</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        {!isLoading && meta && meta.total > 0 && (
          <div className="p-4 border-t border-[#c2b59b] bg-[#fbf9f8] flex items-center justify-between text-[14px]">
            <span className="text-[#474551]">
              Showing {((meta.page - 1) * meta.limit) + 1}-{Math.min(meta.page * meta.limit, meta.total)} of {meta.total} records
            </span>
            <div className="flex gap-2">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={meta.page <= 1}
                className="px-3 py-1 border border-[#c2b59b] rounded-sm transition-colors disabled:opacity-50 disabled:pointer-events-none hover:bg-[#f5f3f2]"
              >
                Prev
              </button>
              <button className="px-3 py-1 border border-[#2e2877] rounded-sm bg-[#2e2877] text-white">{meta.page}</button>
              <button 
                onClick={() => setPage(p => Math.min(meta.total_pages, p + 1))}
                disabled={meta.page >= meta.total_pages}
                className="px-3 py-1 border border-[#c2b59b] rounded-sm transition-colors disabled:opacity-50 disabled:pointer-events-none hover:bg-[#f5f3f2]"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
