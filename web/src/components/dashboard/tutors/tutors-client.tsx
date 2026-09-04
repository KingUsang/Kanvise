'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface Tutor {
  id: string
  kanvise_user_id: string
  first_name: string
  last_name: string
  email: string
  bio: string | null
  profile_photo_key: string | null
  role: string
  courses: { id: string; name: string }[]
}

interface Invite {
  id: string
  email: string
  status: string
  expires_at: string
  created_at: string
}

interface AssignmentPerson {
  id: string
  kanvise_user_id: string
  first_name: string
  last_name: string
  email: string
  role: string
}

interface CourseAssignmentOverview {
  id: string
  name: string
  is_published: boolean
  tutors: AssignmentPerson[]
}

export function TutorsClient() {
  const supabase = createClient()
  const [tutors, setTutors] = useState<Tutor[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [assignmentPeople, setAssignmentPeople] = useState<AssignmentPerson[]>([])
  const [courseAssignments, setCourseAssignments] = useState<CourseAssignmentOverview[]>([])
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null)
  const [updatingCourseId, setUpdatingCourseId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [confirmation, setConfirmation] = useState<null | { type: 'revoke'; id: string; email: string } | { type: 'remove'; id: string; name: string }>(null)

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('')
  const [isInviting, setIsInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [generatedLink, setGeneratedLink] = useState('')
  const [copied, setCopied] = useState(false)

  // Action state
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)

  const baseUrl = process.env.NEXT_PUBLIC_API_URL

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return
      setCurrentProfileId(typeof session.user.app_metadata?.profile_id === 'string' ? session.user.app_metadata.profile_id : null)

      const headers = { 'Authorization': `Bearer ${token}` }

      const [tutorsRes, invitesRes, peopleRes, assignmentsRes] = await Promise.all([
        fetch(`${baseUrl}/users/tutors`, { headers }),
        fetch(`${baseUrl}/schools/me/invites`, { headers }),
        fetch(`${baseUrl}/users?roles=admin,tutor`, { headers }),
        fetch(`${baseUrl}/courses/assignment-overview`, { headers }),
      ])
      if (!tutorsRes.ok || !invitesRes.ok || !peopleRes.ok || !assignmentsRes.ok) throw new Error('Could not load your tutors')
      const { data: tutorData } = await tutorsRes.json()
      const { data: inviteData } = await invitesRes.json()
      const { data: peopleData } = await peopleRes.json()
      const { data: assignmentsData } = await assignmentsRes.json()
      setTutors(tutorData || [])
      setInvites(inviteData || [])
      setAssignmentPeople(peopleData || [])
      setCourseAssignments(assignmentsData || [])
    } catch (err) {
      console.error('Failed to fetch data', err)
      setLoadError('We could not load your tutors and invitations. Please check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }, [baseUrl, supabase.auth])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsInviting(true)
    setInviteError('')
    setGeneratedLink('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch(`${baseUrl}/schools/me/invite/tutor`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ email: inviteEmail }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to generate invite link')
      setGeneratedLink(json.data.invite_url)
      setInviteEmail('') // Clear input on success
      await fetchData() // Refresh invites list
      toast.success(json.data.email_sent ? 'Invitation emailed to the tutor' : 'Invitation link created', {
        description: json.data.email_sent ? 'They can use the email to join your centre.' : 'The email could not be sent. Copy and share the link yourself.'
      })
    } catch (err: any) {
      setInviteError(err.message)
    } finally {
      setIsInviting(false)
    }
  }

  const handleResend = async (email: string, id: string) => {
    setResendingId(id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch(`${baseUrl}/schools/me/invite/tutor`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ email }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to resend invite link')
      setGeneratedLink(json.data.invite_url)
      setInviteError('')
      await fetchData() // Refresh invites list
      toast.success('Invitation resent')
    } catch (err: any) {
      toast.error('Could not resend the invitation', { description: err.message })
    } finally {
      setResendingId(null)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      const el = document.createElement('textarea')
      el.value = generatedLink
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const handleRevoke = async (inviteId: string, email: string) => {
    setRevokingId(inviteId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch(`${baseUrl}/schools/me/invites/${inviteId}/revoke`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) {
        const json = await res.json()
        toast.error('Could not revoke the invitation', { description: json.error || 'Please try again.' })
      } else {
        await fetchData()
        toast.success('Invitation revoked')
      }
    } finally {
      setRevokingId(null)
    }
  }

  const handleRemoveTutor = async (tutorId: string, name: string) => {
    setRemovingId(tutorId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch(`${baseUrl}/users/${tutorId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) {
        const json = await res.json()
        toast.error('Could not remove the tutor', { description: json.error || 'Please try again.' })
      } else {
        await fetchData()
        toast.success('Tutor removed')
      }
    } finally {
      setRemovingId(null)
    }
  }

  const updateCourseAssignment = async (courseId: string, person: AssignmentPerson, isAssigned: boolean) => {
    setUpdatingCourseId(courseId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch(
        isAssigned ? `${baseUrl}/courses/${courseId}/tutors/${person.id}` : `${baseUrl}/courses/${courseId}/tutors`,
        {
          method: isAssigned ? 'DELETE' : 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            ...(isAssigned ? {} : { 'Content-Type': 'application/json' }),
          },
          ...(isAssigned ? {} : { body: JSON.stringify({ tutor_id: person.id }) }),
        }
      )
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not update the Subject assignment')
      await fetchData()
      toast.success(isAssigned ? 'Tutor removed from Subject' : 'Tutor assigned to Subject')
    } catch (error) {
      toast.error('Could not update the Subject assignment', { description: error instanceof Error ? error.message : 'Please try again.' })
    } finally {
      setUpdatingCourseId(null)
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const pendingInvites = invites.filter((i) => i.status === 'pending')
  const expiredInvites = invites.filter((i) => i.status === 'expired')
  const activeInvites = [...pendingInvites, ...expiredInvites].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#474551]">Your teaching team</span>
          <h2 className="mt-2 text-[32px] leading-[40px] font-bold tracking-tight text-[#1b1c1c]">Tutors</h2>
          <p className="text-[16px] text-[#474551] mt-1">
            Invite tutors to your centre and see the Subjects assigned to each person. If you teach alone, you do not need to invite yourself.
          </p>
        </div>
      </div>

      {/* ── Bento Grid Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Main Tutors List (Spans 8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="bg-white rounded-lg border border-[#c2b59b] shadow-[0_4px_20px_rgba(61,61,61,0.08)] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-[#c2b59b] flex justify-between items-center bg-[#fbf9f8]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-[#2e2877]/10 flex items-center justify-center text-[#2e2877]">
                  <span className="material-symbols-outlined icon-fill">school</span>
                </div>
                <h3 className="text-[20px] font-semibold text-[#1b1c1c]">Tutors in your centre</h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-[#f5f3f2] text-[#474551] border-b border-[#c2b59b]">
                    <th className="py-3 px-6 text-[12px] font-semibold uppercase tracking-wider">Tutor</th>
                    <th className="py-3 px-6 text-[12px] font-semibold uppercase tracking-wider">Assigned Subjects</th>
                    <th className="py-3 px-6 text-[12px] font-semibold uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-[14px] text-[#1b1c1c]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-[#474551]">
                        <div className="flex items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#2e2877]" />
                          Loading tutors...
                        </div>
                      </td>
                    </tr>
                  ) : loadError ? (
                    <tr><td colSpan={3} className="px-6 py-12 text-center"><p className="text-sm text-[#474551]">{loadError}</p><button type="button" onClick={fetchData} className="mt-4 rounded bg-[#2e2877] px-4 py-2 text-sm font-semibold text-white">Try again</button></td></tr>
                  ) : tutors.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-12 text-center text-[#474551]">
                        <span className="material-symbols-outlined text-[48px] text-[#c8c5d2] mb-2">group_off</span>
                        <p className="font-medium">No tutors yet</p>
                        <p className="text-sm mt-1 max-w-sm mx-auto">You are currently teaching on your own. Invite someone only when another tutor needs access to teach Subjects in your centre.</p>
                      </td>
                    </tr>
                  ) : (
                    tutors.map((tutor) => {
                      const initials = `${tutor.first_name[0]}${tutor.last_name[0]}`.toUpperCase()
                      const isRemoving = removingId === tutor.id
                      return (
                        <tr key={tutor.id} className={`border-b border-[#c2b59b] hover:bg-[#2e2877]/5 transition-colors group ${isRemoving ? 'opacity-40' : ''}`}>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded bg-[#e4e2e1] border border-[#c8c5d2] flex items-center justify-center text-[#474551] font-bold flex-shrink-0">
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-[#1b1c1c] truncate">
                                    {tutor.first_name} {tutor.last_name}
                                  </p>
                                </div>
                                <p className="text-xs text-[#474551] truncate">{tutor.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <p className="font-medium">{tutor.courses.length} Assigned</p>
                            {tutor.courses.length > 0 ? (
                              <p className="text-xs text-[#474551] truncate w-48" title={tutor.courses.map(c => c.name).join(', ')}>
                                {tutor.courses.map(c => c.name).join(', ')}
                              </p>
                            ) : (
                              <p className="text-xs text-[#c8c5d2] italic">No active subjects</p>
                            )}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <button
                              onClick={() => setConfirmation({ type: 'remove', id: tutor.id, name: `${tutor.first_name} ${tutor.last_name}` })}
                              disabled={isRemoving}
                              title="Remove tutor"
                              className="text-[#2e2877] hover:text-[#ba1a1a] transition-colors p-2 rounded hover:bg-[#eae8e7] disabled:opacity-30 inline-flex items-center justify-center"
                            >
                              <span className="material-symbols-outlined">person_remove</span>
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            {!isLoading && tutors.length > 0 && (
              <div className="p-4 border-t border-[#c2b59b] bg-[#fbf9f8] flex justify-between items-center text-[14px]">
                <span className="text-[#474551]">Total: {tutors.length} tutor{tutors.length !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-lg border border-[#c2b59b] bg-white shadow-[0_4px_20px_rgba(61,61,61,0.08)]">
            <div className="border-b border-[#c2b59b] bg-[#fbf9f8] p-6">
              <h3 className="text-[20px] font-semibold text-[#1b1c1c]">Teaching assignments</h3>
              <p className="mt-1 text-sm text-[#474551]">Choose who teaches each Subject. A published Subject must always have at least one tutor.</p>
            </div>
            {courseAssignments.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#474551]">Create a Subject before assigning tutors.</div>
            ) : (
              <div className="divide-y divide-[#e4e2e1]">
                {courseAssignments.map((course) => {
                  const availablePeople = assignmentPeople.filter((person) => !course.tutors.some((tutor) => tutor.id === person.id))
                  return (
                    <div key={course.id} className="p-5">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-[#1b1c1c]">{course.name}</p>
                            {course.tutors.length === 0 && <span className="rounded bg-[#ffdad6] px-2 py-0.5 text-[10px] font-bold uppercase text-[#ba1a1a]">No tutor</span>}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {course.tutors.map((person) => (
                              <span key={person.id} className="inline-flex items-center gap-1 rounded-full border border-[#c8c5d2] bg-[#f5f3f2] py-1 pl-3 pr-1 text-xs text-[#474551]">
                                {person.first_name} {person.last_name}{person.id === currentProfileId ? ' (you)' : ''}
                                <button type="button" disabled={updatingCourseId === course.id} onClick={() => void updateCourseAssignment(course.id, person, true)} className="rounded-full p-1 hover:bg-[#ffdad6] hover:text-[#ba1a1a]" aria-label={`Remove ${person.first_name} from ${course.name}`}>
                                  <span className="material-symbols-outlined text-[15px]">close</span>
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                        <select
                          aria-label={`Assign a tutor to ${course.name}`}
                          value=""
                          disabled={updatingCourseId === course.id || availablePeople.length === 0}
                          onChange={(event) => { const person = assignmentPeople.find((item) => item.id === event.target.value); if (person) void updateCourseAssignment(course.id, person, false) }}
                          className="min-w-48 rounded border border-[#c8c5d2] bg-white px-3 py-2 text-sm text-[#474551] outline-none focus:border-[#2e2877] disabled:bg-[#f0eded]"
                        >
                          <option value="">{availablePeople.length === 0 ? 'Everyone assigned' : 'Add a tutor…'}</option>
                          {availablePeople.map((person) => <option key={person.id} value={person.id}>{person.first_name} {person.last_name}{person.id === currentProfileId ? ' (you)' : ''}</option>)}
                        </select>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar Area (Spans 4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Invite Action Card */}
          <div className="bg-[#2e2877] text-white rounded-lg shadow-[0_12px_32px_rgba(46,40,119,0.12)] p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 opacity-10 pointer-events-none transform translate-x-1/4 -translate-y-1/4">
              <span className="material-symbols-outlined text-[150px]">hub</span>
            </div>
            
            <h3 className="text-[20px] font-semibold mb-2 relative z-10">Invite a tutor</h3>
            <p className="text-[14px] text-white/80 mb-6 relative z-10">
              Enter their email address. We will email them a link to join your centre, and you can also copy the link yourself.
            </p>
            
            <form onSubmit={handleInvite} className="flex flex-col gap-4 relative z-10">
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-semibold text-white/90 uppercase tracking-wider">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="tutor@example.com"
                  className="bg-white/10 border border-white/30 text-white placeholder:text-white/50 rounded-lg p-3 text-[14px] focus:ring-2 focus:ring-[#994704] focus:border-transparent outline-none transition-all"
                />
              </div>

              {inviteError && (
                <div className="bg-[#ba1a1a]/20 border border-[#ba1a1a]/50 rounded-lg p-3 text-[12px] text-[#ffdad6] flex items-start gap-2">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <p>{inviteError}</p>
                </div>
              )}

              {generatedLink && (
                <div className="bg-[#386a1f]/20 border border-[#386a1f]/50 rounded-lg p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-[#b5f299] text-[12px] font-bold">
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    Invitation link ready
                  </div>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={generatedLink}
                      className="flex-1 bg-black/20 border border-white/20 rounded p-2 text-[11px] text-white/80 font-mono outline-none min-w-0"
                    />
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="bg-white/20 hover:bg-white/30 text-white px-3 rounded text-[12px] font-semibold transition-colors flex items-center justify-center flex-shrink-0"
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isInviting || !inviteEmail}
                className="mt-2 bg-[#994704] hover:bg-[#a65006] text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-md disabled:opacity-60"
              >
                {isInviting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                ) : (
                  <>
                    <span className="material-symbols-outlined icon-fill">send</span>
                    Send invitation
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Pending Invites List */}
          <div className="bg-white rounded-lg border border-[#c2b59b] shadow-[0_4px_20px_rgba(61,61,61,0.08)] flex flex-col">
            <div className="p-4 border-b border-[#c2b59b] bg-[#f5f3f2]">
              <h3 className="text-[12px] font-semibold uppercase tracking-wider text-[#474551] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">pending_actions</span>
                Invitations awaiting response
              </h3>
            </div>
            
            <div className="flex flex-col divide-y divide-[#c2b59b]">
              {isLoading ? (
                <div className="p-6 text-center text-[#474551] text-[14px]">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#2e2877] mx-auto mb-2" />
                  Loading...
                </div>
              ) : activeInvites.length === 0 ? (
                <div className="p-6 text-center text-[#474551] text-[14px] italic">
                  No outstanding invitations.
                </div>
              ) : (
                activeInvites.map((invite) => {
                  const isExpired = invite.status === 'expired'
                  const isRevoking = revokingId === invite.id
                  const isResending = resendingId === invite.id
                  
                  return (
                    <div key={invite.id} className={`p-4 flex flex-col gap-2 transition-colors ${isExpired ? 'bg-[#f5f3f2] opacity-80' : 'hover:bg-[#fbf9f8]'}`}>
                      <div className="flex justify-between items-start">
                        <p className={`font-bold text-[#1b1c1c] text-[14px] ${isExpired ? 'line-through decoration-[#787582]' : ''} truncate pr-2`}>
                          {invite.email}
                        </p>
                        {isExpired ? (
                          <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-sm bg-[#ffdad6] text-[#ba1a1a] text-[10px] font-bold uppercase tracking-wider border border-[#ba1a1a]/20">
                            Expired
                          </span>
                        ) : (
                          <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-sm bg-[#ff9653]/20 text-[#994704] text-[10px] font-bold uppercase tracking-wider">
                            Pending
                          </span>
                        )}
                      </div>
                      
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-[12px] text-[#474551]">
                            Sent: {new Date(invite.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                          {!isExpired && (
                            <p className="text-[12px] text-[#994704] mt-0.5 flex items-center gap-1 font-medium">
                              <span className="material-symbols-outlined text-[14px]">schedule</span>
                              Expires {new Date(invite.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            </p>
                          )}
                        </div>
                        
                        {isExpired ? (
                          <button
                            onClick={() => handleResend(invite.email, invite.id)}
                            disabled={isResending}
                            className="text-[12px] text-[#2e2877] hover:text-[#180d62] transition-colors font-bold uppercase tracking-wider disabled:opacity-50"
                          >
                            {isResending ? 'Sending...' : 'Resend'}
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirmation({ type: 'revoke', id: invite.id, email: invite.email })}
                            disabled={isRevoking}
                            className="text-[12px] text-[#787582] hover:text-[#ba1a1a] transition-colors font-bold uppercase tracking-wider disabled:opacity-50"
                          >
                            {isRevoking ? 'Revoking...' : 'Revoke'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

        </div>
      </div>
      {confirmation && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#1b1c1c]/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-lg border border-[#c8c5d2] bg-white p-6 shadow-xl">
            <h3 className="text-xl font-bold text-[#1b1c1c]">{confirmation.type === 'remove' ? 'Remove this tutor?' : 'Cancel this invitation?'}</h3>
            <p className="mt-2 text-sm leading-6 text-[#474551]">
              {confirmation.type === 'remove'
                ? `${confirmation.name} will lose access to your centre. Their previous teaching records will be kept.`
                : `The invitation sent to ${confirmation.email} will stop working.`}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmation(null)} className="rounded px-4 py-2 text-sm font-semibold text-[#474551] hover:bg-[#f5f3f2]">Keep it</button>
              <button type="button" onClick={() => { const action = confirmation; setConfirmation(null); if (action.type === 'remove') void handleRemoveTutor(action.id, action.name); else void handleRevoke(action.id, action.email) }} className="rounded bg-[#ba1a1a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#93000a]">
                {confirmation.type === 'remove' ? 'Remove tutor' : 'Cancel invitation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
