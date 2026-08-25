'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { startNavigationProgress } from '@/components/navigation/NavigationProgress'

interface MockExam {
  id: string
  title: string
  status: 'draft' | 'published' | 'archived'
  distribution_mode?: 'centre' | 'marketplace' | 'both'
  marketplace_approval_status?: 'not_requested' | 'pending' | 'approved' | 'rejected'
  course?: { name: string }
  total_mcq_questions: number
  total_theory_questions: number
  publish_at: string | null
  updated_at: string
  created_at: string
  metrics: {
    attempts: number
    pending_grading: number
  }
}

type MarketplaceListing = {
  id: string
  source_mock_id: string
  approval_status: 'draft' | 'submitted' | 'approved' | 'rejected'
  publication_status: 'unlisted' | 'listed' | 'withdrawn' | 'suspended'
}

// Native date formatting helpers
function formatDistanceToNow(date: Date) {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 60) return `${diffMins} minutes`
  if (diffHours < 24) return `${diffHours} hours`
  return `${diffDays} days`
}

function formatMMMdd(date: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit' }).format(date)
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }).format(date)
}

interface MocksManagementClientProps {
  token: string
  capabilities: { isAdmin: boolean; isTutor: boolean }
  user: { id: string; first_name: string; last_name: string }
}

