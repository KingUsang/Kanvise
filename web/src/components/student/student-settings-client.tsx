'use client'

/* The photo URL is served directly from the configured public R2 domain. */
/* eslint-disable @next/next/no-img-element */

import { Camera, KeyRound, Loader2, Save, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { getApiUrl } from '@/config/api'
import type { StudentSettings } from '@/lib/student-settings'

export function StudentSettingsClient({ settings, token }: { settings: StudentSettings; token: string }) {
  const [profile, setProfile] = useState(settings.profile)
  const [firstName, setFirstName] = useState(profile.first_name)
  const [lastName, setLastName] = useState(profile.last_name)
  const [bio, setBio] = useState(profile.bio || '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  async function saveProfile() {
    if (!firstName.trim() || !lastName.trim()) return toast.error('Enter your first and last name.')
    setSaving(true)
    try {
      const response = await fetch(`${getApiUrl()}/students/me/settings`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, bio }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.details?.[0] || body.error || 'Could not save your profile')
      setProfile(body.data); setFirstName(body.data.first_name); setLastName(body.data.last_name); setBio(body.data.bio || '')
      toast.success('Profile updated.')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save your profile') }
    finally { setSaving(false) }
  }

  async function uploadPhoto(file: File | undefined) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return toast.error('Choose a JPG, PNG, or WebP image.')
    if (file.size > 10 * 1024 * 1024) return toast.error('Your photo must be 10MB or smaller.')
    setUploading(true)
    try {
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      const presign = await fetch(`${getApiUrl()}/storage/presign/public`, { method: 'POST', headers, body: JSON.stringify({ file_name: file.name, content_type: file.type, file_size_bytes: file.size, entity_type: 'profile_photo', context_id: profile.id }) })
      const presignBody = await presign.json()
      if (!presign.ok) throw new Error(presignBody.error || 'Could not prepare photo upload')
      const upload = await fetch(presignBody.data.presigned_url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
      if (!upload.ok) throw new Error('Photo upload failed')
      const confirm = await fetch(`${getApiUrl()}/storage/public/confirm`, { method: 'POST', headers, body: JSON.stringify({ file_key: presignBody.data.file_key, content_type: file.type, file_size_bytes: file.size, entity_type: 'profile_photo', context_id: profile.id }) })
      const confirmBody = await confirm.json()
      if (!confirm.ok) throw new Error(confirmBody.error || 'Could not save your photo')
      setProfile(current => ({ ...current, profile_photo_url: confirmBody.public_url }))
      toast.success('Profile photo updated.')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update your photo') }
    finally { setUploading(false); if (fileInput.current) fileInput.current.value = '' }
  }

  return <main className="mx-auto max-w-4xl px-4 py-7 pb-24 sm:px-6 lg:px-10 lg:py-10">
    <header><p className="text-sm font-medium text-[#994704]">Your account</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Settings</h1><p className="mt-2 text-sm leading-6 text-[#716c76]">Update how your name and photo appear inside {settings.school?.name || 'your school'}.</p></header>
    <section className="mt-6 rounded-2xl border border-[#e3ded9] bg-white p-5 sm:p-7"><div className="flex flex-col gap-5 border-b border-[#eeeae6] pb-6 sm:flex-row sm:items-center"><div className="relative"><div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[#eeeafe] text-3xl font-semibold text-[#2e2877]">{profile.profile_photo_url ? <img src={profile.profile_photo_url} alt="Your profile" className="h-full w-full object-cover" /> : firstName.charAt(0).toUpperCase()}</div><button disabled={uploading} onClick={() => fileInput.current?.click()} aria-label="Change profile photo" className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-[#2e2877] text-white disabled:opacity-50">{uploading ? <Loader2 className="animate-spin" size={17} /> : <Camera size={17} />}</button><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={event => void uploadPhoto(event.target.files?.[0])} /></div><div><h2 className="text-xl font-semibold">{firstName} {lastName}</h2><p className="mt-1 text-sm text-[#716c76]">{profile.email}</p><p className="mt-1 text-xs font-medium text-[#994704]">Student ID: {profile.kanvise_user_id}</p></div></div>
      <div className="mt-6 grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold">First name<input value={firstName} onChange={event => setFirstName(event.target.value)} maxLength={80} className="mt-2 min-h-11 w-full rounded-xl border border-[#d9d3cf] px-3 font-normal outline-none focus:border-[#2e2877]" /></label><label className="text-sm font-semibold">Last name<input value={lastName} onChange={event => setLastName(event.target.value)} maxLength={80} className="mt-2 min-h-11 w-full rounded-xl border border-[#d9d3cf] px-3 font-normal outline-none focus:border-[#2e2877]" /></label><label className="text-sm font-semibold sm:col-span-2">About me <span className="font-normal text-[#8b858f]">(optional)</span><textarea value={bio} onChange={event => setBio(event.target.value)} maxLength={500} className="mt-2 min-h-28 w-full rounded-xl border border-[#d9d3cf] p-3 font-normal outline-none focus:border-[#2e2877]" placeholder="A short introduction for your tutors…" /><span className="mt-1 block text-right text-xs font-normal text-[#8b858f]">{bio.length}/500</span></label></div><button disabled={saving} onClick={saveProfile} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#2e2877] px-5 text-sm font-semibold text-white disabled:opacity-50">{saving ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}Save profile</button></section>
    <section className="mt-6 rounded-2xl border border-[#e3ded9] bg-white p-5 sm:p-7"><div className="flex items-start gap-3"><span className="rounded-xl bg-[#f0edff] p-2.5 text-[#2e2877]"><ShieldCheck size={20} /></span><div><h2 className="font-semibold">Sign-in security</h2><p className="mt-1 text-sm leading-6 text-[#716c76]">Your password is managed securely through your email. We never show or store it on this page.</p></div></div><Link href="/auth/forgot-password" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#d9d3cf] px-4 text-sm font-semibold text-[#2e2877]"><KeyRound size={17} />Send a password reset code</Link></section>
  </main>
}
