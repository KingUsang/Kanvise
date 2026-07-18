'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

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

export function TutorsClient() {
  const supabase = createClient()
  const [tutors, setTutors] = useState<Tutor[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [isLoading, setIsLoading] = useState(true)

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
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return

      const headers = { 'Authorization': `Bearer ${token}` }

      const [tutorsRes, invitesRes] = await Promise.all([
        fetch(`${baseUrl}/users/tutors`, { headers }),
        fetch(`${baseUrl}/schools/invites`, { headers }),
      ])
      if (tutorsRes.ok) {
        const { data } = await tutorsRes.json()
        setTutors(data || [])
      }
      if (invitesRes.ok) {
        const { data } = await invitesRes.json()
        setInvites(data || [])
      }
    } catch (err) {
      console.error('Failed to fetch data', err)
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

      const res = await fetch(`${baseUrl}/schools/invites`, {
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

      const res = await fetch(`${baseUrl}/schools/invites`, {
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
    } catch (err: any) {
      alert(err.message)
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
    if (!confirm(`Revoke the invite for ${email}? The link they received will no longer work.`)) return
    setRevokingId(inviteId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch(`${baseUrl}/schools/invites/${inviteId}/revoke`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) {
        const json = await res.json()
        alert(json.error || 'Failed to revoke invite')
      } else {
        await fetchData()
      }
    } finally {
      setRevokingId(null)
    }
  }

  const handleRemoveTutor = async (tutorId: string, name: string) => {
    if (!confirm(`Remove ${name} from your school?\n\nTheir account will lose access, but all their historical data is preserved.`)) return
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
        alert(json.error || 'Failed to remove tutor')
      } else {
        await fetchData()
      }
    } finally {
      setRemovingId(null)
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
          <h2 className="text-[32px] leading-[40px] font-bold tracking-tight text-[#1b1c1c] font-['Plus_Jakarta_Sans']">Tutor Directory</h2>
          <p className="text-[16px] text-[#474551] mt-1 font-['Plus_Jakarta_Sans']">
            Manage teaching staff, assignments, and invitations.
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
                <h3 className="text-[20px] font-semibold text-[#1b1c1c] font-['Plus_Jakarta_Sans']">Active Roster</h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-[#f5f3f2] text-[#474551] border-b border-[#c2b59b]">
                    <th className="py-3 px-6 text-[12px] font-semibold uppercase tracking-wider">Tutor</th>
                    <th className="py-3 px-6 text-[12px] font-semibold uppercase tracking-wider">Active Courses</th>
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
                  ) : tutors.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-12 text-center text-[#474551]">
                        <span className="material-symbols-outlined text-[48px] text-[#c8c5d2] mb-2">group_off</span>
                        <p className="font-medium">No tutors yet</p>
                        <p className="text-sm mt-1 max-w-xs mx-auto">Invite a tutor from the panel to get started.</p>
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
                                  <span className="hidden md:inline text-[10px] text-[#474551] font-mono bg-[#f5f3f2] px-1.5 py-0.5 rounded border border-[#e4e2e1]">
                                    {tutor.kanvise_user_id}
                                  </span>
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
                              <p className="text-xs text-[#c8c5d2] italic">No active courses</p>
                            )}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <button
                              onClick={() => handleRemoveTutor(tutor.id, `${tutor.first_name} ${tutor.last_name}`)}
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
        </div>

        {/* Right Sidebar Area (Spans 4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Invite Action Card */}
          <div className="bg-[#2e2877] text-white rounded-lg shadow-[0_12px_32px_rgba(46,40,119,0.12)] p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 opacity-10 pointer-events-none transform translate-x-1/4 -translate-y-1/4">
              <span className="material-symbols-outlined text-[150px]">hub</span>
            </div>
            
            <h3 className="text-[20px] font-semibold mb-2 relative z-10">Onboard New Tutor</h3>
            <p className="text-[14px] text-white/80 mb-6 relative z-10">
              Generate a secure portal access link for new faculty members.
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
                  placeholder="faculty@institution.edu.ng"
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
                    Link Generated
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
                    Generate Invitation
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
                Access Keys
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
                  No active or expired invites.
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
                            onClick={() => handleRevoke(invite.id, invite.email)}
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
    </div>
  )
}
