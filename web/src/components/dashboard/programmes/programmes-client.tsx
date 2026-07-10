'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Programme {
  id: string
  name: string
  slug: string
  description: string
  price: number
  is_published: boolean
  sub_programmes_count: number
  courses_count: number
  enrolled_count: number
  thumbnail_key?: string
  thumbnail_url?: string
}

export function ProgrammesClient({ schoolId }: { schoolId: string }) {
  const supabase = createClient()
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [subProgrammes, setSubProgrammes] = useState<any[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [tutors, setTutors] = useState<any[]>([])
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [activeCoursesCount, setActiveCoursesCount] = useState(0)
  const [draftCoursesCount, setDraftCoursesCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [entityType, setEntityType] = useState<'programme' | 'sub_programme' | 'course'>('programme')

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    price: '',
    is_published: true,
    programme_id: '',
    sub_programme_id: '',
    course_placement: 'standalone', // 'standalone', 'programme', 'sub_programme'
    assign_tutor: false,
    tutor_id: ''
  })

  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return

      const headers = { 'Authorization': `Bearer ${token}` }
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

      const [progRes, subProgRes, coursesRes, tutorsRes] = await Promise.all([
        fetch(`${baseUrl}/programmes`, { headers }),
        fetch(`${baseUrl}/sub-programmes`, { headers }),
        fetch(`${baseUrl}/courses`, { headers }),
        fetch(`${baseUrl}/users?roles=admin,tutor`, { headers })
      ])

      if (!progRes.ok) throw new Error('Failed to fetch programmes')
      if (!subProgRes.ok) throw new Error('Failed to fetch sub-programmes')
      if (!coursesRes.ok) throw new Error('Failed to fetch courses')
      if (!tutorsRes.ok) throw new Error('Failed to fetch tutors')

      const { data: progData } = await progRes.json()
      const { data: subProgData } = await subProgRes.json()
      const { data: coursesData } = await coursesRes.json()
      const { data: tutorsData } = await tutorsRes.json()

      setProgrammes(progData)
      setSubProgrammes(subProgData)
      setCourses(coursesData)
      setTutors(tutorsData)
      
      const active = coursesData.filter((c: any) => c.is_published).length
      const drafts = coursesData.length - active
      setActiveCoursesCount(active)
      setDraftCoursesCount(drafts)
      
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (entityType === 'course') {
      if (tutors.length === 0) {
        setFormData(p => ({ ...p, assign_tutor: true, tutor_id: 'self' }))
      } else {
        setFormData(p => ({ ...p, assign_tutor: false, tutor_id: '' }))
      }
    }
  }, [entityType, tutors.length])

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    // Auto-generate slug
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    setFormData(prev => ({ ...prev, name, slug }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setSaveError('')

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      let endpoint = `${baseUrl}/programmes`
      let payload: any = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        price: formData.price,
        is_published: formData.is_published
      }

      if (entityType === 'sub_programme') {
        endpoint = `${baseUrl}/sub-programmes`
        if (!formData.programme_id) throw new Error("Please select a parent programme")
        payload.programme_id = formData.programme_id
      } else if (entityType === 'course') {
        endpoint = `${baseUrl}/courses`
        if (formData.course_placement === 'programme') {
          if (!formData.programme_id) throw new Error("Please select a parent programme")
          payload.programme_id = formData.programme_id
        } else if (formData.course_placement === 'sub_programme') {
          if (!formData.sub_programme_id) throw new Error("Please select a parent sub-programme")
          payload.sub_programme_id = formData.sub_programme_id
        }
      }

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || `Failed to create ${entityType}`)
      }

      const { data: newEntity } = await res.json()

      // Handle Tutor Assignment for Course
      if (entityType === 'course' && formData.assign_tutor && formData.tutor_id) {
        const assignRes = await fetch(`${baseUrl}/courses/${newEntity.id}/tutors`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ tutor_id: formData.tutor_id })
        })
        if (!assignRes.ok) {
          const assignErr = await assignRes.json()
          console.error("Failed to assign tutor", assignErr)
          // We don't block the UI, just log it. The course was created.
        }
      }

      await fetchData()
      setIsModalOpen(false)
      setFormData({ 
        name: '', slug: '', description: '', price: '', is_published: true, 
        programme_id: '', sub_programme_id: '', course_placement: 'standalone', 
        assign_tutor: false, tutor_id: '' 
      })
      setEntityType('programme')
    } catch (err: any) {
      setSaveError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(nodeId)) newSet.delete(nodeId)
      else newSet.add(nodeId)
      return newSet
    })
  }

  const renderStatus = (is_published: boolean) => (
    is_published ? (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#994704]/10 border border-[#994704]/20 text-[#994704] text-xs font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-[#994704]"></span> Published
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#c8c5d2]/20 border border-[#c8c5d2]/50 text-[#474551] text-xs font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-[#474551]"></span> Draft
      </span>
    )
  )

  const renderCourseRow = (course: any, indentClass: string) => (
    <div key={`course-${course.id}`} className={`group border-b border-[#c2b59b] hover:bg-[#2e2877]/5 transition-colors ${indentClass} bg-[#fbf9f8]/30`}>
      <div className="grid grid-cols-12 gap-4 px-6 py-3 items-center">
        <div className="col-span-12 md:col-span-4 flex items-center gap-3">
          <div className="w-[28px] shrink-0"></div> {/* Spacer for toggle icon alignment */}
          <div className="h-8 w-8 rounded bg-[#e4e2e1] overflow-hidden border border-[#c8c5d2] shrink-0 flex items-center justify-center text-[#474551]">
            <span className="material-symbols-outlined text-[16px]">library_books</span>
          </div>
          <div>
            <div className="text-sm font-semibold text-[#1b1c1c]">{course.name}</div>
            <div className="text-xs text-[#474551]">Course</div>
          </div>
        </div>
        
        <div className="col-span-4 md:col-span-2 hidden md:block text-sm text-[#474551] font-mono">
          {course.slug}
        </div>
        
        <div className="col-span-4 md:col-span-2 hidden md:block text-sm font-semibold text-[#1b1c1c]">
          ₦{Number(course.price).toLocaleString()}
        </div>
        
        <div className="col-span-3 md:col-span-2">
          {renderStatus(course.is_published)}
        </div>
        
        <div className="col-span-3 md:col-span-2 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="p-1 text-[#474551] hover:text-[#2e2877] rounded">
            <span className="material-symbols-outlined text-[18px]">edit</span>
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex-1 flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-end gap-4 mb-4">
        <div>
            <div className="flex items-center gap-2 text-[#474551] mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Curriculum Management</span>
            </div>
            <h2 className="text-3xl font-bold text-[#1b1c1c]">Programmes & Courses</h2>
            <p className="text-sm text-[#474551] mt-1 max-w-2xl">
              Manage your educational hierarchy. Structure programmes, define nested cohorts, and assign modules and tutors to specific courses.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            {/* Shortcut for Course Creation */}
            <button 
              onClick={() => { setEntityType('course'); setIsModalOpen(true); }}
              className="bg-[#fbf9f8] border border-[#2e2877] text-[#2e2877] hover:bg-[#2e2877] hover:text-white transition-colors px-6 py-2.5 rounded text-sm font-semibold flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              New Course
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-[#994704] text-white hover:bg-[#753400] transition-colors px-6 py-2.5 rounded text-sm font-semibold shadow-sm flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">add_box</span>
              Create Programme
            </button>
          </div>
        </div>
      {/* Density Data View */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-4">
        {/* Card 1 */}
        <div className="bg-[#fbf9f8] border border-[#c2b59b] rounded-lg p-6 shadow-sm relative overflow-hidden group hover:border-[#2e2877] transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <span className="material-symbols-outlined text-6xl text-[#2e2877]">account_tree</span>
          </div>
          <h3 className="text-xs font-semibold text-[#474551] uppercase tracking-wider mb-2">Total Programmes</h3>
          <div className="text-4xl font-bold text-[#1b1c1c]">{programmes.length}</div>
          {/* TODO: Add real time metrics when analytics backend is ready */}
          <div className="mt-4 pt-4 border-t border-[#c8c5d2]/50 flex items-center justify-between">
            <span className="text-xs text-[#753400]">+2 this month</span>
            <a className="text-xs font-semibold text-[#2e2877] hover:underline" href="#">View All</a>
          </div>
        </div>
        
        {/* Card 2 */}
        <div className="bg-[#fbf9f8] border border-[#c2b59b] rounded-lg p-6 shadow-sm relative overflow-hidden group hover:border-[#2e2877] transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <span className="material-symbols-outlined text-6xl text-[#994704]">library_books</span>
          </div>
          <h3 className="text-xs font-semibold text-[#474551] uppercase tracking-wider mb-2">Active Courses</h3>
          <div className="text-4xl font-bold text-[#1b1c1c]">{activeCoursesCount}</div>
          <div className="mt-4 pt-4 border-t border-[#c8c5d2]/50 flex items-center justify-between">
            <span className="text-xs text-[#753400]">{draftCoursesCount} Drafts pending</span>
            <a className="text-xs font-semibold text-[#2e2877] hover:underline" href="#">Manage Drafts</a>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-[#2e2877] text-white rounded-lg p-6 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-10 -bottom-10 opacity-20">
            <svg fill="none" height="160" viewBox="0 0 160 160" width="160" xmlns="http://www.w3.org/2000/svg">
              <circle cx="80" cy="80" r="79" stroke="currentColor" strokeWidth="2"></circle>
              <circle cx="80" cy="80" r="59" stroke="currentColor" strokeDasharray="4 4" strokeWidth="2"></circle>
              <circle cx="80" cy="80" r="39" stroke="currentColor" strokeWidth="2"></circle>
            </svg>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">System Status</h3>
            <div className="text-2xl font-bold text-white">All Systems Operational</div>
          </div>
          <div className="mt-auto pt-4 flex gap-2">
            {/* TODO: Realtime sync check with Supabase */}
            <span className="inline-flex items-center gap-1 bg-white/20 px-2 py-1 rounded text-xs font-semibold text-white">
              <span className="w-2 h-2 rounded-full bg-[#4CAF50]"></span> Sync OK
            </span>
          </div>
        </div>
      </div>

      {/* Hierarchy Data Table */}
      <div className="bg-[#fbf9f8] border border-[#c2b59b] rounded-lg shadow-sm flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-[#c2b59b] bg-[#f5f3f2] flex justify-between items-center">
          <h3 className="text-lg font-bold text-[#1b1c1c]">Curriculum Hierarchy</h3>
          <div className="flex gap-2">
            {/* TODO: Wire up expand/collapse functionality */}
            <button className="p-1.5 text-[#474551] hover:bg-[#e4e2e1] rounded transition-colors" title="Expand All">
              <span className="material-symbols-outlined text-[20px]">unfold_more</span>
            </button>
            {/* TODO: Implement filtering side panel */}
            <button className="p-1.5 text-[#474551] hover:bg-[#e4e2e1] rounded transition-colors" title="Filter">
              <span className="material-symbols-outlined text-[20px]">filter_list</span>
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto w-full no-scrollbar">
          <div className="min-w-[800px]">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-[#f2ebd9] border-b border-[#c2b59b] text-xs font-semibold text-[#474551] uppercase tracking-wide">
              <div className="col-span-12 md:col-span-4">Name / Hierarchy</div>
              <div className="col-span-4 md:col-span-2 hidden md:block">Slug</div>
              <div className="col-span-4 md:col-span-2 hidden md:block">Price (NGN)</div>
              <div className="col-span-3 md:col-span-2">Status</div>
              <div className="col-span-3 md:col-span-2 text-right">Actions</div>
            </div>

            <div className="flex-1 bg-white">
              {isLoading ? (
                <div className="p-8 text-center text-[#474551]">Loading curriculum...</div>
              ) : programmes.length === 0 && courses.length === 0 ? (
                <div className="p-8 text-center text-[#474551]">No curriculum found. Click 'New Course' or 'Create Programme' to get started.</div>
              ) : (
                <>
                  {/* Standalone Courses */}
                  {courses.filter(c => !c.programme_id && !c.sub_programme_id).length > 0 && (
                    <div className="bg-[#f5f3f2] px-6 py-2 border-b border-[#c2b59b] text-xs font-bold text-[#474551] uppercase tracking-wider">
                      Standalone Courses
                    </div>
                  )}
                  {courses.filter(c => !c.programme_id && !c.sub_programme_id).map(course => 
                    renderCourseRow(course, '')
                  )}

                  {/* Programmes & Hierarchy */}
                  {programmes.length > 0 && (
                    <div className="bg-[#f5f3f2] px-6 py-2 border-b border-[#c2b59b] text-xs font-bold text-[#474551] uppercase tracking-wider">
                      Programmes
                    </div>
                  )}
                  {programmes.map(prog => {
                    const isExpanded = expandedNodes.has(prog.id)
                    const progSubProgrammes = subProgrammes.filter(sp => sp.programme_id === prog.id)
                    const progStandaloneCourses = courses.filter(c => c.programme_id === prog.id && !c.sub_programme_id)
                    const hasChildren = progSubProgrammes.length > 0 || progStandaloneCourses.length > 0

                    return (
                      <React.Fragment key={`prog-${prog.id}`}>
                        <div className="group border-b border-[#c2b59b] hover:bg-[#2e2877]/5 transition-colors bg-white">
                          <div className="grid grid-cols-12 gap-4 px-6 py-4 items-center">
                            <div className="col-span-12 md:col-span-4 flex items-center gap-3">
                              {hasChildren ? (
                                <button onClick={() => toggleNode(prog.id)} className="p-1 -ml-1 text-[#474551] hover:text-[#2e2877] transition-colors rounded hover:bg-[#e4e2e1]">
                                  <span className="material-symbols-outlined text-[20px]">
                                    {isExpanded ? 'expand_less' : 'expand_more'}
                                  </span>
                                </button>
                              ) : (
                                <div className="w-[28px] shrink-0"></div>
                              )}
                              <div className="h-10 w-10 rounded bg-[#e4e2e1] overflow-hidden border border-[#c8c5d2] shrink-0">
                                {prog.thumbnail_url ? (
                                  <img src={prog.thumbnail_url} alt="Thumbnail" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[#474551]">
                                    <span className="material-symbols-outlined text-[20px]">account_tree</span>
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-[#2e2877]">{prog.name}</div>
                                <div className="text-xs text-[#474551]">{prog.courses_count} Courses • {prog.sub_programmes_count} Sub-Programmes</div>
                              </div>
                            </div>
                            
                            <div className="col-span-4 md:col-span-2 hidden md:block text-sm text-[#474551] font-mono">
                              {prog.slug}
                            </div>
                            
                            <div className="col-span-4 md:col-span-2 hidden md:block text-sm font-semibold text-[#1b1c1c]">
                              ₦{Number(prog.price).toLocaleString()}
                            </div>
                            
                            <div className="col-span-3 md:col-span-2">
                              {renderStatus(prog.is_published)}
                            </div>
                            
                            <div className="col-span-3 md:col-span-2 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="p-1 text-[#474551] hover:text-[#2e2877] rounded">
                                <span className="material-symbols-outlined text-[18px]">edit</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Render Sub-Programmes & Courses if expanded */}
                        {isExpanded && (
                          <div className="bg-[#fcfbf9] border-b border-[#c2b59b]">
                            {/* Nested Sub-Programmes */}
                            {progSubProgrammes.map(sp => {
                              const isSpExpanded = expandedNodes.has(sp.id)
                              const spCourses = courses.filter(c => c.sub_programme_id === sp.id)
                              const spHasChildren = spCourses.length > 0

                              return (
                                <React.Fragment key={`sp-${sp.id}`}>
                                  <div className="group border-b border-[#e4e2e1] hover:bg-[#2e2877]/5 transition-colors pl-12">
                                    <div className="grid grid-cols-12 gap-4 px-6 py-3 items-center relative">
                                      <div className="absolute left-10 top-0 bottom-0 w-px bg-[#c2b59b]/50"></div>
                                      <div className="absolute left-10 top-1/2 w-4 h-px bg-[#c2b59b]/50"></div>
                                      
                                      <div className="col-span-12 md:col-span-4 flex items-center gap-3 relative z-10">
                                        {spHasChildren ? (
                                          <button onClick={() => toggleNode(sp.id)} className="p-1 -ml-1 text-[#474551] hover:text-[#2e2877] transition-colors bg-[#fcfbf9] rounded">
                                            <span className="material-symbols-outlined text-[18px]">
                                              {isSpExpanded ? 'remove' : 'add'}
                                            </span>
                                          </button>
                                        ) : (
                                          <div className="w-[26px] shrink-0"></div>
                                        )}
                                        <div>
                                          <div className="text-sm font-semibold text-[#1b1c1c]">{sp.name}</div>
                                          <div className="text-xs text-[#474551]">Sub-Programme</div>
                                        </div>
                                      </div>
                                      
                                      <div className="col-span-4 md:col-span-2 hidden md:block text-sm text-[#474551] font-mono">
                                        {sp.slug}
                                      </div>
                                      
                                      <div className="col-span-4 md:col-span-2 hidden md:block text-sm font-semibold text-[#1b1c1c]">
                                        ₦{Number(sp.price).toLocaleString()}
                                      </div>
                                      
                                      <div className="col-span-3 md:col-span-2">
                                        {renderStatus(sp.is_published)}
                                      </div>
                                      
                                      <div className="col-span-3 md:col-span-2 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button className="p-1 text-[#474551] hover:text-[#2e2877] rounded">
                                          <span className="material-symbols-outlined text-[18px]">edit</span>
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Sub-Programme Courses */}
                                  {isSpExpanded && spCourses.map(course => 
                                    renderCourseRow(course, 'pl-20')
                                  )}
                                </React.Fragment>
                              )
                            })}

                            {/* Nested Courses (directly under Programme) */}
                            {progStandaloneCourses.map(course => 
                              renderCourseRow(course, 'pl-12')
                            )}
                          </div>
                        )}
                      </React.Fragment>
                    )
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Programme Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] bg-[#1b1c1c]/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#fbf9f8] rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden border border-[#c8c5d2] animate-in zoom-in-95 slide-in-from-bottom-4 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#c8c5d2] flex justify-between items-center bg-[#ffffff]">
              <h2 className="text-lg font-bold text-[#2e2877]">Create New Programme</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-[#474551] hover:text-[#ba1a1a] transition-colors p-1"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="px-6 py-6 overflow-y-auto bg-[#fbf9f8] flex-1">
              <form id="create-programme-form" onSubmit={handleSave} className="space-y-6">
                
                {saveError && (
                  <div className="bg-red-50 text-red-600 p-3 rounded border border-red-200 text-sm">
                    {saveError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-6">
                  {/* Entity Type Selector */}
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-[#1b1c1c] mb-2 uppercase tracking-wide">Entity Type</label>
                    <div className="flex gap-4 p-1 bg-[#f5f3f2] rounded border border-[#c8c5d2]/50 w-max">
                      <label className="cursor-pointer">
                        <input 
                          type="radio" 
                          name="entity_type" 
                          className="peer sr-only" 
                          checked={entityType === 'programme'}
                          onChange={() => setEntityType('programme')}
                        />
                        <div className="px-4 py-2 rounded text-sm font-semibold text-[#474551] peer-checked:bg-white peer-checked:text-[#2e2877] peer-checked:shadow-sm transition-all border border-transparent peer-checked:border-[#c8c5d2]">Programme</div>
                      </label>
                      <label className="cursor-pointer">
                        <input 
                          type="radio" 
                          name="entity_type" 
                          className="peer sr-only"
                          checked={entityType === 'sub_programme'}
                          onChange={() => setEntityType('sub_programme')}
                        />
                        <div className="px-4 py-2 rounded text-sm font-semibold text-[#474551] peer-checked:bg-white peer-checked:text-[#2e2877] peer-checked:shadow-sm transition-all border border-transparent peer-checked:border-[#c8c5d2]">Sub-Programme</div>
                      </label>
                      <label className="cursor-pointer">
                        <input 
                          type="radio" 
                          name="entity_type" 
                          className="peer sr-only"
                          checked={entityType === 'course'}
                          onChange={() => setEntityType('course')}
                        />
                        <div className="px-4 py-2 rounded text-sm font-semibold text-[#474551] peer-checked:bg-white peer-checked:text-[#2e2877] peer-checked:shadow-sm transition-all border border-transparent peer-checked:border-[#c8c5d2]">Course</div>
                      </label>
                    </div>
                    {/* Helper Text to explain the Kanvise structure to users */}
                    <div className="mt-3 p-3 bg-[#e8e6fb]/30 border border-[#2e2877]/20 rounded text-sm text-[#474551] leading-relaxed">
                      {entityType === 'programme' && (
                        <span><strong>Programme:</strong> The top-level bundle (e.g., "WAEC Prep 2026"). Students who enroll at this level get access to absolutely everything inside it.</span>
                      )}
                      {entityType === 'sub_programme' && (
                        <span><strong>Sub-Programme:</strong> A nested track or cohort (e.g., "Science Track"). Students who enroll here get access to only the courses within this specific track.</span>
                      )}
                      {entityType === 'course' && (
                        <span><strong>Course:</strong> A single subject or module (e.g., "Chemistry"). This is where you actually host live classes, upload notes, and assign tutors.</span>
                      )}
                    </div>
                  </div>

                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-xs font-semibold text-[#1b1c1c] mb-1">Name <span className="text-[#ba1a1a]">*</span></label>
                    <input 
                      required
                      type="text"
                      value={formData.name}
                      onChange={handleNameChange}
                      className="w-full bg-white border border-[#c8c5d2] rounded px-3 py-2 text-sm focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877] outline-none" 
                      placeholder={
                        entityType === 'programme' ? 'e.g. WAEC Prep 2026' : 
                        entityType === 'sub_programme' ? 'e.g. Science Track' : 
                        'e.g. Chemistry'
                      }
                    />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-xs font-semibold text-[#1b1c1c] mb-1">Slug <span className="text-[#474551] font-normal">(Auto-generated)</span></label>
                    <input 
                      readOnly
                      type="text"
                      value={formData.slug}
                      className="w-full bg-[#f5f3f2] border border-[#c8c5d2] rounded px-3 py-2 text-sm font-mono text-[#474551] outline-none" 
                      placeholder={
                        entityType === 'programme' ? 'waec-prep-2026' : 
                        entityType === 'sub_programme' ? 'science-track' : 
                        'chemistry'
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-[#1b1c1c] mb-1">Description</label>
                    <textarea 
                      value={formData.description}
                      onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                      className="w-full bg-white border border-[#c8c5d2] rounded px-3 py-2 text-sm focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877] outline-none min-h-[100px]" 
                      placeholder={
                        entityType === 'programme' ? 'e.g. A complete preparation bundle covering all core subjects...' : 
                        entityType === 'sub_programme' ? 'e.g. Curated courses for science students...' : 
                        'e.g. Full syllabus for Chemistry, including practicals...'
                      }
                    ></textarea>
                  </div>
                  
                  {/* Parent Selector / Placement */}
                  {entityType === 'sub_programme' && (
                    <div className="col-span-2 md:col-span-1 border-l-2 border-[#994704] pl-4 bg-[#f5f3f2]/50 py-2">
                      <label className="block text-xs font-semibold text-[#1b1c1c] mb-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">account_tree</span> Parent Programme <span className="text-[#ba1a1a]">*</span>
                      </label>
                      <select 
                        required
                        value={formData.programme_id}
                        onChange={e => setFormData(p => ({ ...p, programme_id: e.target.value }))}
                        className="w-full bg-white border border-[#c8c5d2] rounded px-3 py-2 text-sm focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877] outline-none"
                      >
                        <option value="" disabled>Select Programme</option>
                        {programmes.map(p => <option key={p.id} value={p.id}>{p.name} {p.is_published ? '' : '(Draft)'}</option>)}
                      </select>
                    </div>
                  )}

                  {entityType === 'course' && (
                    <div className="col-span-2 border-l-2 border-[#994704] pl-4 bg-[#f5f3f2]/50 py-3 space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#1b1c1c] mb-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">account_tree</span> Course Placement
                        </label>
                        <select 
                          value={formData.course_placement}
                          onChange={e => setFormData(p => ({ ...p, course_placement: e.target.value, programme_id: '', sub_programme_id: '' }))}
                          className="w-full bg-white border border-[#c8c5d2] rounded px-3 py-2 text-sm focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877] outline-none"
                        >
                          <option value="standalone">Standalone (Root Level)</option>
                          <option value="programme">Under a Programme</option>
                          <option value="sub_programme">Under a Sub-Programme</option>
                        </select>
                      </div>

                      {formData.course_placement === 'programme' && (
                        <div>
                          <label className="block text-xs font-semibold text-[#1b1c1c] mb-1">Select Programme <span className="text-[#ba1a1a]">*</span></label>
                          <select 
                            required
                            value={formData.programme_id}
                            onChange={e => setFormData(p => ({ ...p, programme_id: e.target.value }))}
                            className="w-full bg-white border border-[#c8c5d2] rounded px-3 py-2 text-sm focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877] outline-none"
                          >
                            <option value="" disabled>Select Programme</option>
                            {programmes.map(p => <option key={p.id} value={p.id}>{p.name} {p.is_published ? '' : '(Draft)'}</option>)}
                          </select>
                        </div>
                      )}

                      {formData.course_placement === 'sub_programme' && (
                        <div>
                          <label className="block text-xs font-semibold text-[#1b1c1c] mb-1">Select Sub-Programme <span className="text-[#ba1a1a]">*</span></label>
                          <select 
                            required
                            value={formData.sub_programme_id}
                            onChange={e => setFormData(p => ({ ...p, sub_programme_id: e.target.value }))}
                            className="w-full bg-white border border-[#c8c5d2] rounded px-3 py-2 text-sm focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877] outline-none"
                          >
                            <option value="" disabled>Select Sub-Programme</option>
                            {subProgrammes.map(sp => {
                              const prog = programmes.find(p => p.id === sp.programme_id)
                              return (
                                <option key={sp.id} value={sp.id}>
                                  {prog?.name ? `${prog.name} > ` : ''}{sp.name} {sp.is_published ? '' : '(Draft)'}
                                </option>
                              )
                            })}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-xs font-semibold text-[#1b1c1c] mb-1">Base Price (NGN) <span className="text-[#ba1a1a]">*</span></label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#474551] font-semibold">₦</span>
                      <input 
                        required
                        type="number"
                        min="0"
                        value={formData.price}
                        onChange={e => setFormData(p => ({ ...p, price: e.target.value }))}
                        className="w-full bg-white border border-[#c8c5d2] rounded pl-8 pr-3 py-2 text-sm focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877] outline-none" 
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Tutor Assignment (Only for courses) */}
                  {entityType === 'course' && (
                    <div className="col-span-2 border border-[#c8c5d2] rounded p-4 bg-white mt-2">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-semibold text-[#1b1c1c] flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px]">person</span>
                          Assign Tutor (Optional)
                        </label>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={formData.assign_tutor}
                            onChange={e => {
                              const checked = e.target.checked
                              setFormData(p => ({ 
                                ...p, 
                                assign_tutor: checked, 
                                tutor_id: ''
                              }))
                            }}
                          />
                          <div className="w-9 h-5 bg-[#e4e2e1] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#c8c5d2] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#2e2877]"></div>
                        </label>
                      </div>

                      {formData.assign_tutor && (
                        <div className="space-y-3 pt-2 border-t border-[#f5f3f2]">
                          <select 
                            required
                            value={formData.tutor_id}
                            onChange={e => setFormData(p => ({ ...p, tutor_id: e.target.value }))}
                            className="w-full bg-white border border-[#c8c5d2] rounded px-3 py-2 text-sm focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877] outline-none"
                          >
                            <option value="" disabled>Select a Tutor...</option>
                            {tutors.map(t => (
                              <option key={t.id} value={t.kanvise_user_id}>
                                {t.first_name} {t.last_name} {t.role === 'admin' ? '(Admin)' : ''}
                              </option>
                            ))}
                          </select>
                          
                          {tutors.some(t => t.role === 'admin') && (
                            <label className="flex items-center gap-2 cursor-pointer mt-2">
                              <input 
                                type="checkbox" 
                                checked={formData.tutor_id === tutors.find(t => t.role === 'admin')?.kanvise_user_id}
                                onChange={e => {
                                  const adminId = tutors.find(t => t.role === 'admin')?.kanvise_user_id || '';
                                  setFormData(p => ({ ...p, tutor_id: e.target.checked ? adminId : '' }))
                                }}
                                className="text-[#2e2877] focus:ring-[#2e2877] rounded"
                              />
                              <span className="text-sm text-[#474551]">I will be teaching this course myself</span>
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* File Upload */}
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-[#1b1c1c] mb-1">Thumbnail</label>
                    <div className="border-2 border-dashed border-[#c8c5d2] rounded p-6 flex flex-col items-center justify-center bg-white hover:bg-[#f5f3f2] transition-colors cursor-pointer group">
                      <div className="h-12 w-12 rounded-full bg-[#f0eded] flex items-center justify-center mb-2 group-hover:bg-[#2e2877] group-hover:text-white transition-colors">
                        <span className="material-symbols-outlined">cloud_upload</span>
                      </div>
                      <span className="text-sm font-semibold text-[#1b1c1c]">Click to upload or drag and drop</span>
                      <span className="text-xs font-normal text-[#474551] mt-1">SVG, PNG, JPG (max. 2MB)</span>
                    </div>
                  </div>
                </div>
              </form>
            </div>
            
            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-[#c8c5d2] bg-[#ffffff] flex flex-wrap justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-[#1b1c1c] uppercase">Publish Status</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={formData.is_published}
                    onChange={e => setFormData(p => ({ ...p, is_published: e.target.checked }))}
                  />
                  <div className="w-11 h-6 bg-[#c8c5d2] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#c8c5d2] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#994704]"></div>
                </label>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2 rounded text-sm font-semibold text-[#1b1c1c] border border-transparent hover:bg-[#f5f3f2] transition-colors"
                >
                  Cancel
                </button>
                <button 
                  form="create-programme-form"
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2 rounded text-sm font-semibold bg-[#994704] text-white hover:bg-[#753400] transition-colors shadow-sm disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Programme'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
