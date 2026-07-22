'use client'

import React, { useState } from 'react'
import { toast } from 'sonner'
import { PUBLIC_APP_HOST } from '@/config/app'
import { getApiUrl } from '@/config/api'

export function SchoolSetupForm({ initialData, token }: { initialData: any, token: string }) {
  const [formData, setFormData] = useState({
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
  })

  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [mediaUrls, setMediaUrls] = useState({
    logo: initialData?.logo_url || '',
    banner: initialData?.banner_url || '',
    video_intro: initialData?.video_intro_url || '',
  })
  const [uploadingMedia, setUploadingMedia] = useState<'logo' | 'banner' | 'video_intro' | null>(null)

  const uploadMedia = async (entityType: 'logo' | 'banner' | 'video_intro', file?: File) => {
    if (!file) return
    const isVideo = entityType === 'video_intro'
    const validType = isVideo ? file.type.startsWith('video/') : file.type.startsWith('image/')
    const maximumSize = isVideo ? 500 * 1024 * 1024 : 10 * 1024 * 1024
    if (!validType || file.size > maximumSize) {
      setSaveStatus('error')
      setErrorMessage(isVideo ? 'Choose an MP4, MOV, or WebM video no larger than 500MB.' : 'Choose a JPG, PNG, or WebP image no larger than 10MB.')
      return
    }
    setUploadingMedia(entityType)
    setSaveStatus('idle')
    try {
      const apiUrl = getApiUrl()
      if (!initialData?.id) throw new Error('School media upload is not configured')
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

      const uploadResponse = await fetch(presignBody.data.presigned_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!uploadResponse.ok) throw new Error('Could not upload image to storage')

      const confirmResponse = await fetch(`${apiUrl}/storage/public/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...metadata, file_key: presignBody.data.file_key }),
      })
      const confirmBody = await confirmResponse.json()
      if (!confirmResponse.ok) throw new Error(confirmBody.error || 'Could not save uploaded image')
      setMediaUrls((current) => ({ ...current, [entityType]: confirmBody.public_url }))
      setSaveStatus('success')
      toast.success(isVideo ? 'Introduction video uploaded' : `${entityType === 'logo' ? 'Logo' : 'Banner'} uploaded`)
    } catch (error) {
      setSaveStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Media upload failed')
      toast.error('Could not upload media', { description: error instanceof Error ? error.message : 'Please try again.' })
    } finally {
      setUploadingMedia(null)
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
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(formData.slug)) {
      toast.error('Check your portal URL', { description: 'Use lowercase letters, numbers, and single hyphens only.' })
      return
    }
    setIsSaving(true)
    setSaveStatus('idle')
    setErrorMessage('')

    try {
      const res = await fetch(`${getApiUrl()}/schools/mine`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to save configuration')
      }

      setSaveStatus('success')
      toast.success('School configuration saved')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch (err: any) {
      setSaveStatus('error')
      setErrorMessage(err.message)
      toast.error('Could not save school configuration', { description: err.message })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDiscard = () => {
    // Reset form to initial state
    setFormData({
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
    })
    setSaveStatus('idle')
  }

  const initials = formData.name ? formData.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'LM'

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      {/* Page Header & Global Actions */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-[#180d62] mb-1">Set Up Your Centre</h2>
          <p className="max-w-2xl text-base text-[#474551]">Help students recognise your tutorial centre and know how to reach you. These details appear on the page students use to explore your programmes and enrol.</p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          {saveStatus === 'success' && (
            <span className="text-green-600 text-sm font-semibold flex items-center mr-2">
              <span className="material-symbols-outlined mr-1 text-[18px]">check_circle</span>
              Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-red-600 text-sm font-semibold flex items-center mr-2">
              <span className="material-symbols-outlined mr-1 text-[18px]">error</span>
              {errorMessage}
            </span>
          )}
          <button 
            type="button"
            onClick={handleDiscard}
            disabled={isSaving}
            className="px-4 py-2 border border-[#180d62] text-[#180d62] font-semibold text-xs rounded hover:bg-[#f5f3f2] transition-colors tracking-wide uppercase disabled:opacity-50"
          >
            Reset Changes
          </button>
          {/* TODO (Production): Add more robust error handling and validation (e.g. Zod schemas) */}
          <button 
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-[#994704] text-white font-semibold text-xs uppercase tracking-wide rounded hover:bg-[#753400] transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">{isSaving ? 'sync' : 'save'}</span>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
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
              <p className="mt-1 text-sm text-[#474551]">Start with the name and short introduction students will see on your enrolment page.</p>
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
                  <label htmlFor="slug" className="font-semibold text-xs text-[#1b1c1c] uppercase tracking-wider">
                    Student Page Link <span className="text-[#ba1a1a]">*</span>
                  </label>
                  <div className="flex items-center">
                    <span className="bg-[#f5f3f2] border border-r-0 border-[#787582] px-3 py-3 rounded-l text-[#474551] text-sm select-none">
                      {PUBLIC_APP_HOST}/
                    </span>
                    <input 
                      id="slug" 
                      type="text" 
                      required
                      pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                      value={formData.slug}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-[#fbf9f8] border border-[#787582] rounded-r focus:border-2 focus:border-[#180d62] focus:ring-0 transition-all text-[#1b1c1c]" 
                      placeholder="your-school" 
                    />
                  </div>
                  <p className="text-xs leading-5 text-[#787582]">Choose the short name students will type or receive when you share your centre link.</p>
                </div>
              </div>
              
              {/* Description */}
              <div className="flex flex-col gap-2">
                <label htmlFor="description" className="font-semibold text-xs text-[#1b1c1c] uppercase tracking-wider">
                  Tell Students About Your Centre
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
          <div className="bg-white border border-[#c8c5d2] rounded-lg p-6 md:p-8 shadow-[0px_4px_20px_rgba(61,61,61,0.04)]">
            <div className="border-b border-[#c8c5d2] pb-4 mb-6">
              <h3 className="text-xl font-semibold text-[#180d62] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#994704]">perm_media</span>
                Photos and Welcome Video
              </h3>
              <p className="mt-1 text-sm text-[#474551]">Add familiar visuals so students know they are enrolling with the right tutorial centre.</p>
            </div>
            
            <div className="flex flex-col gap-8">
              <div>
                <label className="font-semibold text-xs text-[#1b1c1c] uppercase tracking-wider mb-1 block">Centre Logo</label>
                <p className="mb-3 text-xs leading-5 text-[#787582]">Shown beside your centre name on the student enrolment page.</p>
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  <div className="w-24 h-24 rounded border border-[#787582] bg-[#f5f3f2] flex items-center justify-center shrink-0 overflow-hidden relative group">
                    {mediaUrls.logo ? <img src={mediaUrls.logo} alt="Institution logo" className="absolute inset-0 h-full w-full object-cover" /> : (
                      <div className="absolute inset-0 bg-[#180d62] flex items-center justify-center text-white text-3xl font-bold">{initials}</div>
                    )}
                  </div>
                  <label className="flex-1 w-full border-2 border-dashed border-[#c8c5d2] rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-[#f5f3f2] transition-colors cursor-pointer group">
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploadingMedia !== null} onChange={(event) => void uploadMedia('logo', event.target.files?.[0])} />
                    <span className="material-symbols-outlined text-[#787582] group-hover:text-[#180d62] mb-2 text-3xl transition-colors">cloud_upload</span>
                    <p className="font-semibold text-xs text-[#180d62] mb-1">{uploadingMedia === 'logo' ? 'Uploading logo…' : 'Click to upload a logo'}</p>
                    <p className="text-sm text-[#474551]">PNG, JPG or WebP (max. 10MB)</p>
                  </label>
                </div>
              </div>

              <div>
                <label className="font-semibold text-xs text-[#1b1c1c] uppercase tracking-wider mb-1 block">Cover Image</label>
                <p className="mb-3 text-xs leading-5 text-[#787582]">A wide image at the top of your student enrolment page. A classroom or teaching photo works well.</p>
                <label className="w-full h-32 border-2 border-dashed border-[#c8c5d2] rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-[#f5f3f2] transition-colors cursor-pointer group relative overflow-hidden">
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploadingMedia !== null} onChange={(event) => void uploadMedia('banner', event.target.files?.[0])} />
                  {mediaUrls.banner ? <img src={mediaUrls.banner} alt="Dashboard banner" className="absolute inset-0 h-full w-full object-cover opacity-30" /> : (
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#180d62_1px,transparent_1px)] [background-size:16px_16px]"></div>
                  )}
                  <span className="material-symbols-outlined text-[#787582] group-hover:text-[#180d62] mb-2 text-3xl transition-colors relative z-10">image</span>
                  <p className="font-semibold text-xs text-[#180d62] mb-1 relative z-10">{uploadingMedia === 'banner' ? 'Uploading cover image…' : 'Upload cover image'}</p>
                  <p className="text-sm text-[#474551] relative z-10">PNG, JPG or WebP (max. 10MB)</p>
                </label>
              </div>

              <div>
                <label className="font-semibold text-xs text-[#1b1c1c] uppercase tracking-wider mb-1 block">Welcome Video <span className="normal-case tracking-normal text-[#787582]">(optional)</span></label>
                <p className="mb-3 text-xs leading-5 text-[#787582]">A short message introducing your centre, teaching approach, or exam-preparation programme.</p>
                <label className="flex w-full cursor-pointer items-center justify-between gap-4 rounded border border-[#c8c5d2] bg-[#fbf9f8] px-4 py-3 transition-colors hover:bg-[#f5f3f2]">
                  <input type="file" accept="video/mp4,video/quicktime,video/webm" className="sr-only" disabled={uploadingMedia !== null} onChange={(event) => void uploadMedia('video_intro', event.target.files?.[0])} />
                  <span className="min-w-0 truncate text-sm text-[#474551]">{uploadingMedia === 'video_intro' ? 'Uploading introduction video…' : mediaUrls.video_intro ? 'Replace introduction video' : 'Upload an MP4, MOV, or WebM video'}</span>
                  <span className="inline-flex shrink-0 items-center gap-2 rounded border border-[#2e2877] bg-white px-3 py-2 text-xs font-semibold text-[#2e2877]"><span className="material-symbols-outlined text-base">upload</span>Upload File</span>
                </label>
                {mediaUrls.video_intro && <a href={mediaUrls.video_intro} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#994704] hover:underline"><span className="material-symbols-outlined text-base">play_circle</span>Preview current video</a>}
              </div>
            </div>
          </div>
          
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
          <div className="bg-white border border-[#c8c5d2] rounded-lg p-6 shadow-[0px_4px_20px_rgba(61,61,61,0.04)]">
            <div className="border-b border-[#c8c5d2] pb-3 mb-5">
              <h3 className="text-xl font-semibold text-[#180d62] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#994704]">contact_support</span>
                Contact Info
              </h3>
              <p className="mt-1 text-sm text-[#474551]">Where students and parents can ask questions before enrolling.</p>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="contact_email" className="font-semibold text-xs text-[#1b1c1c] uppercase tracking-wider">Support Email</label>
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
                <label htmlFor="contact_phone" className="font-semibold text-xs text-[#1b1c1c] uppercase tracking-wider">Main Phone</label>
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

          {/* Social Links Card */}
          <div className="bg-white border border-[#c8c5d2] rounded-lg p-6 shadow-[0px_4px_20px_rgba(61,61,61,0.04)]">
            <div className="border-b border-[#c8c5d2] pb-3 mb-5">
              <h3 className="text-xl font-semibold text-[#180d62] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#994704]">language</span>
                Social Links
              </h3>
              <p className="mt-1 text-sm text-[#474551]">Optional links that help students learn more about your centre.</p>
            </div>
            <div className="flex flex-col gap-4">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#787582] text-sm">public</span>
                <input 
                  id="website_url" 
                  type="url" 
                  value={formData.website_url}
                  onChange={handleChange}
                  className="w-full pl-9 pr-3 py-2 bg-[#fbf9f8] border border-[#787582] rounded focus:border-2 focus:border-[#180d62] focus:ring-0 transition-all text-sm text-[#1b1c1c]" 
                  placeholder="Website URL" 
                />
              </div>
              
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#787582] text-sm">flutter_dash</span>
                <input 
                  id="twitter_url" 
                  type="url" 
                  value={formData.twitter_url}
                  onChange={handleChange}
                  className="w-full pl-9 pr-3 py-2 bg-[#fbf9f8] border border-[#787582] rounded focus:border-2 focus:border-[#180d62] focus:ring-0 transition-all text-sm text-[#1b1c1c]" 
                  placeholder="Twitter / X URL" 
                />
              </div>
              
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#787582] text-sm">face_nod</span>
                <input 
                  id="facebook_url" 
                  type="url" 
                  value={formData.facebook_url}
                  onChange={handleChange}
                  className="w-full pl-9 pr-3 py-2 bg-[#fbf9f8] border border-[#787582] rounded focus:border-2 focus:border-[#180d62] focus:ring-0 transition-all text-sm text-[#1b1c1c]" 
                  placeholder="Facebook URL" 
                />
              </div>
              
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#787582] text-sm">photo_camera</span>
                <input 
                  id="instagram_url" 
                  type="url" 
                  value={formData.instagram_url}
                  onChange={handleChange}
                  className="w-full pl-9 pr-3 py-2 bg-[#fbf9f8] border border-[#787582] rounded focus:border-2 focus:border-[#180d62] focus:ring-0 transition-all text-sm text-[#1b1c1c]" 
                  placeholder="Instagram URL" 
                />
              </div>
              
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#787582] text-sm">chat</span>
                <input 
                  id="whatsapp_number" 
                  type="tel" 
                  value={formData.whatsapp_number}
                  onChange={handleChange}
                  className="w-full pl-9 pr-3 py-2 bg-[#fbf9f8] border border-[#787582] rounded focus:border-2 focus:border-[#180d62] focus:ring-0 transition-all text-sm text-[#1b1c1c]" 
                  placeholder="WhatsApp Number" 
                />
              </div>
            </div>
          </div>

        </div>
      </form>
    </div>
  )
}
