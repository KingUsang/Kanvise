'use client'

import React, { useState } from 'react'
import { toast } from 'sonner'
import { PUBLIC_APP_HOST } from '@/config/app'
import { getApiUrl } from '@/config/api'
import { createClient } from '@/lib/supabase/client'

export function slugifyCentreName(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64)
}

export function withCacheVersion(url: string, version = Date.now()) {
  if (!url) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}v=${version}`
}

export function uploadFileWithProgress(url: string, file: File, onProgress: (progress: number | null) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', url)
    request.setRequestHeader('Content-Type', file.type)
    request.upload.addEventListener('progress', (event) => {
      onProgress(event.lengthComputable && event.total > 0 ? Math.round((event.loaded / event.total) * 100) : null)
    })
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) resolve()
      else reject(new Error('Could not upload file to storage'))
    })
    request.addEventListener('error', () => reject(new Error('The upload was interrupted by a network error')))
    request.addEventListener('abort', () => reject(new Error('The upload was cancelled')))
    request.send(file)
  })
}

function UploadStatus({ label, progress }: { label: string, progress: number | null }) {
  return (
    <div className="w-full" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-xs font-semibold">
        <span>{label}</span>
        {progress !== null && <span>{progress}%</span>}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/60">
        <div className={`h-full rounded-full bg-[#994704] transition-[width] ${progress === null ? 'w-1/3 animate-pulse' : ''}`} style={progress === null ? undefined : { width: `${progress}%` }} />
      </div>
    </div>
  )
}

