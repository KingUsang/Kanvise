'use client'

import React, { useState } from 'react'

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
    setIsSaving(true)
    setSaveStatus('idle')
    setErrorMessage('')

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/schools/mine`, {
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
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch (err: any) {
      setSaveStatus('error')
      setErrorMessage(err.message)
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
  }

  const initials = formData.name ? formData.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'LM'

  return (
    <div className="w-full">
      {/* Page Header & Global Actions */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-[#180d62] mb-1">School Setup</h2>
          <p className="text-base text-[#474551]">Configure your institution's core identity, media, and contact information.</p>
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
            Discard Changes
          </button>
          {/* TODO (Production): Add more robust error handling and validation (e.g. Zod schemas) */}
          <button 
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-[#994704] text-white font-semibold text-xs uppercase tracking-wide rounded hover:bg-[#753400] transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">{isSaving ? 'sync' : 'save'}</span>
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {/* Bento Grid Layout */}
      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        
        {/* Left Column (Span 8) */}
        <div className="col-span-12 xl:col-span-8 flex flex-col gap-6">
          
          {/* Basic Information Card */}
          <div className="bg-[#fbf9f8] border border-[#c8c5d2] rounded-lg p-8 shadow-[0px_4px_20px_rgba(61,61,61,0.04)]">
            <div className="border-b border-[#c8c5d2] pb-4 mb-6">
              <h3 className="text-xl font-semibold text-[#180d62] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#994704]">info</span>
                Core Identity
              </h3>
            </div>
            
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Institution Name */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="name" className="font-semibold text-xs text-[#1b1c1c] uppercase tracking-wider">
                    Institution Name <span className="text-[#ba1a1a]">*</span>
                  </label>
                  <input 
                    id="name" 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-[#fbf9f8] border border-[#787582] rounded focus:border-2 focus:border-[#180d62] focus:ring-0 transition-all text-[#1b1c1c]" 
                    placeholder="e.g. Acme Academy" 
                  />
                </div>
                
                {/* Slug */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="slug" className="font-semibold text-xs text-[#1b1c1c] uppercase tracking-wider">
                    Portal URL (Slug) <span className="text-[#ba1a1a]">*</span>
                  </label>
                  <div className="flex items-center">
                    <span className="bg-[#f5f3f2] border border-r-0 border-[#787582] px-3 py-3 rounded-l text-[#474551] text-sm select-none">
                      kanvise.ng/
                    </span>
                    <input 
                      id="slug" 
                      type="text" 
                      required
                      value={formData.slug}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-[#fbf9f8] border border-[#787582] rounded-r focus:border-2 focus:border-[#180d62] focus:ring-0 transition-all text-[#1b1c1c]" 
                      placeholder="your-school" 
                    />
                  </div>
                </div>
              </div>
              
              {/* Description */}
              <div className="flex flex-col gap-2">
                <label htmlFor="description" className="font-semibold text-xs text-[#1b1c1c] uppercase tracking-wider">
                  Institution Description
                </label>
                <textarea 
                  id="description" 
                  rows={4}
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-[#fbf9f8] border border-[#787582] rounded focus:border-2 focus:border-[#180d62] focus:ring-0 transition-all text-[#1b1c1c] resize-none" 
                  placeholder="Provide a brief overview of your institution..." 
                />
                <p className="text-[11px] text-[#787582] text-right mt-1">
                  {formData.description.length} / 500 characters
                </p>
              </div>
            </div>
          </div>

          {/* Media Assets Card */}
          <div className="bg-[#fbf9f8] border border-[#c8c5d2] rounded-lg p-8 shadow-[0px_4px_20px_rgba(61,61,61,0.04)]">
            <div className="border-b border-[#c8c5d2] pb-4 mb-6">
              <h3 className="text-xl font-semibold text-[#180d62] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#994704]">perm_media</span>
                Media Assets
              </h3>
            </div>
            
            <div className="flex flex-col gap-8">
              {/* Logo Upload Stub */}
              <div>
                <label className="font-semibold text-xs text-[#1b1c1c] uppercase tracking-wider mb-3 block">Institution Logo</label>
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  <div className="w-24 h-24 rounded border border-[#787582] bg-[#f5f3f2] flex items-center justify-center shrink-0 overflow-hidden relative group">
                    <div className="absolute inset-0 bg-[#180d62] flex items-center justify-center text-white text-3xl font-bold">
                      {initials}
                    </div>
                  </div>
                  <div className="flex-1 w-full border-2 border-dashed border-[#c8c5d2] rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-[#f5f3f2] transition-colors cursor-pointer group">
                    <span className="material-symbols-outlined text-[#787582] group-hover:text-[#180d62] mb-2 text-3xl transition-colors">cloud_upload</span>
                    <p className="font-semibold text-xs text-[#180d62] mb-1">Click to upload or drag and drop</p>
                    <p className="text-sm text-[#474551]">SVG, PNG, JPG or GIF (max. 2MB)</p>
                    {/* TODO (Production): Implement actual presigned URL generation and Cloudflare R2 upload here */}
                    <p className="text-sm text-[#474551] mt-1 italic opacity-75">Cloudflare R2 Integration Coming Soon</p>
                  </div>
                </div>
              </div>

              {/* Banner Upload Stub */}
              <div>
                <label className="font-semibold text-xs text-[#1b1c1c] uppercase tracking-wider mb-3 block">Dashboard Banner</label>
                <div className="w-full h-32 border-2 border-dashed border-[#c8c5d2] rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-[#f5f3f2] transition-colors cursor-pointer group relative overflow-hidden">
                  <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#180d62_1px,transparent_1px)] [background-size:16px_16px]"></div>
                  <span className="material-symbols-outlined text-[#787582] group-hover:text-[#180d62] mb-2 text-3xl transition-colors relative z-10">image</span>
                  <p className="font-semibold text-xs text-[#180d62] mb-1 relative z-10">Upload Banner Image</p>
                  {/* TODO (Production): Implement actual presigned URL generation and Cloudflare R2 upload here */}
                  <p className="text-sm text-[#474551] relative z-10 italic opacity-75">Cloudflare R2 Integration Coming Soon</p>
                </div>
              </div>
            </div>
          </div>
          
        </div>

        {/* Right Column (Span 4) */}
        <div className="col-span-12 xl:col-span-4 flex flex-col gap-6">
          
          {/* Visibility Status Card */}
          <div className="bg-[#fbf9f8] border border-[#c8c5d2] rounded-lg p-6 shadow-[0px_4px_20px_rgba(61,61,61,0.04)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-[#180d62]">Portal Status</h3>
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
              When active, students and tutors can log in and access learning materials. Set to inactive during major maintenance.
            </p>
          </div>

          {/* Contact Information Card */}
          <div className="bg-[#fbf9f8] border border-[#c8c5d2] rounded-lg p-6 shadow-[0px_4px_20px_rgba(61,61,61,0.04)]">
            <div className="border-b border-[#c8c5d2] pb-3 mb-5">
              <h3 className="text-xl font-semibold text-[#180d62] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#994704]">contact_support</span>
                Contact Info
              </h3>
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
          <div className="bg-[#fbf9f8] border border-[#c8c5d2] rounded-lg p-6 shadow-[0px_4px_20px_rgba(61,61,61,0.04)]">
            <div className="border-b border-[#c8c5d2] pb-3 mb-5">
              <h3 className="text-xl font-semibold text-[#180d62] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#994704]">language</span>
                Social Links
              </h3>
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
