"use client";

import { ErrorState } from "@/components/dashboard/async-states";
import { formatDeadline } from '@/lib/format-deadline';
import React, { useEffect, useState } from "react";
import { ChevronDown, CloudUpload, FileText } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { startNavigationProgress } from "@/components/navigation/NavigationProgress";
import { UploadTaskStatus } from "@/components/uploads/upload-task-status";
import { uploadFileWithProgress } from "@/lib/upload-with-progress";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { authenticatedApiFetch } from "@/lib/authenticated-fetch";
import { useActiveAccountId } from "@/lib/account-preference";
import { assignmentQueryKeys } from "@/lib/assignment-query-keys";
import { fetchAllPages } from "@/lib/fetch-all-pages";

function responseErrorMessage(response: Response, body: any, fallback: string) {
  if (typeof body?.error === "string" && body.error) return body.error;
  if (response.status === 401) return "Your session has ended. Please sign in again.";
  return fallback;
}

const SESSION_ENDED_MESSAGE = "Your session has ended. Please sign in again.";

function safeQueryErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message === SESSION_ENDED_MESSAGE ? SESSION_ENDED_MESSAGE : fallback;
}

type AssignmentListItem = {
  id: string;
  title: string;
  deadline_at: string;
  is_published: boolean;
  submission_count?: number;
  course?: { title?: string; name?: string } | null;
};

type AssignmentQueryData = {
  courses: Array<{ id: string; title?: string; name?: string }>;
  classContextName: string | null;
  assignments: AssignmentListItem[];
};

