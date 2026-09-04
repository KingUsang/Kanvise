'use client'

import { createBrowserClient } from '@supabase/ssr'
import { ConnectionState, Participant, RoomEvent } from 'livekit-client'
import { useConnectionState, useRoomContext } from '@livekit/components-react'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { activateMaterial, closeMaterials, synchronizePage } from './presentation-state'

export type TeachingMode = 'whiteboard' | 'presentation'
export type AnnotationPoint = { x: number; y: number }
export type AnnotationStroke = {
  id: string
  color: string
  width: number
  points: AnnotationPoint[]
}
export type PresentationMaterial = {
  id: string
  filename: string
  file_size_bytes: number
  page_count: number | null
  processing_status: 'uploading' | 'processing' | 'ready' | 'failed'
  processing_error: string | null
  sort_order: number
  current_page: number
  is_active: boolean
  annotations: Record<string, AnnotationStroke[]>
  created_at: string
  updated_at: string
}

type Pointer = { x: number; y: number; page: number } | null
type PresentationEvent =
  | { type: 'ACTIVE_MATERIAL'; material: PresentationMaterial }
  | { type: 'PAGE_CHANGE'; materialId: string; page: number }
  | { type: 'PRESENTATION_CLOSE' }
  | { type: 'STATE_RECOVERY_REQUEST' }
  | { type: 'ANNOTATION_ADD'; materialId: string; page: number; stroke: AnnotationStroke }
  | { type: 'ANNOTATIONS_REPLACE'; materialId: string; page: number; annotations: AnnotationStroke[] }
  | { type: 'POINTER'; materialId: string; page: number; x: number; y: number }

const STATE_TOPIC = 'kanvise.presentation.state'
const ANNOTATION_TOPIC = 'kanvise.presentation.annotation'
const POINTER_TOPIC = 'kanvise.presentation.pointer'

type Session = {
  mode: TeachingMode
  materials: PresentationMaterial[]
  active: PresentationMaterial | null
  legacySlides: string[]
  loading: boolean
  materialsOpen: boolean
  setMaterialsOpen: (open: boolean) => void
  remotePointer: Pointer
  getViewUrl: (materialId: string) => Promise<string>
  upload: (file: File, onProgress?: (progress: number) => void) => Promise<void>
  replace: (materialId: string, file: File) => Promise<void>
  activate: (materialId: string) => Promise<void>
  changePage: (page: number) => Promise<void>
  closePresentation: () => Promise<void>
  rename: (materialId: string, filename: string) => Promise<void>
  reorder: (materialId: string, direction: -1 | 1) => Promise<void>
  remove: (materialId: string) => Promise<void>
  saveAnnotations: (page: number, annotations: AnnotationStroke[], added?: AnnotationStroke) => Promise<void>
  clearAnnotations: (page: number) => Promise<void>
  sendPointer: (page: number, point: AnnotationPoint) => void
}

const PresentationContext = createContext<Session | null>(null)

function participantIsHost(participant: Participant | undefined, tutorIdentity: string) {
  return Boolean(participant && tutorIdentity && participant.identity === tutorIdentity)
}

