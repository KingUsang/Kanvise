"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Session } from "@supabase/supabase-js"
import { toast } from "sonner"

interface NotesClientProps {
  schoolId: string
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

export function NotesClient({ schoolId, session }: NotesClientProps) {
  const supabase = createClient()
  const [courses, setCourses] = useState<Course[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedCourse, setSelectedCourse] = useState("")
  const [filterCourse, setFilterCourse] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isLoadingNotes, setIsLoadingNotes] = useState(true)
  const [isDragActive, setIsDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const token = session.access_token
  const role = session.user.app_metadata?.kanvise_role || session.user.app_metadata?.role

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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      
      if (!res.ok) throw new Error("Failed to load courses from API")
      const json = await res.json()
      setCourses(normalizeCourses(json.data || []))
    } catch (error: any) {
      console.error("Failed to fetch courses:", error?.message || error)
      toast.error(errorMessage(error, "Failed to load courses"))
    }
  }

  const fetchAllNotes = async () => {
    setIsLoadingNotes(true)
    try {
      let allNotes: Note[] = []
      
      // For simplicity in UI, we'll fetch notes for all available courses sequentially or in parallel
      const fetchPromises = courses.map(async (course) => {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notes/${course.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const { data } = await res.json()
          return data
        }
        return []
      })

      const results = await Promise.all(fetchPromises)
      allNotes = results.flat()
      
      // Sort by latest
      allNotes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      
      setNotes(allNotes)
    } catch (error) {
      console.error("Failed to fetch notes:", error)
      toast.error("Failed to load notes")
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
      setFile(e.dataTransfer.files[0])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0])
    }
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
    if (fileType.includes("wordprocessing") || fileType.includes("msword")) return { icon: "description", color: "text-secondary", bg: "bg-secondary-container/20" }
    if (fileType.includes("presentation")) return { icon: "slideshow", color: "text-primary-container", bg: "bg-primary-container/10" }
    if (fileType.includes("image")) return { icon: "image", color: "text-green-600", bg: "bg-green-600/10" }
    return { icon: "draft", color: "text-on-surface-variant", bg: "bg-surface-variant/20" }
  }

  const handleUpload = async () => {
    if (!selectedCourse) return toast.error("Please select a target course")
    if (!title) return toast.error("Please enter a document title")
    if (!file) return toast.error("Please select a file to upload")

    setIsUploading(true)

    try {
      // 1. Get presigned URL
      const presignRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/storage/presign/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
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
      const uploadRes = await fetch(presigned_url, {
        method: "PUT",
        headers: {
          "Content-Type": file.type
        },
        body: file
      })

      if (!uploadRes.ok) throw new Error("Failed to upload file to storage")

      // 3. Record note in database
      const recordRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notes/${selectedCourse}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          description,
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

      toast.success("Resource published successfully!")
      
      // Reset form
      setTitle("")
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
    }
  }

  const handleDelete = async (noteId: string) => {
    if (!confirm("Are you sure you want to delete this resource?")) return

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notes/${noteId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to delete note")
      }

      toast.success("Resource deleted")
      setNotes(notes.filter(n => n.id !== noteId))
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
    <div className="flex-1 p-6 md:p-margin-desktop overflow-y-auto">
      <div className="max-w-[1440px] mx-auto">
        <div className="mb-8">
          <h2 className="text-headline-lg font-headline-lg text-primary mb-2">Upload Notes</h2>
          <p className="text-body-md font-body-md text-on-surface-variant">Distribute course materials, syllabi, and reference documents to your active cohorts.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          
          {/* Upload Panel */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 shadow-[0_4px_20px_rgba(61,61,61,0.08)]">
              <h3 className="text-headline-sm font-headline-sm text-on-surface mb-6 border-b border-outline-variant pb-4">Resource Details</h3>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-label-md font-label-md text-on-surface mb-2">Target Course *</label>
                  <select 
                    value={selectedCourse}
                    onChange={(e) => setSelectedCourse(e.target.value)}
                    className="w-full border border-outline-variant rounded bg-surface py-2.5 px-3 text-body-md font-body-md focus:border-primary-container focus:ring-1 focus:ring-primary-container"
                  >
                    <option disabled value="">Select active course cohort...</option>
                    {courses.map(course => (
                      <option key={course.id} value={course.id}>
                        {course.name} {course.programme?.name ? `(${course.programme.name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-label-md font-label-md text-on-surface mb-2">Document Title *</label>
                  <input 
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full border border-outline-variant rounded bg-surface py-2.5 px-3 text-body-md font-body-md focus:border-primary-container focus:ring-1 focus:ring-primary-container" 
                    placeholder="e.g., Week 3: Data Structures Overview" 
                  />
                </div>
                
                <div>
                  <label className="block text-label-md font-label-md text-on-surface mb-2">Description / Instructions</label>
                  <textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full border border-outline-variant rounded bg-surface py-2.5 px-3 text-body-md font-body-md focus:border-primary-container focus:ring-1 focus:ring-primary-container resize-none" 
                    placeholder="Provide context or reading instructions for the students..." 
                    rows={3}
                  />
                </div>

                {/* Drag & Drop Zone */}
                <div>
                  <label className="block text-label-md font-label-md text-on-surface mb-2">Upload File *</label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed border-outline-variant rounded-lg p-8 text-center transition-colors cursor-pointer flex flex-col items-center justify-center
                      ${isDragActive ? 'border-primary-container bg-surface-container-low/50' : 'hover:border-primary-container hover:bg-surface-container-low'}
                      ${file ? 'border-secondary-container bg-surface-container-low' : ''}
                    `}
                  >
                    <span className="material-symbols-outlined text-4xl text-outline mb-3">
                      {file ? 'task' : 'cloud_upload'}
                    </span>
                    <p className="text-body-md font-body-md text-on-surface mb-1">
                      {file ? file.name : 'Drag and drop file here'}
                    </p>
                    <p className="text-label-md font-label-md text-on-surface-variant mb-4">
                      {file ? formatFileSize(file.size) : <>or <span className="text-primary-container underline">browse files</span></>}
                    </p>
                    {!file && <p className="text-label-md font-label-md text-outline">Supported: PDF, DOCX, PPTX, JPG, PNG (Max 50MB)</p>}
                    <input 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden" 
                      type="file" 
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-outline-variant">
                  <button 
                    onClick={handleUpload}
                    disabled={isUploading}
                    className="w-full bg-secondary text-on-secondary py-3 px-4 rounded text-body-md font-headline-md font-bold hover:bg-on-secondary-fixed-variant transition-colors shadow-sm disabled:opacity-50"
                  >
                    {isUploading ? "Publishing..." : "Publish Resource"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Manage Uploads Panel */}
          <div className="lg:col-span-8">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg shadow-[0_4px_20px_rgba(61,61,61,0.08)] flex flex-col h-full min-h-[600px]">
              
              <div className="p-6 border-b border-outline-variant flex justify-between items-center bg-[#fbf9f8]">
                <div>
                  <h3 className="text-headline-sm font-headline-sm text-on-surface">Recent Uploads</h3>
                  <p className="text-label-md font-label-md text-on-surface-variant mt-1">Manage distributed materials across all courses.</p>
                </div>
                <div className="flex gap-2">
                  <select 
                    value={filterCourse}
                    onChange={(e) => setFilterCourse(e.target.value)}
                    className="border border-outline-variant rounded bg-surface py-1.5 px-3 text-body-sm font-body-sm focus:border-primary-container"
                  >
                    <option value="">All Courses</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-tertiary-fixed-dim/20 border-b border-outline-variant sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-6 text-label-md font-label-md text-on-surface-variant font-bold uppercase tracking-wider">Document</th>
                      <th className="py-3 px-6 text-label-md font-label-md text-on-surface-variant font-bold uppercase tracking-wider">Course</th>
                      <th className="py-3 px-6 text-label-md font-label-md text-on-surface-variant font-bold uppercase tracking-wider">Date</th>
                      <th className="py-3 px-6 text-label-md font-label-md text-on-surface-variant font-bold uppercase tracking-wider">Size</th>
                      <th className="py-3 px-6 text-right text-label-md font-label-md text-on-surface-variant font-bold uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {isLoadingNotes ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-on-surface-variant">
                           <span className="material-symbols-outlined animate-spin mb-2">progress_activity</span>
                           <p>Loading notes...</p>
                        </td>
                      </tr>
                    ) : filteredNotes.length === 0 ? (
                       <tr>
                         <td colSpan={5} className="py-8 text-center text-on-surface-variant">
                            <span className="material-symbols-outlined text-4xl mb-2 text-outline-variant">inventory_2</span>
                            <p>No resources found.</p>
                         </td>
                       </tr>
                    ) : (
                      filteredNotes.map(note => {
                        const style = getFileIcon(note.file_type);
                        const course = courses.find(c => c.id === note.course_id);
                        return (
                          <tr key={note.id} className="hover:bg-primary-fixed/5 transition-colors group">
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded ${style.bg} flex items-center justify-center ${style.color}`}>
                                  <span className="material-symbols-outlined">{style.icon}</span>
                                </div>
                                <div>
                                  <p className="text-body-md font-body-md font-semibold text-on-surface cursor-pointer hover:text-primary-container" onClick={() => handleDownload(note.download_url, note.file_name)}>{note.title}</p>
                                  <p className="text-label-md font-label-md text-on-surface-variant">{note.file_name.split('.').pop()?.toUpperCase()} Document</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-6 text-body-sm font-body-sm text-on-surface">{course ? course.name : "Unknown Course"}</td>
                            <td className="py-4 px-6 text-body-sm font-body-sm text-on-surface-variant">{new Date(note.created_at).toLocaleDateString()}</td>
                            <td className="py-4 px-6 text-body-sm font-body-sm text-on-surface-variant">{formatFileSize(note.file_size_bytes)}</td>
                            <td className="py-4 px-6 text-right">
                              <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleDownload(note.download_url, note.file_name)} className="p-1.5 text-on-surface-variant hover:text-primary transition-colors" title="Download">
                                  <span className="material-symbols-outlined text-sm">download</span>
                                </button>
                                {(role === "admin" || (session.user.user_metadata?.kanvise_user_id || session.user.id) === note.tutor_id) && (
                                  <button onClick={() => handleDelete(note.id)} className="p-1.5 text-on-surface-variant hover:text-error transition-colors" title="Delete">
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

              <div className="p-4 border-t border-outline-variant flex justify-between items-center bg-surface-bright">
                <span className="text-label-md font-label-md text-on-surface-variant">Showing {filteredNotes.length} resources</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