export function AssignmentsClient({ embedded = false }: { embedded?: boolean }) {
  const fetch = authenticatedApiFetch;
  const router = useRouter();
  const queryClient = useQueryClient();
  const activeAccountId = useActiveAccountId();
  const searchParams = useSearchParams();
  const contextualCourseId = searchParams.get("course_id");
  const classContextId = searchParams.get("class_id");

  // Form State
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [file, setFile] = useState<File | null>(null);
  // Status state
  const [isLoading, setIsLoading] = useState(false);
  const [saveStage, setSaveStage] = useState<"idle" | "uploading" | "saving">("idle");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const assignmentQuery = useQuery<AssignmentQueryData>({
    queryKey: assignmentQueryKeys.list(activeAccountId, contextualCourseId ?? null, classContextId ?? null),
    queryFn: async () => {
      const resCourses = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses`);
      const courseBody = await resCourses.json().catch(() => null);
      if (!resCourses.ok) throw new Error(responseErrorMessage(resCourses, courseBody, "Could not load Subjects"));
      const loadedCourses = courseBody?.data || [];
      let visibleCourses = loadedCourses;
      let nextClassContextName: string | null = null;
      if (classContextId) {
        const classRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/classes/${classContextId}`);
        const classBody = await classRes.json().catch(() => null);
        if (!classRes.ok) throw new Error(responseErrorMessage(classRes, classBody, "Could not load this class"));
        const classSubjectIds = new Set((classBody?.data?.courses || []).map((course: any) => course.id));
        visibleCourses = loadedCourses.filter((course: any) => classSubjectIds.has(course.id));
        if (contextualCourseId) visibleCourses = visibleCourses.filter((course: any) => course.id === contextualCourseId);
        nextClassContextName = classBody?.data?.name || "This class";
      }

      const allAssignments = await fetchAllPages<any>(
        (page) => fetch(`${process.env.NEXT_PUBLIC_API_URL}/assignments?page=${page}&page_size=100`),
        "Could not load assignments",
        (response, body) => responseErrorMessage(response, body, "Could not load assignments"),
      );
      return {
        courses: visibleCourses,
        classContextName: nextClassContextName,
        assignments: allAssignments,
      };
    },
  });

  const courses = assignmentQuery.data?.courses || [];
  const classContextName = assignmentQuery.data?.classContextName || null;
  const assignments = assignmentQuery.data?.assignments || [];
  const isFetching = assignmentQuery.isPending;

  // A subject deep link preselects its subject once the class subjects load.
  useEffect(() => {
    const loaded = assignmentQuery.data?.courses || [];
    if (contextualCourseId && loaded.some((course: any) => course.id === contextualCourseId)) {
      setCourseId(contextualCourseId);
    }
  }, [contextualCourseId, assignmentQuery.data?.courses]);

  const handleSubmit = async (publish: boolean) => {
    if (!courseId || !title || !description || !deadline) {
      toast.error("Complete the required assignment details");
      return;
    }

    setIsLoading(true);
    setSaveStage(file ? "uploading" : "saving");
    setUploadProgress(file ? 0 : null);
    try {
      let fileKey = null;

      if (file) {
        // 1. Get Presigned URL
        const presignRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/storage/presigned-url`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            file_name: file.name,
            content_type: file.type || "application/octet-stream",
            file_size_bytes: file.size,
            entity_type: "assignment_attachment",
            course_id: courseId
          })
        });
        const presignData = await presignRes.json().catch(() => null);
        if (!presignRes.ok) throw new Error(responseErrorMessage(presignRes, presignData, "Failed to get upload URL"));
        
        // 2. Upload directly to Cloudflare R2
        await uploadFileWithProgress(presignData.data.presigned_url, file, setUploadProgress);
        fileKey = presignData.data.file_key;
      }

      // 3. Create the Assignment Record
      setSaveStage("saving");
      setUploadProgress(null);
      const assignRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${courseId}/assignments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
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

      const assignmentBody = await assignRes.json().catch(() => null);
      if (!assignRes.ok) throw new Error(responseErrorMessage(assignRes, assignmentBody, "Failed to create assignment"));

      toast.success(publish ? "Assignment published" : "Assignment saved as a draft");
      if (classContextId) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["class-assignments", classContextId] }),
          queryClient.invalidateQueries({ queryKey: ["class-insights", classContextId] }),
        ]);
        startNavigationProgress();
        router.push(`/dashboard/classes/${classContextId}?tab=assessments${contextualCourseId ? `&subject=${encodeURIComponent(contextualCourseId)}` : ''}`);
        return;
      }
      setTitle("");
      setDescription("");
      setDeadline("");
      setFile(null);
      setCourseId("");
      await queryClient.invalidateQueries({
        queryKey: assignmentQueryKeys.list(activeAccountId, contextualCourseId ?? null, classContextId ?? null),
      });
    } catch (err: any) {
      toast.error("Could not save the assignment", { description: safeQueryErrorMessage(err, "Please try again.") });
    } finally {
      setIsLoading(false);
      setSaveStage("idle");
      setUploadProgress(null);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      selectAttachment(e.dataTransfer.files[0]);
    }
  };

  const selectAttachment = (selectedFile: File) => {
    const allowedExtensions = [".pdf", ".docx", ".pptx", ".jpg", ".jpeg", ".png"];
    const lowerName = selectedFile.name.toLowerCase();
    if (!allowedExtensions.some((extension) => lowerName.endsWith(extension))) {
      toast.error("Choose a PDF, Word, PowerPoint, JPG or PNG file");
      return;
    }
    if (selectedFile.size > 50 * 1024 * 1024) {
      toast.error("The attachment must be 50 MB or smaller");
      return;
    }
    setFile(selectedFile);
  };

  return (
    <div className="flex h-full flex-col gap-6 pb-8 xl:flex-row">
      {/* Left Column: Assignment Creator Form */}
      <div className="w-full xl:w-7/12 flex flex-col gap-6">
        {embedded ? (
          <div className="rounded-xl border border-dashboard-outline bg-[#faf9ff] px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-[.14em] text-dashboard-accent">Class assessment</p>
            <h2 className="mt-1 text-xl font-bold text-[#180d62]">Create assignment</h2>
            <p className="mt-1 text-sm text-dashboard-muted">{classContextName ? `This assignment is only for learners in ${classContextName}.` : "Choose a subject, add the work and set a deadline."}</p>
          </div>
        ) : (
          <DashboardPageHeader
            title={classContextName ? `Create assignment · ${classContextName}` : "Create Assignment"}
            description={classContextName ? "Choose one subject in this class, then write the task, set a deadline and attach supporting material if needed." : "Write the question or task, set a deadline, and optionally attach supporting material."}
          />
        )}

        <div className="flex flex-1 flex-col rounded-dashboard-panel border border-dashboard-outline bg-dashboard-surface shadow-dashboard-card">
          <div className="flex flex-1 flex-col gap-6 border-b border-dashboard-outline p-5 sm:p-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Course Selector */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold tracking-wider text-dashboard-foreground" htmlFor="course-select">
                  Subject
                </label>
                <div className="relative">
                  <select 
                    id="course-select"
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    disabled={Boolean(contextualCourseId)}
                    className="w-full cursor-pointer appearance-none rounded-dashboard-control border border-dashboard-outline bg-dashboard-surface px-3 py-2.5 text-base text-dashboard-foreground outline-none focus:border-dashboard-primary focus:ring-1 focus:ring-dashboard-primary"
                  >
                    <option disabled value="">Select a Subject...</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.title || c.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-dashboard-muted" />
                </div>
                {courses.length === 0 && !isFetching && (
                  <p className="text-xs leading-5 text-dashboard-muted">No subjects are available. Ask the account administrator to create a subject or assign one to you.</p>
                )}
              </div>

              {/* Deadline */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold tracking-wider text-dashboard-foreground" htmlFor="deadline">
                  Submission Deadline
                </label>
                <div className="relative flex items-center">
                  <input 
                    id="deadline" 
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full rounded-dashboard-control border border-dashboard-outline bg-dashboard-surface px-3 py-2.5 text-base text-dashboard-foreground outline-none focus:border-dashboard-primary focus:ring-1 focus:ring-dashboard-primary"
                  />
                </div>
              </div>
            </div>

            {/* Title */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold tracking-wider text-dashboard-foreground" htmlFor="title">
                Assignment Title
              </label>
              <input 
                id="title" 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. SS2 Physics: Motion and Forces"
                className="w-full rounded-dashboard-control border border-dashboard-outline bg-dashboard-surface px-3 py-2.5 text-base text-dashboard-foreground outline-none placeholder:text-dashboard-muted focus:border-dashboard-primary focus:ring-1 focus:ring-dashboard-primary"
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-2 flex-1 min-h-[160px]">
              <label className="text-xs font-semibold tracking-wider text-dashboard-foreground" htmlFor="description">
                Assignment Question(s)
              </label>
              <textarea 
                id="description" 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Paste or write the question(s) Learners must answer. For example: A ₦140,000 is shared between Abu, Kayode and Uche..."
                className="h-full w-full resize-none rounded-dashboard-control border border-dashboard-outline bg-dashboard-surface px-3 py-2.5 text-base text-dashboard-foreground outline-none placeholder:text-dashboard-muted focus:border-dashboard-primary focus:ring-1 focus:ring-dashboard-primary"
              />
            </div>

            {/* Attachment Dropzone */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold tracking-wider text-dashboard-foreground">
                Supporting Material (Optional)
              </label>
              <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => document.getElementById('file-upload')?.click()}
                className="group relative flex cursor-pointer flex-col items-center justify-center rounded-dashboard-panel border-2 border-dashed border-dashboard-outline bg-dashboard-surface-subtle p-8 text-center transition-colors hover:bg-dashboard-primary/5"
              >
                <input 
                  type="file" 
                  id="file-upload" 
                  accept=".pdf,.docx,.pptx,.jpg,.jpeg,.png"
                  className="hidden" 
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0];
                    if (selectedFile) selectAttachment(selectedFile);
                  }}
                />
                
                {file ? (
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-dashboard-primary/10">
                      <FileText className="h-6 w-6 text-dashboard-primary" />
                    </div>
                    <p className="text-base font-medium text-dashboard-foreground">{file.name}</p>
                    <p className="text-sm font-light text-dashboard-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-dashboard-surface transition-colors group-hover:bg-dashboard-primary/10">
                      <CloudUpload className="h-6 w-6 text-dashboard-muted transition-colors group-hover:text-dashboard-primary" />
                    </div>
                    <p className="text-base text-dashboard-foreground">Drag & drop files here, or <span className="font-bold text-dashboard-primary">browse</span></p>
                    <p className="mt-1 text-sm font-light text-dashboard-muted">PDF, Word, PowerPoint, JPG or PNG up to 50 MB</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Card Footer Actions */}
          <div className="flex flex-col gap-4 rounded-b bg-dashboard-surface p-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0 flex-1">{isLoading ? <UploadTaskStatus label={saveStage === "uploading" ? "Uploading assignment file" : "Saving assignment"} progress={saveStage === "uploading" ? uploadProgress : null} /> : <p className="text-xs leading-5 text-dashboard-muted">Save a draft to finish later, or publish when learners should receive it.</p>}</div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-end gap-3">
              <button 
                type="button" 
                onClick={() => {
                  setTitle(""); setDescription(""); setDeadline(""); setCourseId(""); setFile(null);
                }}
                className="px-4 py-2 text-xs font-semibold tracking-wider text-dashboard-muted transition-colors hover:text-dashboard-foreground"
                disabled={isLoading}
              >
                Clear
              </button>
              <button 
                type="button" 
                onClick={() => handleSubmit(false)}
                disabled={isLoading}
                className="rounded-dashboard-control border border-dashboard-primary px-4 py-2 text-xs font-semibold tracking-wider text-dashboard-primary transition-colors hover:bg-dashboard-primary/5 disabled:opacity-50"
              >
                {isLoading ? "Saving..." : "Save as Draft"}
              </button>
              <button 
                type="button" 
                onClick={() => handleSubmit(true)}
                disabled={isLoading}
                className="rounded-dashboard-control bg-dashboard-primary px-6 py-2 text-xs font-semibold tracking-wider text-white shadow-sm transition-colors hover:bg-dashboard-primary/90 disabled:opacity-50"
              >
                {isLoading ? "Publishing..." : "Publish Assignment"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Recent Assignments List */}
      <div className="w-full xl:w-5/12 flex flex-col gap-6">
        <div className="flex flex-col gap-1 flex-shrink-0">
          <h2 className="text-lg font-semibold text-dashboard-foreground">Recent assignments</h2>
          <p className="text-sm font-light text-dashboard-muted">
            Track upcoming deadlines and learner submissions.
          </p>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden rounded-dashboard-panel border border-dashboard-outline bg-dashboard-surface shadow-dashboard-card">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 border-b border-dashboard-outline bg-dashboard-surface-subtle px-5 py-3 text-xs font-semibold uppercase tracking-wider text-dashboard-muted">
            <div className="col-span-6">Assignment Title</div>
            <div className="col-span-3 text-right">Deadline</div>
            <div className="col-span-3 text-right">Status</div>
          </div>

          {/* Scrollable List Area */}
          <div className="overflow-y-auto flex-1">
            {isFetching ? (
              <div className="p-8 text-center text-sm text-dashboard-muted">Loading assignments…</div>
            ) : assignmentQuery.isError && !assignmentQuery.data ? (
              <ErrorState message={safeQueryErrorMessage(assignmentQuery.error, "Could not load assignments. Please try again.")} onRetry={() => void assignmentQuery.refetch()} />
            ) : assignments.length === 0 ? (
              <div className="p-8 text-center text-sm text-dashboard-muted">
                <FileText className="mx-auto mb-3 h-8 w-8 text-dashboard-outline" />
                <p className="font-semibold text-dashboard-foreground">No assignments yet</p>
                <p className="mt-1">Create one using the form beside this list.</p>
              </div>
            ) : (
              assignments.map((assignment, index) => {
                const isDraft = !assignment.is_published;
                const dateString = formatDeadline(assignment.deadline_at);
                
                return (
                  <div 
                    key={assignment.id || index}
                    onClick={() => {
                      startNavigationProgress();
                      router.push(`/dashboard/assignments/${assignment.id}/submissions`);
                    }}
                    role="link"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        startNavigationProgress();
                        router.push(`/dashboard/assignments/${assignment.id}/submissions`);
                      }
                    }}
                    className={`group grid cursor-pointer grid-cols-12 items-center gap-4 border-b border-dashboard-outline px-5 py-4 transition-colors hover:bg-dashboard-primary/5 ${isDraft ? 'bg-dashboard-surface-subtle' : ''}`}
                  >
                    <div className="col-span-6 flex flex-col gap-1">
                      <span className={`truncate text-base font-bold transition-colors ${isDraft ? 'text-dashboard-muted group-hover:text-dashboard-primary' : 'text-dashboard-foreground group-hover:text-dashboard-primary'}`}>
                        {assignment.title}
                      </span>
                      <span className={`truncate text-xs font-semibold tracking-wider ${isDraft ? 'text-dashboard-outline' : 'text-dashboard-muted'}`}>
                        {assignment.course?.title || assignment.course?.name || "Subject unavailable"}
                      </span>
                    </div>
                    <div className="col-span-3 flex flex-col gap-1 items-end">
                      <span className={`whitespace-nowrap text-sm ${isDraft ? 'text-dashboard-outline' : 'text-dashboard-foreground'}`}>
                        {dateString}
                      </span>
                    </div>
                    <div className="col-span-3 flex justify-end">
                      {isDraft ? (
                        <div className="inline-flex items-center gap-1 rounded-dashboard-control border border-dashboard-outline px-2 py-1 text-xs font-semibold tracking-wider text-dashboard-muted">
                          Draft
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 rounded-dashboard-control bg-dashboard-primary/10 px-2 py-1 text-xs font-semibold tracking-wider text-dashboard-primary">
                          <span className="h-1.5 w-1.5 rounded-full bg-dashboard-primary"></span>
                          {assignment.submission_count || 0} submissions
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
