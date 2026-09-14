"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { titleFromFileName, uploadFileWithProgress } from "@/lib/upload-with-progress"
import { Session } from "@supabase/supabase-js"
import { toast } from "sonner"
import { DashboardPageHeader } from "@/components/dashboard/page-header"

interface NotesClientProps {
  session: Session
}

interface Course {
  id: string
  name: string
  programme?: { name: string }
}

function normalizeCourses(rows: Array<{ id: string; name: string; programme: { name: string }[] | { name: string } | null }>): Course[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    programme: Array.isArray(row.programme) ? row.programme[0] : row.programme || undefined,
  }))
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null) {
    const err = error as any;
    if (err.message) return String(err.message);
    if (err.details) return String(err.details);
    if (err.error) return String(err.error);
    return JSON.stringify(err);
  }
  return fallback
}

interface Note {
  id: string
  title: string
  description: string | null
  file_name: string
  file_type: string
  file_size_bytes: number
  created_at: string
  course_id: string
  download_url: string
  tutor_id: string
  tutor?: { first_name: string; last_name: string }
}

const MAX_FILE_SIZE = 50 * 1024 * 1024
const ACCEPTED_FILE_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
])

export function NotesClient({ session }: NotesClientProps) {
  const supabase = createClient()
  const [courses, setCourses] = useState<Course[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedCourse, setSelectedCourse] = useState("")
  const [filterCourse, setFilterCourse] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [titleEdited, setTitleEdited] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadStage, setUploadStage] = useState<"uploading" | "saving" | null>(null)
  const [isLoadingNotes, setIsLoadingNotes] = useState(true)
  const [isDragActive, setIsDragActive] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const role = session.user.app_metadata?.kanvise_role || session.user.app_metadata?.role
  // Content rows use user_profiles.id. Auth IDs and human-readable Kanvise
  // IDs are deliberately not interchangeable with that UUID.
  const currentProfileId = typeof session.user.app_metadata?.profile_id === 'string'
    ? session.user.app_metadata.profile_id
    : null

  // Server-rendered session props are a snapshot. Fetch the browser session at
  // request time so a long-open dashboard never sends an expired JWT to the API.
  const getAccessToken = async () => {
    const { data: { session: currentSession }, error } = await supabase.auth.getSession()

    if (error || !currentSession) {
      throw new Error("Your session has expired. Please sign in again.")
    }

    return currentSession.access_token
  }

  useEffect(() => {
    fetchCourses()
  }, [])

  useEffect(() => {
    if (courses.length > 0) {
      fetchAllNotes()
    } else {
      setIsLoadingNotes(false)
    }
  }, [courses])

  const fetchCourses = async () => {
    try {
      const accessToken = await getAccessToken()
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
      
      if (!res.ok) throw new Error("We could not load your subjects. Please try again.")
      const json = await res.json()
      setCourses(normalizeCourses(json.data || []))
    } catch (error: any) {
      console.error("Failed to fetch courses:", error?.message || error)
      const message = errorMessage(error, "We could not load your subjects. Please try again.")
      setLoadError(message)
      toast.error(message)
    }
  }

  const fetchAllNotes = async () => {
    setIsLoadingNotes(true)
    setLoadError("")
    try {
      const accessToken = await getAccessToken()
      let allNotes: Note[] = []
      
      // For simplicity in UI, we'll fetch notes for all available courses sequentially or in parallel
      const fetchPromises = courses.map(async (course) => {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notes/${course.id}`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        })
        if (!res.ok) throw new Error(`Could not load materials for ${course.name}`)
        const { data } = await res.json()
        return data
      })

      const results = await Promise.all(fetchPromises)
      allNotes = results.flat()
      
      // Sort by latest
      allNotes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      
      setNotes(allNotes)
    } catch (error) {
      console.error("Failed to fetch notes:", error)
      const message = errorMessage(error, "We could not load your materials. Please try again.")
      setLoadError(message)
      toast.error(message)
    } finally {
      setIsLoadingNotes(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(true)
  }

  const handleDragLeave = () => {
    setIsDragActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      chooseFile(e.dataTransfer.files[0])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      chooseFile(e.target.files[0])
    }
  }

  const chooseFile = (nextFile: File) => {
    if (!ACCEPTED_FILE_TYPES.has(nextFile.type)) {
      toast.error("Choose a PDF, DOCX, PPTX, JPG, or PNG file.")
      return
    }
    if (nextFile.size > MAX_FILE_SIZE) {
      toast.error("Choose a file smaller than 50 MB.")
      return
    }
    setFile(nextFile)
    if (!titleEdited) setTitle(titleFromFileName(nextFile.name))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.includes("pdf")) return { icon: "picture_as_pdf", color: "text-error", bg: "bg-error/10" }
    if (fileType.includes("wordprocessing") || fileType.includes("msword")) return { icon: "description", color: "text-dashboard-primary", bg: "bg-dashboard-primary/10" }
    if (fileType.includes("presentation")) return { icon: "slideshow", color: "text-dashboard-primary", bg: "bg-dashboard-primary/10" }
    if (fileType.includes("image")) return { icon: "image", color: "text-green-600", bg: "bg-green-600/10" }
    return { icon: "draft", color: "text-dashboard-muted", bg: "bg-dashboard-surface-subtle" }
  }

  const handleUpload = async () => {
    if (!selectedCourse) return toast.error("Choose the subject that should receive this material.")
    if (!file) return toast.error("Choose a file to upload.")
    if (!title.trim()) return toast.error("Enter a title students will recognise.")

    setIsUploading(true)
    setUploadProgress(0)
    setUploadStage("uploading")

    try {
      // 1. Get presigned URL
      const presignToken = await getAccessToken()
      const presignRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/storage/presign/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${presignToken}`
        },
        body: JSON.stringify({
          file_name: file.name,
          content_type: file.type,
          file_size_bytes: file.size,
          entity_type: "note",
          course_id: selectedCourse
        })
      })

      if (!presignRes.ok) {
        const error = await presignRes.json()
        throw new Error(error.error || "Failed to get upload URL")
      }

      const { data: { presigned_url, file_key } } = await presignRes.json()

      // 2. Upload file to R2 directly
      await uploadFileWithProgress(presigned_url, file, setUploadProgress)

      // 3. Record note in database
      setUploadStage("saving")
      const recordToken = await getAccessToken()
      const recordRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notes/${selectedCourse}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${recordToken}`
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          file_key,
          file_name: file.name,
          file_type: file.type,
          file_size_bytes: file.size
        })
      })

      if (!recordRes.ok) {
        const error = await recordRes.json()
        throw new Error(error.error || "Failed to record note")
      }

      toast.success("Material shared with students.")
      
      // Reset form
      setTitle("")
      setTitleEdited(false)
      setDescription("")
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
      
      // Refresh list
      fetchAllNotes()

    } catch (error: unknown) {
      console.error(error)
      toast.error(errorMessage(error, "An error occurred during upload"))
    } finally {
      setIsUploading(false)
      setUploadProgress(null)
      setUploadStage(null)
    }
  }

  const handleDelete = async (noteId: string) => {
    try {
      const accessToken = await getAccessToken()
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notes/${noteId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` }
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to delete note")
      }

      toast.success("Resource deleted")
      setNotes(notes.filter(n => n.id !== noteId))
      setNoteToDelete(null)
    } catch (error: unknown) {
      console.error(error)
      toast.error(errorMessage(error, "An error occurred"))
    }
  }

  const handleDownload = (downloadUrl: string, fileName: string) => {
    if (!downloadUrl) {
      toast.error("Download link is missing or expired. Please refresh the page.");
      return;
    }
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const filteredNotes = filterCourse ? notes.filter(n => n.course_id === filterCourse) : notes

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-[1440px]">
        <DashboardPageHeader
          className="mb-8"
          title="Learning materials"
          description="Share notes, slides, and helpful documents with students in a subject."
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          
          {/* Upload Panel */}
          <div className="lg:col-span-4 space-y-6">
            <div className="rounded-dashboard-panel border border-dashboard-outline bg-dashboard-surface p-5 shadow-dashboard-card sm:p-6">
              <h3 className="mb-6 border-b border-dashboard-outline pb-4 text-lg font-semibold text-dashboard-foreground">Share a material</h3>
              
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-dashboard-foreground">Subject *</label>
                  <select 
                    value={selectedCourse}
                    onChange={(e) => setSelectedCourse(e.target.value)}
                    className="w-full rounded-dashboard-control border border-dashboard-outline bg-dashboard-surface px-3 py-2.5 text-sm text-dashboard-foreground outline-none focus:border-dashboard-primary focus:ring-1 focus:ring-dashboard-primary"
                  >
                    <option disabled value="">Choose a subject</option>
                    {courses.map(course => (
                      <option key={course.id} value={course.id}>
                        {course.name} {course.programme?.name ? `(${course.programme.name})` : ''}
                      </option>
                    ))}
                  </select>
                  {courses.length === 0 && !loadError && (
                    <p className="mt-2 text-sm text-dashboard-muted">Create a subject or ask your centre admin to assign you to one first.</p>
                  )}
                </div>
                
                {/* Drag & Drop Zone */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-dashboard-foreground">Upload file *</label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-dashboard-panel border-2 border-dashed border-dashboard-outline p-8 text-center transition-colors
                      ${isDragActive ? 'border-dashboard-primary bg-dashboard-primary/5' : 'hover:border-dashboard-primary hover:bg-dashboard-surface-subtle'}
                      ${file ? 'border-dashboard-primary bg-dashboard-surface-subtle' : ''}
                    `}
                  >
                    <span className="material-symbols-outlined mb-3 text-4xl text-dashboard-muted">
                      {file ? 'task' : 'cloud_upload'}
                    </span>
                    <p className="mb-1 text-sm font-medium text-dashboard-foreground">
                      {file ? file.name : 'Drag and drop file here'}
                    </p>
                    <p className="mb-4 text-sm text-dashboard-muted">
                      {file ? formatFileSize(file.size) : <>or <span className="text-dashboard-primary underline">browse files</span></>}
                    </p>
                    {!file && <p className="text-xs text-dashboard-muted">Supported: PDF, DOCX, PPTX, JPG, PNG (Max 50MB)</p>}
                    <input 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden" 
                      type="file" 
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png"
                    />
                  </div>
                </div>

                <details className="rounded-dashboard-control border border-dashboard-outline bg-dashboard-surface">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-dashboard-foreground">
                    Edit title or add a note <span className="font-normal text-dashboard-muted">(optional)</span>
                  </summary>
                  <div className="space-y-4 border-t border-dashboard-outline px-4 py-4">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-dashboard-foreground">Title</label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => {
                          setTitle(e.target.value)
                          setTitleEdited(true)
                        }}
                        className="w-full rounded-dashboard-control border border-dashboard-outline bg-dashboard-surface px-3 py-2.5 text-sm text-dashboard-foreground outline-none focus:border-dashboard-primary focus:ring-1 focus:ring-dashboard-primary"
                        placeholder="Filled from the filename"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-dashboard-foreground">Note for students</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full resize-none rounded-dashboard-control border border-dashboard-outline bg-dashboard-surface px-3 py-2.5 text-sm text-dashboard-foreground outline-none focus:border-dashboard-primary focus:ring-1 focus:ring-dashboard-primary"
                        placeholder="What does this cover?"
                        rows={3}
                      />
                    </div>
                  </div>
                </details>

                {isUploading && (
                  <div className="rounded-dashboard-control bg-dashboard-surface-subtle px-4 py-3" aria-live="polite">
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-dashboard-foreground">
                        {uploadStage === "saving" ? "Saving material…" : "Uploading material…"}
                      </span>
                      {uploadStage === "uploading" && uploadProgress !== null && (
                        <span className="tabular-nums text-dashboard-muted">{uploadProgress}%</span>
                      )}
                    </div>
                    {uploadStage === "uploading" && uploadProgress !== null && (
                      <div
                        role="progressbar"
                        aria-label="Material upload progress"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={uploadProgress}
                        className="h-2 overflow-hidden rounded-full bg-dashboard-outline"
                      >
                        <div className="h-full rounded-full bg-dashboard-primary transition-[width]" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    )}
                  </div>
                )}

                <div className="border-t border-dashboard-outline pt-4">
                  <button 
                    onClick={handleUpload}
                    disabled={isUploading || courses.length === 0}
                    className="w-full rounded-dashboard-control bg-dashboard-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-dashboard-primary/90 disabled:opacity-50"
                  >
                    {uploadStage === "saving"
                      ? "Saving material…"
                      : uploadStage === "uploading" && uploadProgress !== null
                        ? `Uploading ${uploadProgress}%`
                        : isUploading
                          ? "Uploading…"
                          : "Share material"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Manage Uploads Panel */}
          <div className="lg:col-span-8">
            <div className="flex min-h-[600px] h-full flex-col overflow-hidden rounded-dashboard-panel border border-dashboard-outline bg-dashboard-surface shadow-dashboard-card">
              
              <div className="flex items-center justify-between border-b border-dashboard-outline bg-dashboard-surface-subtle p-5 sm:p-6">
                <div>
                  <h3 className="text-lg font-semibold text-dashboard-foreground">Shared materials</h3>
                  <p className="mt-1 text-sm text-dashboard-muted">Open, download, or remove materials already shared with students.</p>
                </div>
                <div className="flex gap-2">
                  <select 
                    value={filterCourse}
                    onChange={(e) => setFilterCourse(e.target.value)}
                    className="rounded-dashboard-control border border-dashboard-outline bg-dashboard-surface px-3 py-1.5 text-sm text-dashboard-foreground outline-none focus:border-dashboard-primary"
                  >
                    <option value="">All Subjects</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                <div className="divide-y divide-dashboard-outline sm:hidden">
                  {isLoadingNotes ? <p className="p-6 text-center text-sm text-dashboard-muted">Loading materials…</p>
                    : loadError ? <div className="p-6 text-center text-sm text-dashboard-muted"><p>{loadError}</p><button type="button" onClick={() => void fetchAllNotes()} className="mt-3 rounded-dashboard-control bg-dashboard-primary px-3 py-2 font-semibold text-white">Try again</button></div>
                    : filteredNotes.length === 0 ? <p className="p-6 text-center text-sm text-dashboard-muted">{filterCourse ? 'No materials in this subject yet.' : 'Share your first learning material.'}</p>
                    : filteredNotes.map(note => { const style = getFileIcon(note.file_type); const course = courses.find(c => c.id === note.course_id); return <article key={note.id} className="p-4"><div className="flex items-start gap-3"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded ${style.bg} ${style.color}`}><span className="material-symbols-outlined">{style.icon}</span></div><div className="min-w-0 flex-1"><h2 className="truncate font-semibold text-dashboard-foreground">{note.title}</h2><p className="mt-1 truncate text-xs text-dashboard-muted">{course?.name || 'Unknown subject'} · {formatFileSize(note.file_size_bytes)} · {new Date(note.created_at).toLocaleDateString()}</p></div><button onClick={() => handleDownload(note.download_url, note.file_name)} className="shrink-0 rounded border border-dashboard-outline px-3 py-1.5 text-xs font-semibold text-dashboard-primary">Open</button></div>{(role === 'admin' || currentProfileId === note.tutor_id) && <button onClick={() => setNoteToDelete(note)} className="mt-3 text-xs font-semibold text-dashboard-danger">Remove material</button>}</article> })}
                </div>
                <table className="hidden w-full text-left border-collapse sm:table">
                  <thead className="sticky top-0 z-10 border-b border-dashboard-outline bg-dashboard-surface-subtle">
                    <tr>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-dashboard-muted sm:px-6">Document</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-dashboard-muted sm:px-6">Subject</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-dashboard-muted sm:px-6">Date</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-dashboard-muted sm:px-6">Size</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-dashboard-muted sm:px-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dashboard-outline">
                    {isLoadingNotes ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-dashboard-muted">
                           <span className="material-symbols-outlined animate-spin mb-2">progress_activity</span>
                           <p>Loading notes...</p>
                        </td>
                      </tr>
                    ) : loadError ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-14 text-center">
                          <span className="material-symbols-outlined text-4xl text-error">cloud_off</span>
                          <p className="mt-3 font-semibold text-dashboard-foreground">Materials could not be loaded</p>
                          <p className="mt-1 text-sm text-dashboard-muted">{loadError}</p>
                          <button type="button" onClick={() => void fetchAllNotes()} className="mt-4 rounded-dashboard-control bg-dashboard-primary px-4 py-2 text-sm font-semibold text-white">Try again</button>
                        </td>
                      </tr>
                    ) : filteredNotes.length === 0 ? (
                       <tr>
                         <td colSpan={5} className="px-6 py-14 text-center text-dashboard-muted">
                            <span className="material-symbols-outlined mb-2 text-4xl text-dashboard-outline">menu_book</span>
                            <p className="font-semibold text-dashboard-foreground">{filterCourse ? "No materials in this subject yet" : "Share your first learning material"}</p>
                            <p className="mt-1 text-sm">{filterCourse ? "Choose another subject or use the form to add one." : "Choose a subject and upload notes, slides, or a document for your students."}</p>
                         </td>
                       </tr>
                    ) : (
                      filteredNotes.map(note => {
                        const style = getFileIcon(note.file_type);
                        const course = courses.find(c => c.id === note.course_id);
                        return (
                          <tr key={note.id} className="group transition-colors hover:bg-dashboard-primary/5">
                            <td className="px-4 py-4 sm:px-6">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded ${style.bg} flex items-center justify-center ${style.color}`}>
                                  <span className="material-symbols-outlined">{style.icon}</span>
                                </div>
                                <div>
                                  <p className="cursor-pointer text-sm font-semibold text-dashboard-foreground hover:text-dashboard-primary" onClick={() => handleDownload(note.download_url, note.file_name)}>{note.title}</p>
                                  <p className="text-xs text-dashboard-muted">{note.file_name.split('.').pop()?.toUpperCase()} Document</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-sm text-dashboard-foreground sm:px-6">{course ? course.name : "Unknown Subject"}</td>
                            <td className="px-4 py-4 text-sm text-dashboard-muted sm:px-6">{new Date(note.created_at).toLocaleDateString()}</td>
                            <td className="px-4 py-4 text-sm text-dashboard-muted sm:px-6">{formatFileSize(note.file_size_bytes)}</td>
                            <td className="px-4 py-4 text-right sm:px-6">
                              <div className="flex justify-end gap-2">
                                <button onClick={() => handleDownload(note.download_url, note.file_name)} className="p-1.5 text-dashboard-muted transition-colors hover:text-dashboard-primary" title="Download">
                                  <span className="material-symbols-outlined text-sm">download</span>
                                </button>
                                {(role === "admin" || currentProfileId === note.tutor_id) && (
                                <button onClick={() => setNoteToDelete(note)} className="p-1.5 text-dashboard-muted transition-colors hover:text-dashboard-danger" title="Delete">
                                    <span className="material-symbols-outlined text-sm">delete</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-dashboard-outline bg-dashboard-surface-subtle p-4">
                <span className="text-sm text-dashboard-muted">Showing {filteredNotes.length} resources</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {noteToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-material-title">
          <div className="w-full max-w-md rounded-dashboard-panel bg-dashboard-surface p-6 shadow-xl">
            <h3 id="delete-material-title" className="text-xl font-bold text-dashboard-foreground">Remove this material?</h3>
            <p className="mt-2 text-sm text-dashboard-muted">
              Students will no longer see “{noteToDelete.title}”. This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setNoteToDelete(null)} className="rounded-dashboard-control border border-dashboard-outline px-4 py-2 text-sm font-semibold text-dashboard-foreground">Keep material</button>
              <button type="button" onClick={() => void handleDelete(noteToDelete.id)} className="rounded-dashboard-control bg-dashboard-danger px-4 py-2 text-sm font-semibold text-white">Remove material</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