export function SchoolSetupForm({ initialData, token }: { initialData: any, token: string }) {
  const isFirstSetup = !initialData?.id
  const canUploadMedia = Boolean(initialData?.id)
  const initialFormData = {
    name: initialData?.name || '',
    slug: initialData?.slug || '',
    description: initialData?.description || '',
    contact_email: initialData?.contact_email || '',
    contact_phone: initialData?.contact_phone || '',
    website_url: initialData?.website_url || '',
    instagram_url: initialData?.instagram_url || '',
    twitter_url: initialData?.twitter_url || '',
    facebook_url: initialData?.facebook_url || '',
    whatsapp_number: initialData?.whatsapp_number || '',
    is_active: initialData?.is_active ?? true,
  }
  const [savedFormData, setSavedFormData] = useState(initialFormData)
  const [formData, setFormData] = useState(initialFormData)

  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success'>('idle')
  const [mediaUrls, setMediaUrls] = useState({
    logo: initialData?.logo_url || '',
    banner: initialData?.banner_url || '',
    video_intro: initialData?.video_intro_url || '',
  })
  const [uploadingMedia, setUploadingMedia] = useState<'logo' | 'banner' | 'video_intro' | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [isEditingSlug, setIsEditingSlug] = useState(false)

  const uploadMedia = async (entityType: 'logo' | 'banner' | 'video_intro', file?: File) => {
    if (!file) return
    const isVideo = entityType === 'video_intro'
    const validType = isVideo ? file.type.startsWith('video/') : file.type.startsWith('image/')
    const maximumSize = isVideo ? 500 * 1024 * 1024 : 10 * 1024 * 1024
    if (!validType || file.size > maximumSize) {
      toast.error(isVideo
        ? 'Choose an MP4, MOV, or WebM video no larger than 500MB.'
        : 'Choose a JPG, PNG, or WebP image no larger than 10MB.')
      return
    }
    setUploadingMedia(entityType)
    setUploadProgress(0)
    setSaveStatus('idle')
    try {
      const apiUrl = getApiUrl()
      if (!initialData?.id) throw new Error('Save your centre details before uploading media')
      const metadata = {
        file_name: file.name,
        content_type: file.type,
        file_size_bytes: file.size,
        entity_type: entityType,
        context_id: initialData.id,
      }
      const presignResponse = await fetch(`${apiUrl}/storage/presign/public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(metadata),
      })
      const presignBody = await presignResponse.json()
      if (!presignResponse.ok) throw new Error(presignBody.error || 'Could not prepare upload')

      await uploadFileWithProgress(presignBody.data.presigned_url, file, setUploadProgress)

      const confirmResponse = await fetch(`${apiUrl}/storage/public/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...metadata, file_key: presignBody.data.file_key }),
      })
      const confirmBody = await confirmResponse.json()
      if (!confirmResponse.ok) throw new Error(confirmBody.error || 'Could not save uploaded image')
      setMediaUrls((current) => ({ ...current, [entityType]: withCacheVersion(confirmBody.public_url) }))
      setSaveStatus('success')
      toast.success(isVideo ? 'Introduction video uploaded' : `${entityType === 'logo' ? 'Logo' : 'Banner'} uploaded`)
    } catch (error) {
      toast.error('Could not upload media', { description: error instanceof Error ? error.message : 'Please try again.' })
    } finally {
      setUploadingMedia(null)
      setUploadProgress(null)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value, type } = e.target
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked
      setFormData(prev => ({ ...prev, [id]: checked }))
    } else {
      setFormData(prev => ({ ...prev, [id]: value }))
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      toast.error('Enter your centre name')
      return
    }
    if (!isFirstSetup && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(formData.slug)) {
      toast.error('Check your portal URL', { description: 'Use lowercase letters, numbers, and single hyphens only.' })
      return
    }
    setIsSaving(true)
    setSaveStatus('idle')

    try {
      const changedProfileFields = Object.fromEntries(
        (Object.keys(formData) as Array<keyof typeof formData>)
          .filter((key) => formData[key] !== savedFormData[key])
          .map((key) => [key, formData[key]])
      )
      const refreshSetupSession = async () => {
        const { data: refreshed, error: refreshError } = await createClient().auth.refreshSession()
        if (refreshError || !refreshed.session?.user.app_metadata?.school_id) {
          throw new Error('Your centre exists, but the dashboard session could not be refreshed. Please sign out and sign in again.')
        }
      }

      const res = await fetch(`${getApiUrl()}${isFirstSetup ? '/schools' : '/schools/me'}`, {
        method: isFirstSetup ? 'POST' : 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(isFirstSetup ? { name: formData.name.trim() } : changedProfileFields)
      })

      const responseBody = await res.json().catch(() => null)
      if (!res.ok) {
        if (isFirstSetup && responseBody?.code === 'SCHOOL_ALREADY_CONFIGURED') {
          await refreshSetupSession()
          window.location.assign('/dashboard')
          return
        }
        throw new Error(responseBody?.error || 'Failed to save configuration')
      }

      setSaveStatus('success')
      if (isFirstSetup) {
        await refreshSetupSession()
        toast.success('Your centre is ready')
        // Dashboard layouts persist across soft navigation. A full navigation
        // rebuilds the shell with setupRequired=false from the refreshed JWT.
        window.location.assign('/dashboard')
        return
      }
      const normalizedFormData = {
        ...formData,
        ...Object.fromEntries(
          (Object.keys(formData) as Array<keyof typeof formData>)
            .filter((key) => responseBody?.data?.[key] !== undefined)
            .map((key) => [key, responseBody.data[key] ?? ''])
        ),
      }
      setFormData(normalizedFormData)
      setSavedFormData(normalizedFormData)
      toast.success('Centre details saved')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch (err: any) {
      toast.error(isFirstSetup ? 'Could not create your centre' : 'Could not save centre details', {
        description: err.message,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDiscard = () => {
    if (!window.confirm('Discard your unsaved changes?')) return
    setFormData(savedFormData)
    setIsEditingSlug(false)
    setSaveStatus('idle')
  }

  const initials = formData.name ? formData.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'LM'
  const generatedSlug = slugifyCentreName(formData.name) || 'your-centre'
  const isDirty = JSON.stringify(formData) !== JSON.stringify(savedFormData)
  const brandingCount = [mediaUrls.logo, mediaUrls.banner, mediaUrls.video_intro].filter(Boolean).length
  const contactCount = [formData.contact_email, formData.contact_phone].filter(Boolean).length
  const socialCount = [formData.website_url, formData.twitter_url, formData.facebook_url, formData.instagram_url, formData.whatsapp_number].filter(Boolean).length

  if (isFirstSetup) {
    return (
      <div className="mx-auto w-full max-w-xl py-4 sm:py-10">
        <form onSubmit={handleSave} className="rounded-2xl border border-[#d8d2cd] bg-white p-5 shadow-[0_8px_32px_rgba(46,40,119,0.08)] sm:p-8">
          <div className="mb-7 flex h-11 w-11 items-center justify-center rounded-xl bg-[#f1efff] text-[#2e2877]">
            <span className="material-symbols-outlined">school</span>
          </div>
          <h1 className="text-2xl font-bold text-[#180d62] sm:text-3xl">Name your centre</h1>
          <p className="mt-2 text-sm leading-6 text-[#5f5964]">This is the name students will recognise. You can add your logo, contact details and other information later.</p>

          <label htmlFor="name" className="mt-7 block text-sm font-semibold text-[#1b1c1c]">Centre name</label>
          <input
            id="name"
            type="text"
            required
            autoFocus
            autoComplete="organization"
            value={formData.name}
            onChange={handleChange}
            className="mt-2 w-full rounded-lg border border-[#787582] bg-white px-4 py-3 text-base text-[#1b1c1c] outline-none transition focus:border-[#2e2877] focus:ring-2 focus:ring-[#ded8ff]"
            placeholder="e.g. Bright Future Tutorials"
          />

          <div className="mt-4 rounded-lg bg-[#f7f5f3] px-4 py-3">
            <p className="text-xs font-medium text-[#716c76]">Your student page</p>
            <p className="mt-1 break-all text-sm font-semibold text-[#2e2877]">{PUBLIC_APP_HOST}/{generatedSlug}</p>
            <p className="mt-1 text-xs leading-5 text-[#716c76]">We generate this automatically. You can customise it later.</p>
          </div>

          <button type="submit" disabled={isSaving || !formData.name.trim()} className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#994704] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#753400] disabled:cursor-not-allowed disabled:opacity-50">
            {isSaving && <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>}
            {isSaving ? 'Creating your centre…' : 'Continue to dashboard'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      {/* Page Header & Global Actions */}
      <div className="mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#180d62] sm:text-3xl">Centre profile</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#474551]">Manage what students see on your public centre page.</p>
        </div>
      </div>

      {/* Bento Grid Layout */}
      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">

        {/* Left Column (Span 8) */}
        <div className="col-span-12 xl:col-span-8 flex flex-col gap-6">

          {/* Basic Information Card */}
          <div className="bg-white border border-[#c8c5d2] rounded-lg p-6 md:p-8 shadow-[0px_4px_20px_rgba(61,61,61,0.04)]">
            <div className="border-b border-[#c8c5d2] pb-4 mb-6">
              <h3 className="text-xl font-semibold text-[#180d62] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#994704]">info</span>
                About Your Centre
              </h3>
              <p className="mt-1 text-sm text-[#474551]">The centre name and student page link are required. The introduction is optional.</p>
            </div>

            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Institution Name */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="name" className="font-semibold text-xs text-[#1b1c1c] uppercase tracking-wider">
                    Centre Name <span className="text-[#ba1a1a]">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-[#fbf9f8] border border-[#787582] rounded focus:border-2 focus:border-[#180d62] focus:ring-0 transition-all text-[#1b1c1c]"
                    placeholder="e.g. Bright Future Tutorials"
                  />
                </div>

                {/* Slug */}
                <div className="flex flex-col gap-2">
                  <span className="font-semibold text-xs text-[#1b1c1c] uppercase tracking-wider">Student page</span>
                  {!isEditingSlug ? (
                    <div className="rounded-lg border border-[#d8d2cd] bg-[#f7f5f3] px-3 py-3">
                      <p className="break-all text-sm font-semibold text-[#2e2877]">{PUBLIC_APP_HOST}/{formData.slug}</p>
                      <button type="button" onClick={() => setIsEditingSlug(true)} className="mt-2 text-xs font-semibold text-[#994704] hover:underline">Customise address</button>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-[#d8c7a8] bg-[#fff8eb] p-3">
                      <label htmlFor="slug" className="text-xs font-semibold text-[#5f430e]">Custom address</label>
                      <div className="mt-2 flex min-w-0 items-center">
                        <span className="max-w-[48%] truncate rounded-l border border-r-0 border-[#787582] bg-white px-3 py-3 text-sm text-[#474551]">{PUBLIC_APP_HOST}/</span>
                        <input id="slug" type="text" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={formData.slug} onChange={handleChange} className="min-w-0 flex-1 rounded-r border border-[#787582] bg-white px-3 py-3 text-sm text-[#1b1c1c] outline-none focus:border-[#180d62]" />
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[#5f430e]">Changing this address will break links you previously shared.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-2">
                <label htmlFor="description" className="font-semibold text-xs text-[#1b1c1c] uppercase tracking-wider">
                  Tell Students About Your Centre <span className="normal-case tracking-normal text-[#787582]">(optional)</span>
                </label>
                <textarea
                  id="description"
                  rows={4}
                  maxLength={500}
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-[#fbf9f8] border border-[#787582] rounded focus:border-2 focus:border-[#180d62] focus:ring-0 transition-all text-[#1b1c1c] resize-none"
                  placeholder="Tell students what you teach, the exams you prepare them for, and what makes your centre different."
                />
                <p className="text-[11px] text-[#787582] text-right mt-1">
                  {formData.description.length} / 500 characters
                </p>
              </div>
            </div>
          </div>

          {/* Media Assets Card */}
          <details className="group rounded-lg border border-[#c8c5d2] bg-white shadow-[0px_4px_20px_rgba(61,61,61,0.04)]">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-5 marker:content-none md:p-6">
              <span className="material-symbols-outlined text-[#994704]">perm_media</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-[#180d62]">Branding and welcome video</span>
                <span className="mt-0.5 block text-xs text-[#716c76]">{brandingCount ? `${brandingCount} of 3 added` : 'Optional'}</span>
              </span>
              <span className="material-symbols-outlined text-[#787582] transition group-open:rotate-180">expand_more</span>
            </summary>
            <div className="border-t border-[#e4e2e1] p-5 md:p-8">
              <div className="mb-6">
                <h3 className="sr-only">
                <span className="material-symbols-outlined text-[#994704]">perm_media</span>
                Photos and Welcome Video <span className="text-sm font-normal text-[#787582]">(optional)</span>
              </h3>
              <p className="mt-1 text-sm text-[#474551]">Add familiar visuals so students know they are enrolling with the right tutorial centre.</p>
              {!canUploadMedia && <p className="mt-2 text-xs font-medium text-[#994704]">Save your centre details first, then you can add photos and a welcome video.</p>}
              </div>

            <div className="flex flex-col gap-8">
              <div>
                <label className="font-semibold text-xs text-[#1b1c1c] uppercase tracking-wider mb-1 block">Centre Logo <span className="normal-case tracking-normal text-[#787582]">(optional)</span></label>
                <p className="mb-3 text-xs leading-5 text-[#787582]">Shown beside your centre name on the student enrolment page.</p>
                <label className={`relative flex min-h-36 w-full overflow-hidden rounded-lg border-2 border-dashed border-[#c8c5d2] bg-[#f5f3f2] p-5 transition-colors ${canUploadMedia ? 'cursor-pointer hover:border-[#2e2877]' : 'cursor-not-allowed opacity-60'}`}>
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={!canUploadMedia || uploadingMedia !== null} onChange={(event) => void uploadMedia('logo', event.target.files?.[0])} />
                  {mediaUrls.logo ? <img src={mediaUrls.logo} alt="Centre logo preview" className="absolute inset-0 h-full w-full object-contain p-4" /> : <div className="absolute inset-0 flex items-center justify-center bg-[#180d62] text-3xl font-bold text-white">{initials}</div>}
                  <div className="relative z-10 mt-auto w-full rounded-md bg-white/95 px-3 py-2 text-[#180d62] shadow-sm backdrop-blur">
                    {uploadingMedia === 'logo' ? <UploadStatus label="Uploading logo" progress={uploadProgress} /> : <p className="flex items-center justify-center gap-2 text-xs font-semibold"><span className="material-symbols-outlined text-base">upload</span>{mediaUrls.logo ? 'Replace logo' : 'Upload logo'} · JPG, PNG or WebP</p>}
                  </div>
                </label>
              </div>

              <div>
                <label className="font-semibold text-xs text-[#1b1c1c] uppercase tracking-wider mb-1 block">Cover Image <span className="normal-case tracking-normal text-[#787582]">(optional)</span></label>
                <p className="mb-3 text-xs leading-5 text-[#787582]">A wide image at the top of your student enrolment page. A classroom or teaching photo works well.</p>
                <label className={`relative flex min-h-40 w-full overflow-hidden rounded-lg border-2 border-dashed border-[#c8c5d2] bg-[#f5f3f2] p-5 transition-colors ${canUploadMedia ? 'cursor-pointer hover:border-[#2e2877]' : 'cursor-not-allowed opacity-60'}`}>
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={!canUploadMedia || uploadingMedia !== null} onChange={(event) => void uploadMedia('banner', event.target.files?.[0])} />
                  {mediaUrls.banner ? <img src={mediaUrls.banner} alt="Centre cover preview" className="absolute inset-0 h-full w-full object-cover" /> : (
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#180d62_1px,transparent_1px)] [background-size:16px_16px]"></div>
                  )}
                  <div className="relative z-10 mt-auto w-full rounded-md bg-white/95 px-3 py-2 text-[#180d62] shadow-sm backdrop-blur">
                    {uploadingMedia === 'banner' ? <UploadStatus label="Uploading cover" progress={uploadProgress} /> : <p className="flex items-center justify-center gap-2 text-xs font-semibold"><span className="material-symbols-outlined text-base">upload</span>{mediaUrls.banner ? 'Replace cover' : 'Upload cover'} · JPG, PNG or WebP</p>}
                  </div>
                </label>
              </div>

              <div>
                <label className="font-semibold text-xs text-[#1b1c1c] uppercase tracking-wider mb-1 block">Welcome Video <span className="normal-case tracking-normal text-[#787582]">(optional)</span></label>
                <p className="mb-3 text-xs leading-5 text-[#787582]">A short message introducing your centre, teaching approach, or exam-preparation programme.</p>
                {mediaUrls.video_intro && <video src={mediaUrls.video_intro} controls preload="metadata" className="mb-3 aspect-video w-full rounded-lg bg-black object-contain" aria-label="Welcome video preview" />}
                <label className={`flex min-h-12 w-full items-center justify-between gap-4 rounded border border-[#c8c5d2] bg-[#fbf9f8] px-4 py-3 transition-colors ${canUploadMedia ? 'hover:bg-[#f5f3f2] cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                  <input type="file" accept="video/mp4,video/quicktime,video/webm" className="sr-only" disabled={!canUploadMedia || uploadingMedia !== null} onChange={(event) => void uploadMedia('video_intro', event.target.files?.[0])} />
                  {uploadingMedia === 'video_intro' ? <UploadStatus label="Uploading welcome video" progress={uploadProgress} /> : <><span className="min-w-0 truncate text-sm text-[#474551]">{mediaUrls.video_intro ? 'Replace welcome video' : 'MP4, MOV or WebM · up to 500MB'}</span><span className="inline-flex shrink-0 items-center gap-2 rounded border border-[#2e2877] bg-white px-3 py-2 text-xs font-semibold text-[#2e2877]"><span className="material-symbols-outlined text-base">upload</span>Choose file</span></>}
                </label>
              </div>
            </div>
            </div>
          </details>

        </div>

        {/* Right Column (Span 4) */}
        <div className="col-span-12 xl:col-span-4 flex flex-col gap-6">

          {/* Visibility Status Card */}
          <div className="bg-white border border-[#c8c5d2] rounded-lg p-6 shadow-[0px_4px_20px_rgba(61,61,61,0.04)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-[#180d62]">Student Page</h3>
              {/* Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="is_active"
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={handleChange}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#e4e2e1] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#c8c5d2] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#994704]"></div>
              </label>
            </div>
            <p className="text-sm text-[#474551] bg-[#f5f3f2] p-3 rounded border border-[#c8c5d2]">
              {formData.is_active ? 'Your student enrolment page is available to anyone with the link.' : 'Your student enrolment page is hidden. Students cannot browse or enrol until you turn it back on.'} Your dashboard and staff access are not affected.
            </p>
          </div>

          {/* Contact Information Card */}
          <details className="group rounded-lg border border-[#c8c5d2] bg-white shadow-[0px_4px_20px_rgba(61,61,61,0.04)]">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-5 marker:content-none">
              <span className="material-symbols-outlined text-[#994704]">contact_support</span>
              <span className="min-w-0 flex-1"><span className="block font-semibold text-[#180d62]">Contact information</span><span className="mt-0.5 block text-xs text-[#716c76]">{contactCount ? `${contactCount} added` : 'Optional'}</span></span>
              <span className="material-symbols-outlined text-[#787582] transition group-open:rotate-180">expand_more</span>
            </summary>
            <div className="border-t border-[#e4e2e1] p-5">
              <div className="mb-5">
              <p className="mt-1 text-sm text-[#474551]">Where students and parents can ask questions before enrolling.</p>
              </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="contact_email" className="font-semibold text-xs text-[#1b1c1c] uppercase tracking-wider">Support Email <span className="normal-case tracking-normal text-[#787582]">(optional)</span></label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#787582] text-sm">mail</span>
                  <input
                    id="contact_email"
                    type="email"
                    value={formData.contact_email}
                    onChange={handleChange}
                    className="w-full pl-9 pr-3 py-2 bg-[#fbf9f8] border border-[#787582] rounded focus:border-2 focus:border-[#180d62] focus:ring-0 transition-all text-[#1b1c1c]"
                    placeholder="school@domain.com"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="contact_phone" className="font-semibold text-xs text-[#1b1c1c] uppercase tracking-wider">Main Phone <span className="normal-case tracking-normal text-[#787582]">(optional)</span></label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#787582] text-sm">call</span>
                  <input
                    id="contact_phone"
                    type="tel"
                    value={formData.contact_phone}
                    onChange={handleChange}
                    className="w-full pl-9 pr-3 py-2 bg-[#fbf9f8] border border-[#787582] rounded focus:border-2 focus:border-[#180d62] focus:ring-0 transition-all text-[#1b1c1c]"
                    placeholder="+234 ..."
                  />
                </div>
              </div>
            </div>
            </div>
          </details>

          {/* Social Links Card */}
          <details className="group rounded-lg border border-[#c8c5d2] bg-white shadow-[0px_4px_20px_rgba(61,61,61,0.04)]">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-5 marker:content-none">
              <span className="material-symbols-outlined text-[#994704]">language</span>
              <span className="min-w-0 flex-1"><span className="block font-semibold text-[#180d62]">Website and social links</span><span className="mt-0.5 block text-xs text-[#716c76]">{socialCount ? `${socialCount} added` : 'Optional'}</span></span>
              <span className="material-symbols-outlined text-[#787582] transition group-open:rotate-180">expand_more</span>
            </summary>
            <div className="border-t border-[#e4e2e1] p-5">
              <div className="mb-5">
              <p className="mt-1 text-sm text-[#474551]">Optional links that help students learn more about your centre.</p>
              </div>
            <div className="flex flex-col gap-4">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#787582] text-sm">public</span>
                  <input
                    id="website_url"
                    aria-label="Website"
                  type="text"
                  inputMode="url"
                  value={formData.website_url}
                  onChange={handleChange}
                  className="w-full pl-9 pr-3 py-2 bg-[#fbf9f8] border border-[#787582] rounded focus:border-2 focus:border-[#180d62] focus:ring-0 transition-all text-sm text-[#1b1c1c]"
                  placeholder="kanvise.com"
                />
              </div>

              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#787582] text-sm">flutter_dash</span>
                  <input
                    id="twitter_url"
                    aria-label="X or Twitter"
                  type="text"
                  inputMode="url"
                  value={formData.twitter_url}
                  onChange={handleChange}
                  className="w-full pl-9 pr-3 py-2 bg-[#fbf9f8] border border-[#787582] rounded focus:border-2 focus:border-[#180d62] focus:ring-0 transition-all text-sm text-[#1b1c1c]"
                  placeholder="@username or x.com/username"
                />
              </div>

              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#787582] text-sm">face_nod</span>
                  <input
                    id="facebook_url"
                    aria-label="Facebook"
                  type="text"
                  inputMode="url"
                  value={formData.facebook_url}
                  onChange={handleChange}
                  className="w-full pl-9 pr-3 py-2 bg-[#fbf9f8] border border-[#787582] rounded focus:border-2 focus:border-[#180d62] focus:ring-0 transition-all text-sm text-[#1b1c1c]"
                  placeholder="Username or Facebook link"
                />
              </div>

              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#787582] text-sm">photo_camera</span>
                  <input
                    id="instagram_url"
                    aria-label="Instagram"
                  type="text"
                  inputMode="url"
                  value={formData.instagram_url}
                  onChange={handleChange}
                  className="w-full pl-9 pr-3 py-2 bg-[#fbf9f8] border border-[#787582] rounded focus:border-2 focus:border-[#180d62] focus:ring-0 transition-all text-sm text-[#1b1c1c]"
                  placeholder="@username or Instagram link"
                />
              </div>

              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#787582] text-sm">chat</span>
                  <input
                    id="whatsapp_number"
                    aria-label="WhatsApp number"
                  type="tel"
                  value={formData.whatsapp_number}
                  onChange={handleChange}
                  className="w-full pl-9 pr-3 py-2 bg-[#fbf9f8] border border-[#787582] rounded focus:border-2 focus:border-[#180d62] focus:ring-0 transition-all text-sm text-[#1b1c1c]"
                  placeholder="+234 801 234 5678"
                />
              </div>
            </div>
            </div>
          </details>

        </div>

        <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-20 col-span-12 flex items-center gap-3 rounded-xl border border-[#d8d2cd] bg-white/95 p-3 shadow-[0_8px_30px_rgba(24,13,98,0.16)] backdrop-blur sm:static sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
          {saveStatus === 'success' && <span className="mr-auto inline-flex items-center gap-1 text-sm font-semibold text-green-700"><span className="material-symbols-outlined text-lg">check_circle</span>Saved</span>}
          {isDirty && <button type="button" onClick={handleDiscard} disabled={isSaving} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-[#5f5964] hover:bg-[#f5f3f2] disabled:opacity-50">Discard</button>}
          <button type="submit" disabled={isSaving || !isDirty} className="ml-auto flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#994704] px-5 text-sm font-semibold text-white transition hover:bg-[#753400] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none">
            {isSaving && <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>}
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