export function PresentationSessionProvider({ classId, isHost, children }: {
  classId: string
  isHost: boolean
  children: React.ReactNode
}) {
  const room = useRoomContext()
  const connectionState = useConnectionState()
  const [mode, setMode] = useState<TeachingMode>('whiteboard')
  const [materials, setMaterials] = useState<PresentationMaterial[]>([])
  const [legacySlides, setLegacySlides] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [materialsOpen, setMaterialsOpen] = useState(false)
  const [remotePointer, setRemotePointer] = useState<Pointer>(null)
  const tutorIdentityRef = useRef('')
  const pointerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const materialsRef = useRef(materials)
  useEffect(() => { materialsRef.current = materials }, [materials])

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  ), [])

  const request = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Your classroom session has expired')
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/live-classes/${classId}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${session.access_token}`, ...(init?.headers || {}) },
    })
    const body = response.status === 204 ? null : await response.json().catch(() => null)
    if (!response.ok) throw new Error(body?.error || 'Classroom request failed')
    return body?.data as T
  }, [classId, supabase])

  const publish = useCallback((event: PresentationEvent, topic: string, reliable: boolean) => {
    if (connectionState !== ConnectionState.Connected) return
    void room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(event)), { topic, reliable }).catch(() => undefined)
  }, [connectionState, room])

  const loadState = useCallback(async () => {
    try {
      const data = await request<{ teaching_mode: TeachingMode; tutor_identity: string; presentations: PresentationMaterial[]; legacy_slide_urls: string[] }>('/presentations')
      tutorIdentityRef.current = data.tutor_identity
      setMode(data.teaching_mode)
      setMaterials(data.presentations)
      setLegacySlides(data.legacy_slide_urls || [])
    } catch (error) {
      toast.error('Could not restore presentation state', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setLoading(false)
    }
  }, [request])

  useEffect(() => {
    setMode('whiteboard')
    setMaterials([])
    setLegacySlides([])
    setMaterialsOpen(false)
    setLoading(true)
    void loadState()
  }, [classId, loadState])

  useEffect(() => {
    if (!materials.some((material) => material.processing_status === 'uploading' || material.processing_status === 'processing')) return
    const timer = window.setTimeout(() => void loadState(), 1500)
    return () => window.clearTimeout(timer)
  }, [loadState, materials])

  useEffect(() => {
    if (connectionState !== ConnectionState.Connected) return
    void loadState()
    if (!isHost) publish({ type: 'STATE_RECOVERY_REQUEST' }, STATE_TOPIC, true)
  }, [connectionState, isHost, loadState, publish])

  useEffect(() => {
    const onData = (payload: Uint8Array, participant?: Participant, _kind?: unknown, topic?: string) => {
      if (![STATE_TOPIC, ANNOTATION_TOPIC, POINTER_TOPIC].includes(topic || '')) return
      let event: PresentationEvent
      try { event = JSON.parse(new TextDecoder().decode(payload)) } catch { return }

      if (event.type === 'STATE_RECOVERY_REQUEST') {
        if (!isHost) return
        const active = materialsRef.current.find((item) => item.is_active)
        if (active) publish({ type: 'ACTIVE_MATERIAL', material: active }, STATE_TOPIC, true)
        else publish({ type: 'PRESENTATION_CLOSE' }, STATE_TOPIC, true)
        return
      }
      // Only the assigned tutor's LiveKit participant may drive student state.
      if (!participantIsHost(participant, tutorIdentityRef.current)) return

      if (event.type === 'ACTIVE_MATERIAL') {
        setMode('presentation')
        setMaterials((items) => activateMaterial(items, event.material))
      } else if (event.type === 'PAGE_CHANGE') {
        setMaterials((items) => synchronizePage(items, event.materialId, event.page))
      } else if (event.type === 'PRESENTATION_CLOSE') {
        setMode('whiteboard')
        setMaterials(closeMaterials)
      } else if (event.type === 'ANNOTATION_ADD') {
        setMaterials((items) => items.map((item) => item.id !== event.materialId ? item : {
          ...item,
          annotations: {
            ...item.annotations,
            [String(event.page)]: [...(item.annotations[String(event.page)] || []).filter((stroke) => stroke.id !== event.stroke.id), event.stroke],
          },
        }))
      } else if (event.type === 'ANNOTATIONS_REPLACE') {
        setMaterials((items) => items.map((item) => item.id !== event.materialId ? item : {
          ...item, annotations: { ...item.annotations, [String(event.page)]: event.annotations },
        }))
      } else if (event.type === 'POINTER') {
        setRemotePointer({ x: event.x, y: event.y, page: event.page })
        if (pointerTimer.current) clearTimeout(pointerTimer.current)
        pointerTimer.current = setTimeout(() => setRemotePointer(null), 1200)
      }
    }
    room.on(RoomEvent.DataReceived, onData)
    return () => {
      room.off(RoomEvent.DataReceived, onData)
      if (pointerTimer.current) clearTimeout(pointerTimer.current)
    }
  }, [isHost, publish, room])

  const active = materials.find((item) => item.is_active) || null

  const getViewUrl = useCallback(async (materialId: string) => {
    const data = await request<{ url: string }>(`/presentations/${materialId}/view`)
    return data.url
  }, [request])

  const activate = useCallback(async (materialId: string) => {
    const material = await request<PresentationMaterial>(`/presentations/${materialId}/activate`, { method: 'POST' })
    setMode('presentation')
    setMaterials((items) => activateMaterial(items, material))
    publish({ type: 'ACTIVE_MATERIAL', material }, STATE_TOPIC, true)
  }, [publish, request])

  const upload = useCallback(async (file: File, onProgress?: (progress: number) => void) => {
    const created = await request<{ material: PresentationMaterial; upload_url: string }>('/presentations/upload', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_name: file.name, content_type: file.type, file_size_bytes: file.size }),
    })
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', created.upload_url)
      xhr.setRequestHeader('Content-Type', file.type)
      xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100)) }
      xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`))
      xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'))
      xhr.send(file)
    })
    const material = await request<PresentationMaterial>(`/presentations/${created.material.id}/complete`, { method: 'POST' })
    setMaterials((items) => [...items.filter((item) => item.id !== material.id), material])
    toast.message('PDF uploaded. Checking pages…')
  }, [request])

  const replace = useCallback(async (materialId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const material = await request<PresentationMaterial>(`/presentations/${materialId}/replace`, { method: 'POST', body: form })
    setMaterials((items) => items.map((item) => item.id === materialId ? material : item))
    if (material.is_active) publish({ type: 'ACTIVE_MATERIAL', material }, STATE_TOPIC, true)
    toast.success('Teaching material replaced')
  }, [publish, request])

  const changePage = useCallback(async (page: number) => {
    if (!active || !active.page_count || page === active.current_page || page < 1 || page > active.page_count) return
    setMaterials((items) => synchronizePage(items, active.id, page))
    publish({ type: 'PAGE_CHANGE', materialId: active.id, page }, STATE_TOPIC, true)
    try { await request(`/presentations/${active.id}/page`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page }) }) }
    catch (error) { void loadState(); toast.error(error instanceof Error ? error.message : 'Could not change page') }
  }, [active, loadState, publish, request])

  const closePresentation = useCallback(async () => {
    await request('/presentations/close', { method: 'POST' })
    setMode('whiteboard')
    setMaterials(closeMaterials)
    publish({ type: 'PRESENTATION_CLOSE' }, STATE_TOPIC, true)
  }, [publish, request])

  const rename = useCallback(async (materialId: string, filename: string) => {
    const material = await request<PresentationMaterial>(`/presentations/${materialId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename }),
    })
    setMaterials((items) => items.map((item) => item.id === materialId ? material : item))
  }, [request])

  const reorder = useCallback(async (materialId: string, direction: -1 | 1) => {
    const index = materials.findIndex((item) => item.id === materialId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= materials.length) return
    const next = [...materials]
    ;[next[index], next[target]] = [next[target], next[index]]
    setMaterials(next.map((item, sort_order) => ({ ...item, sort_order })))
    await request('/presentations/reorder', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ordered_ids: next.map((item) => item.id) }),
    })
  }, [materials, request])

  const remove = useCallback(async (materialId: string) => {
    await request(`/presentations/${materialId}`, { method: 'DELETE' })
    const wasActive = materials.some((item) => item.id === materialId && item.is_active)
    setMaterials((items) => items.filter((item) => item.id !== materialId))
    if (wasActive) {
      setMode('whiteboard')
      publish({ type: 'PRESENTATION_CLOSE' }, STATE_TOPIC, true)
    }
  }, [materials, publish, request])

  const saveAnnotations = useCallback(async (page: number, annotations: AnnotationStroke[], added?: AnnotationStroke) => {
    if (!active) return
    setMaterials((items) => items.map((item) => item.id === active.id ? { ...item, annotations: { ...item.annotations, [String(page)]: annotations } } : item))
    publish(added
      ? { type: 'ANNOTATION_ADD', materialId: active.id, page, stroke: added }
      : { type: 'ANNOTATIONS_REPLACE', materialId: active.id, page, annotations }, ANNOTATION_TOPIC, true)
    try {
      await request(`/presentations/${active.id}/annotations`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page, annotations }),
      })
    } catch (error) {
      void loadState()
      toast.error('Could not save annotations', { description: error instanceof Error ? error.message : undefined })
    }
  }, [active, loadState, publish, request])

  const clearAnnotations = useCallback(async (page: number) => saveAnnotations(page, []), [saveAnnotations])
  const sendPointer = useCallback((page: number, point: AnnotationPoint) => {
    if (!active) return
    publish({ type: 'POINTER', materialId: active.id, page, ...point }, POINTER_TOPIC, false)
  }, [active, publish])

  const value: Session = {
    mode, materials, active, legacySlides, loading, materialsOpen, setMaterialsOpen, remotePointer,
    getViewUrl, upload, replace, activate, changePage, closePresentation, rename, reorder, remove,
    saveAnnotations, clearAnnotations, sendPointer,
  }
  return <PresentationContext.Provider value={value}>{children}</PresentationContext.Provider>
}

export function usePresentationSession() {
  const session = useContext(PresentationContext)
  if (!session) throw new Error('usePresentationSession must be used inside PresentationSessionProvider')
  return session
}
