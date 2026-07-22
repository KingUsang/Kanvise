"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown, CloudUpload, ArrowRight, FileText } from "lucide-react";
import { createBrowserClient } from '@supabase/ssr';

export default function AssignmentsPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);

  // Form State
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isPublished, setIsPublished] = useState(true);

  // Status state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetchData = async () => {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) return;

    try {
      // Fetch courses for the dropdown
      const resCourses = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resCourses.ok) {
        const data = await resCourses.json();
        setCourses(data.data || []);
      }

      // Fetch assignments using the new aggregated backend endpoint
      const resAssignments = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/assignments?page=1&page_size=20`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resAssignments.ok) {
        const data = await resAssignments.json();
        setAssignments(data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch initial data", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (publish: boolean) => {
    setError("");
    setSuccess("");
    if (!courseId || !title || !description || !deadline) {
      setError("Please fill out all required fields.");
      return;
    }

    setIsLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      
      let fileKey = null;

      if (file) {
        // 1. Get Presigned URL
        const presignRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/storage/presigned-url`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            file_name: file.name,
            content_type: file.type || "application/octet-stream",
            file_size_bytes: file.size,
            entity_type: "assignment_attachment",
            course_id: courseId
          })
        });

        if (!presignRes.ok) {
          const errData = await presignRes.json();
          throw new Error(errData.error || "Failed to get upload URL");
        }
        
        const presignData = await presignRes.json();
        
        // 2. Upload directly to Cloudflare R2
        const uploadRes = await fetch(presignData.data.presigned_url, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type || "application/octet-stream"
          }
        });
        
        if (!uploadRes.ok) throw new Error("Failed to upload file to storage");
        fileKey = presignData.data.file_key;
      }

      // 3. Create the Assignment Record
      const assignRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${courseId}/assignments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          description,
          deadline_at: new Date(deadline).toISOString(),
          attachment_file_key: fileKey,
          attachment_file_name: file ? file.name : null,
          attachment_file_type: file ? file.type || "application/octet-stream" : null,
          attachment_file_size_bytes: file ? file.size : null,
          is_published: publish
        })
      });

      if (!assignRes.ok) {
        const errorData = await assignRes.json();
        throw new Error(errorData.error || "Failed to create assignment");
      }

      setSuccess(publish ? "Assignment successfully published!" : "Assignment saved as draft!");
      setTitle("");
      setDescription("");
      setDeadline("");
      setFile(null);
      setCourseId("");
      fetchData(); // Refresh the ledger immediately
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 h-full pb-8">
      {/* Left Column: Assignment Creator Form */}
      <div className="w-full xl:w-7/12 flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold text-on-background">Create Assignment</h2>
          <p className="text-sm font-light text-on-surface-variant">
            Set deadlines, add instructions, and attach study materials for your students.
          </p>
        </div>

        <div className="bg-surface-container-lowest rounded border border-outline-variant shadow-[0px_4px_20px_rgba(61,61,61,0.08)] flex flex-col flex-1">
          <div className="p-6 flex-1 flex flex-col gap-6 border-b border-outline-variant">
            
            {error && (
              <div className="p-3 bg-error-container text-on-error-container text-sm rounded border border-error/20">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 bg-primary-fixed text-on-primary-fixed text-sm rounded border border-primary/20">
                {success}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Course Selector */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold tracking-wider text-on-background" htmlFor="course-select">
                  Target Programme / Course
                </label>
                <div className="relative">
                  <select 
                    id="course-select"
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    className="w-full appearance-none bg-surface border border-outline-variant rounded px-3 py-2.5 text-base text-on-background focus:border-primary focus:ring-1 focus:ring-primary outline-none cursor-pointer"
                  >
                    <option disabled value="">Select a programme...</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.title || c.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-outline w-5 h-5 pointer-events-none" />
                </div>
              </div>

              {/* Deadline */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold tracking-wider text-on-background" htmlFor="deadline">
                  Submission Deadline
                </label>
                <div className="relative flex items-center">
                  <input 
                    id="deadline" 
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded px-3 py-2.5 text-base text-on-background focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Title */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold tracking-wider text-on-background" htmlFor="title">
                Assignment Title
              </label>
              <input 
                id="title" 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Final Essay Draft - Modernism"
                className="w-full bg-surface border border-outline-variant rounded px-3 py-2.5 text-base text-on-background focus:border-primary focus:ring-1 focus:ring-primary outline-none placeholder:text-outline"
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-2 flex-1 min-h-[160px]">
              <label className="text-xs font-semibold tracking-wider text-on-background" htmlFor="description">
                Detailed Instructions
              </label>
              <textarea 
                id="description" 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide clear guidelines, formatting requirements, and grading rubrics..."
                className="w-full h-full resize-none bg-surface border border-outline-variant rounded px-3 py-2.5 text-base text-on-background focus:border-primary focus:ring-1 focus:ring-primary outline-none placeholder:text-outline"
              />
            </div>

            {/* Attachment Dropzone */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold tracking-wider text-on-background">
                Supporting Materials (Optional)
              </label>
              <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => document.getElementById('file-upload')?.click()}
                className="border-2 border-dashed border-outline-variant rounded bg-surface-container-low hover:bg-surface-variant transition-colors p-8 flex flex-col items-center justify-center text-center cursor-pointer group relative"
              >
                <input 
                  type="file" 
                  id="file-upload" 
                  className="hidden" 
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                
                {file ? (
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center mb-1">
                      <FileText className="text-primary w-6 h-6" />
                    </div>
                    <p className="text-base text-on-background font-medium">{file.name}</p>
                    <p className="text-sm font-light text-on-surface-variant">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center mb-3 group-hover:bg-primary-fixed transition-colors">
                      <CloudUpload className="text-on-surface-variant group-hover:text-primary transition-colors w-6 h-6" />
                    </div>
                    <p className="text-base text-on-background">Drag & drop files here, or <span className="text-primary font-bold">browse</span></p>
                    <p className="text-sm font-light text-on-surface-variant mt-1">Supports PDF, DOCX, ZIP up to 50MB</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Card Footer Actions */}
          <div className="p-4 bg-surface-container-lowest flex items-center justify-between rounded-b">
            {/* Publish Toggle */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                />
                <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-outline-variant after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary"></div>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold tracking-wider text-on-background">Publish Immediately</span>
                <span className="text-[10px] text-on-surface-variant">Students will be notified</span>
              </div>
            </label>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button 
                type="button" 
                onClick={() => {
                  setTitle(""); setDescription(""); setDeadline(""); setCourseId(""); setFile(null);
                }}
                className="px-4 py-2 text-xs font-semibold tracking-wider text-on-surface-variant hover:text-on-background transition-colors"
                disabled={isLoading}
              >
                Clear
              </button>
              <button 
                type="button" 
                onClick={() => handleSubmit(false)}
                disabled={isLoading}
                className="px-4 py-2 border border-primary text-primary text-xs font-semibold tracking-wider rounded hover:bg-primary/5 transition-colors disabled:opacity-50"
              >
                {isLoading && !isPublished ? "Saving..." : "Save as Draft"}
              </button>
              <button 
                type="button" 
                onClick={() => handleSubmit(true)}
                disabled={isLoading}
                className="px-6 py-2 bg-secondary text-white text-xs font-semibold tracking-wider rounded hover:bg-secondary/90 transition-colors shadow-sm disabled:opacity-50"
              >
                {isLoading && isPublished ? "Publishing..." : "Publish Assignment"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Recent Assignments List */}
      <div className="w-full xl:w-5/12 flex flex-col gap-6">
        <div className="flex flex-col gap-1 flex-shrink-0">
          <h2 className="text-2xl font-semibold text-on-background">Recent Assignments</h2>
          <p className="text-sm font-light text-on-surface-variant">
            Track upcoming deadlines and student submissions.
          </p>
        </div>

        <div className="bg-surface-container-lowest rounded border border-outline-variant shadow-[0px_4px_20px_rgba(61,61,61,0.08)] flex-1 flex flex-col overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-tertiary-fixed border-b border-outline-variant text-xs font-semibold tracking-wider text-on-surface-variant uppercase">
            <div className="col-span-6">Assignment Title</div>
            <div className="col-span-3 text-right">Deadline</div>
            <div className="col-span-3 text-right">Status</div>
          </div>

          {/* Scrollable List Area */}
          <div className="overflow-y-auto flex-1">
            {assignments.length === 0 ? (
              <div className="p-8 text-center text-sm text-on-surface-variant">
                No assignments found.
              </div>
            ) : (
              assignments.map((assignment, index) => {
                const isDraft = !assignment.is_published;
                const dateString = new Date(assignment.deadline_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                
                return (
                  <div 
                    key={assignment.id || index}
                    className={`group grid grid-cols-12 gap-4 px-5 py-4 border-b border-outline-variant hover:bg-primary-fixed/5 transition-colors items-center cursor-pointer ${isDraft ? 'bg-surface-container-low/50' : ''}`}
                  >
                    <div className="col-span-6 flex flex-col gap-1">
                      <span className={`text-base font-bold truncate transition-colors ${isDraft ? 'text-on-surface-variant group-hover:text-primary' : 'text-on-background group-hover:text-primary'}`}>
                        {assignment.title}
                      </span>
                      <span className={`text-xs font-semibold tracking-wider truncate ${isDraft ? 'text-outline' : 'text-on-surface-variant'}`}>
                        {assignment.course?.title || assignment.course?.name || "Unknown Course"}
                      </span>
                    </div>
                    <div className="col-span-3 flex flex-col gap-1 items-end">
                      <span className={`text-sm whitespace-nowrap ${isDraft ? 'text-outline' : 'text-on-background'}`}>
                        {dateString}
                      </span>
                    </div>
                    <div className="col-span-3 flex justify-end">
                      {isDraft ? (
                        <div className="px-2 py-1 rounded border border-outline-variant text-on-surface-variant text-xs font-semibold tracking-wider inline-flex items-center gap-1">
                          Draft
                        </div>
                      ) : (
                        <div className="px-2 py-1 rounded bg-secondary-fixed text-on-secondary-fixed text-xs font-semibold tracking-wider inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                          {assignment.submission_count || 0}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