export function MocksManagementClient({ token, capabilities, user }: MocksManagementClientProps) {
  const router = useRouter()
  const [mocks, setMocks] = useState<MockExam[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterCourse, setFilterCourse] = useState<string>('all')
  const [apiError, setApiError] = useState<string | null>(null)
  const [mockToArchive, setMockToArchive] = useState<MockExam | null>(null)
  const [isArchiving, setIsArchiving] = useState(false)
  const [marketplaceListings, setMarketplaceListings] = useState<MarketplaceListing[]>([])
  const [approvingListingId, setApprovingListingId] = useState<string | null>(null)

  const baseUrl = process.env.NEXT_PUBLIC_API_URL

  const fetchMocks = useCallback(async () => {
    setIsLoading(true)
    setApiError(null)
    try {
      const [res, listingsRes] = await Promise.all([
        fetch(`${baseUrl}/mocks`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${baseUrl}/marketplace/creator/listings`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (res.ok) {
        const { data } = await res.json()
        setMocks(data || [])
        if (listingsRes.ok) {
          const listingsBody = await listingsRes.json()
          setMarketplaceListings(listingsBody.data || [])
        }
      } else {
        const errJson = await res.json()
        console.error('API Error:', errJson)
        setApiError(errJson.error || `HTTP Error ${res.status}`)
      }
    } catch (err: any) {
      console.error('Failed to fetch mocks:', err)
      setApiError(err.message || 'Network error')
    } finally {
      setIsLoading(false)
    }
  }, [baseUrl, token])

  const approveMarketplaceListing = async (listingId: string) => {
    setApprovingListingId(listingId)
    try {
      const response = await fetch(`${baseUrl}/marketplace/creator/listings/${listingId}/approve`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || 'Could not approve this public listing')
      toast.success('Mock is now listed publicly')
      await fetchMocks()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not approve this public listing')
    } finally { setApprovingListingId(null) }
  }

  useEffect(() => {
    fetchMocks()
  }, [fetchMocks])

  const archiveMock = async () => {
    if (!mockToArchive) return
    setIsArchiving(true)
    try {
      const response = await fetch(`${baseUrl}/mocks/${mockToArchive.id}/archive`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || 'Failed to archive mock')
      toast.success('Mock archived', { description: 'Its attempts and results are still available.' })
      setMockToArchive(null)
      await fetchMocks()
    } catch (error) {
      toast.error('Could not archive the mock', {
        description: error instanceof Error ? error.message : 'Please try again.'
      })
    } finally {
      setIsArchiving(false)
    }
  }

  const uniqueCourses = Array.from(new Set(mocks.map(m => m.course?.name).filter(Boolean))) as string[]

  const filteredMocks = mocks.filter((mock) => {
    const statusMatch = filterStatus === 'all' || mock.status === filterStatus
    const courseMatch = filterCourse === 'all' || mock.course?.name === filterCourse
    return statusMatch && courseMatch
  })

  return (
    <div className="w-full animate-in fade-in duration-500">
      {mockToArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-labelledby="archive-mock-title">
          <div className="w-full max-w-md rounded-xl border border-[#e4e2e1] bg-white p-6 shadow-xl">
            <h2 id="archive-mock-title" className="text-lg font-semibold text-[#1b1c1c]">Archive this mock?</h2>
            <p className="mt-2 text-sm text-[#474551]">
              {mockToArchive.title} will leave the active list, but its attempts and results will be preserved.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" disabled={isArchiving} onClick={() => setMockToArchive(null)} className="rounded-md px-4 py-2 text-sm font-semibold text-[#474551] hover:bg-[#f5f3f2] disabled:opacity-50">Cancel</button>
              <button type="button" disabled={isArchiving} onClick={archiveMock} className="rounded-md bg-[#994704] px-4 py-2 text-sm font-semibold text-white hover:bg-[#7a3903] disabled:opacity-50">
                {isArchiving ? 'Archiving…' : 'Archive mock'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header Section */}
      <div className="flex justify-between items-end mb-8 border-b border-[#e4e2e1] pb-6">
        <div>
          <h1 className="text-[32px] leading-[40px] tracking-tight font-bold text-[#1b1c1c] mb-2">Mocks</h1>
          <p className="text-[16px] text-[#474551]">Create practice exams, publish them to students, and review their results.</p>
        </div>
        <Link href="/dashboard/mocks/builder" className="bg-[#994704] text-white text-[14px] font-semibold px-6 py-3 rounded-lg hover:bg-[#7a3903] transition-colors flex items-center gap-2 shadow-[0px_4px_20px_rgba(61,61,61,0.08)]">
            <span className="material-symbols-outlined text-[20px]">add</span>
            Create Mock
        </Link>
      </div>

      {/* Filters & Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        {/* Status Tabs */}
        <div className="flex bg-[#f5f3f2] p-1 rounded-md border border-[#c8c5d2] overflow-x-auto w-full lg:w-auto">
          {[
            { id: 'all', label: 'All Mocks' },
            { id: 'draft', label: 'Drafts' },
            { id: 'published', label: 'Published' },
            { id: 'archived', label: 'Archived' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-5 py-2 text-[12px] font-semibold tracking-wider rounded-sm whitespace-nowrap transition-colors ${
                filterStatus === tab.id 
                  ? 'bg-white text-[#180d62] shadow-sm' 
                  : 'text-[#474551] hover:text-[#180d62]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Course Dropdown */}
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-semibold text-[#474551] uppercase tracking-widest">Filter by Subject:</span>
          <div className="relative">
            <select 
              value={filterCourse}
              onChange={(e) => setFilterCourse(e.target.value)}
              className="appearance-none bg-white border border-[#c8c5d2] text-[#1b1c1c] text-[14px] py-2 pl-4 pr-10 focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877] rounded-md shadow-sm min-w-[220px]"
            >
              <option value="all">All Active Subjects</option>
              {uniqueCourses.map(courseName => (
                <option key={courseName} value={courseName}>{courseName}</option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[#787582] pointer-events-none text-[20px]">
              expand_more
            </span>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white border border-[#c2b59b] rounded-xl shadow-[0px_4px_20px_rgba(61,61,61,0.08)] overflow-hidden mb-12">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-[#f5f3ed] border-b border-[#c2b59b]">
                <th className="py-4 px-6 text-[12px] font-semibold text-[#474551] uppercase tracking-widest">Mock Details</th>
                <th className="py-4 px-6 text-[12px] font-semibold text-[#474551] uppercase tracking-widest">Status</th>
                <th className="py-4 px-6 text-[12px] font-semibold text-[#474551] uppercase tracking-widest text-right">Metrics</th>
                <th className="py-4 px-6 text-[12px] font-semibold text-[#474551] uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4e2e1]">
              {apiError ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center text-[#ba1a1a]">
                    <div className="flex flex-col items-center justify-center">
                      <span className="material-symbols-outlined text-[32px] mb-2">error</span>
                      <p className="font-semibold">We could not load your mocks</p>
                      <p className="text-[14px] mt-1">{apiError}</p>
                      <button
                        type="button"
                        onClick={fetchMocks}
                        className="mt-4 rounded-md border border-[#994704] px-4 py-2 text-sm font-semibold text-[#994704] hover:bg-[#994704]/5"
                      >
                        Try again
                      </button>
                    </div>
                  </td>
                </tr>
              ) : isLoading ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center text-[#474551]">
                    <div className="flex justify-center"><div className="animate-spin h-8 w-8 border-b-2 border-[#180d62] rounded-full"></div></div>
                  </td>
                </tr>
              ) : filteredMocks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-0 border-none">
                    {filterStatus === 'all' ? (
                      <div className="bg-white p-16 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 bg-[#f0eded] rounded-full flex items-center justify-center mb-5 text-[#787582]">
                          <span className="material-symbols-outlined text-[32px]">quiz</span>
                        </div>
                        <h4 className="text-[20px] font-semibold text-[#1b1c1c] mb-2">No mocks yet</h4>
                        <p className="text-[14px] text-[#474551] max-w-[280px] mb-8">Create your first mock exam to start assessing your students' progress.</p>
                        <Link href="/dashboard/mocks/builder">
                          <button className="bg-[#994704] text-white text-[14px] font-semibold px-6 py-3 rounded-lg hover:bg-[#7a3903] transition-colors">
                            Create First Mock
                          </button>
                        </Link>
                      </div>
                    ) : (
                      <div className="py-16 text-center text-[#474551] text-[16px]">
                        No {filterStatus} mocks found.
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredMocks.map(mock => {
                  const totalQs = mock.total_mcq_questions + mock.total_theory_questions
                  const marketplaceListing = marketplaceListings.find(listing => listing.source_mock_id === mock.id)
                  
                  return (
                    <tr key={mock.id} className={`hover:bg-[#f3f0f0] transition-colors group ${mock.status === 'archived' ? 'opacity-60' : ''}`}>
                      <td className="py-5 px-6">
                        <div className="flex flex-col gap-1">
                          <span className={`text-[18px] font-semibold transition-colors ${mock.status === 'archived' ? 'text-[#474551]' : 'text-[#1b1c1c] group-hover:text-[#180d62]'}`}>
                            {mock.title}
                          </span>
                          <span className={`text-[14px] ${mock.status === 'archived' ? 'text-[#787582]' : 'text-[#474551]'}`}>
                            {mock.course?.name || (mock.distribution_mode === 'marketplace' ? 'Public marketplace' : 'Subject unavailable')} • {mock.status === 'draft' ? `Last edited ${formatDistanceToNow(new Date(mock.updated_at))} ago` : mock.status === 'archived' ? `Archived ${formatMMMdd(new Date(mock.updated_at))}` : `Created ${formatMMMdd(new Date(mock.created_at))}`}
                          </span>
                        </div>
                      </td>

                      <td className="py-5 px-6 align-top pt-6">
                        {mock.status === 'published' && (
                          <div className="flex flex-col items-start gap-2"><span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F5E9] text-[#2E7D32] text-[11px] font-semibold border border-[#A5D6A7]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#4CAF50]"></span> Published
                          </span>{marketplaceListing?.approval_status === 'submitted' && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#fff4e5] text-[#8a4b08] text-[11px] font-semibold border border-[#f0c987]">Awaiting your marketplace approval</span>}{marketplaceListing?.publication_status === 'listed' && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#f0edff] text-[#2e2877] text-[11px] font-semibold border border-[#d9d3ef]">Live publicly</span>}</div>
                        )}
                        {mock.status === 'draft' && (
                          <div className="flex flex-col gap-2 items-start">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f0eded] text-[#474551] text-[11px] font-semibold border border-[#c8c5d2]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#787582]"></span> Draft
                            </span>
                            {mock.marketplace_approval_status === 'pending' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#fff4e5] text-[#8a4b08] text-[11px] font-semibold border border-[#f0c987]">
                                <span className="material-symbols-outlined text-[14px]">schedule</span> Awaiting admin approval
                              </span>
                            )}
                            {mock.publish_at && new Date(mock.publish_at) > new Date() && (
                              <span className="flex items-center gap-1 text-[#2e2877] text-[11px] font-semibold mt-1">
                                <span className="material-symbols-outlined text-[14px]">schedule</span> {formatDateTime(new Date(mock.publish_at))}
                              </span>
                            )}
                          </div>
                        )}
                        {mock.status === 'archived' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#e4e2e1] text-[#787582] text-[11px] font-semibold border border-[#c8c5d2]">
                            <span className="material-symbols-outlined text-[14px]">inventory_2</span> Archived
                          </span>
                        )}
                      </td>

                      <td className="py-5 px-6 text-right align-top pt-6">
                        <div className={`flex flex-col items-end gap-1 ${mock.status === 'archived' ? 'text-[#787582]' : ''}`}>
                          <div className="flex items-center justify-end gap-3 w-full">
                            <span className="text-[14px] text-[#474551] min-w-[78px] text-right" title="Questions">{totalQs} questions</span>
                            <span className="text-[#c8c5d2]">|</span>
                            <span className={`text-[16px] min-w-[32px] text-right ${mock.status === 'draft' ? 'text-[#474551]' : 'font-semibold text-[#1b1c1c]'}`} title="Attempts">
                              {mock.status === 'draft' ? '-' : mock.metrics.attempts}
                            </span>
                          </div>
                          {mock.metrics.pending_grading > 0 && mock.status !== 'draft' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#ffdad6] text-[#ba1a1a] text-[11px] font-semibold rounded border border-[#ba1a1a]/20 mt-2">
                              <span className="material-symbols-outlined text-[14px]">edit_note</span> {mock.metrics.pending_grading} pending grading
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-5 px-6 text-right align-top pt-6">
                        {mock.status === 'published' && (
                          <div className="flex items-center justify-end gap-3">
                            {capabilities.isAdmin && marketplaceListing?.approval_status === 'submitted' && <button disabled={approvingListingId === marketplaceListing.id} onClick={() => void approveMarketplaceListing(marketplaceListing.id)} className="text-[#2e2877] text-[12px] font-semibold hover:underline disabled:opacity-50">{approvingListingId === marketplaceListing.id ? 'Publishing…' : 'Approve & list'}</button>}
                            <button onClick={() => setMockToArchive(mock)} className="text-[#787582] text-[12px] font-semibold hover:text-[#994704]">Archive</button>
                            <button onClick={() => { startNavigationProgress(); router.push(`/dashboard/mocks/${mock.id}/results`) }} className="text-[#994704] text-[12px] font-semibold hover:underline">View Results</button>
                          </div>
                        )}
                        {mock.status === 'draft' && (
                          <button onClick={() => { startNavigationProgress(); router.push(`/dashboard/mocks/builder?id=${mock.id}`) }} className="text-[#994704] text-[12px] font-semibold hover:underline">
                            {capabilities.isAdmin && mock.marketplace_approval_status === 'pending' ? 'Review & publish' : 'Edit Mock'}
                          </button>
                        )}
                        {mock.status === 'archived' && (
                          <button onClick={() => { startNavigationProgress(); router.push(`/dashboard/mocks/${mock.id}/results`) }} className="text-[#787582] text-[12px] font-semibold hover:text-[#994704] hover:underline">View Results</button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
