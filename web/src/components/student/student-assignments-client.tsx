"use client";

import { createBrowserClient } from "@supabase/ssr";
import { CalendarDays, CheckCircle2, Download, FileText, Search, Send, UploadCloud, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getApiUrl } from "@/config/api";
import type { StudentAssignment } from "@/lib/student-assignments";

type Status = "all" | "pending" | "submitted" | "graded" | "overdue";
const allowedTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "image/jpeg", "image/png"];

export function assignmentStatus(item: StudentAssignment, now = Date.now()): Exclude<Status, "all"> {
  if (item.submission?.score !== null && item.submission?.score !== undefined) return "graded";
  if (item.submission) return "submitted";
  return new Date(item.deadline_at).getTime() < now ? "overdue" : "pending";
}

function dateTime(value: string) { return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)); }

export function StudentAssignmentsClient({ assignments: initialAssignments }: { assignments: StudentAssignment[] }) {
  const [assignments, setAssignments] = useState(initialAssignments);
  // Opening this page should show the assignment list first. On small screens a
  // selected assignment is presented as a full-screen sheet, so selecting the
  // first item here made that sheet appear as soon as the page loaded.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("all");
  const [search, setSearch] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = assignments.find((item) => item.id === selectedId) || null;
  const visible = useMemo(() => assignments.filter((item) => {
    if (status !== "all" && assignmentStatus(item) !== status) return false;
    const query = search.trim().toLowerCase();
    return !query || item.title.toLowerCase().includes(query) || item.course?.name.toLowerCase().includes(query);
  }), [assignments, search, status]);

  function chooseFile(next: File | null) {
    if (!next) return setFile(null);
    if (!allowedTypes.includes(next.type)) return toast.error("Choose a PDF, Word, PowerPoint, JPG, or PNG file.");
    if (next.size > 50 * 1024 * 1024) return toast.error("Your file must be 50MB or smaller.");
    setFile(next);
  }

  async function submitAssignment() {
    if (!selected || !file) return;
    setSubmitting(true);
    try {
      const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Your session has expired. Please sign in again.");
      const headers = { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" };
      const presign = await fetch(`${getApiUrl()}/storage/presign/upload`, { method: "POST", headers, body: JSON.stringify({ entity_type: "submission", assignment_id: selected.id, file_name: file.name, content_type: file.type, file_size_bytes: file.size }) });
      const presignBody = await presign.json();
      if (!presign.ok) throw new Error(presignBody.error || "Could not prepare your upload.");
      const upload = await fetch(presignBody.data.presigned_url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!upload.ok) throw new Error("The file upload failed. Please try again.");
      const response = await fetch(`${getApiUrl()}/assignments/${selected.id}/submit`, { method: "POST", headers, body: JSON.stringify({ file_key: presignBody.data.file_key, file_name: file.name, file_type: file.type, file_size_bytes: file.size }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not submit your assignment.");
      setAssignments((items) => items.map((item) => item.id === selected.id ? { ...item, submission: body.data } : item));
      setFile(null);
      toast.success("Assignment submitted successfully.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit your assignment.");
    } finally { setSubmitting(false); }
  }

  return <main className="mx-auto max-w-[1440px] px-4 py-7 pb-24 sm:px-6 lg:px-10 lg:py-10">
    <header><p className="text-sm font-medium text-[#994704]">Coursework</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Assignments</h1><p className="mt-2 text-sm text-[#716c76]">Review the question, submit your work, and see feedback from your tutors.</p></header>
    <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex overflow-x-auto rounded-xl bg-[#eeeae6] p-1">{(["all", "pending", "submitted", "graded", "overdue"] as Status[]).map((item) => <button key={item} onClick={() => setStatus(item)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium capitalize ${status === item ? "bg-white text-[#2e2877] shadow-sm" : "text-[#716c76]"}`}>{item}</button>)}</div><label className="relative block lg:w-80"><Search className="absolute left-3 top-3 text-[#8b858f]" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by title or subject" className="w-full rounded-xl border border-[#ddd7d2] bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#2e2877]" /></label></div>
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(300px,0.85fr)_minmax(420px,1.4fr)]">
      <section className="space-y-3">{visible.length ? visible.map((item) => { const current = assignmentStatus(item); return <button key={item.id} onClick={() => setSelectedId(item.id)} className={`w-full rounded-2xl border bg-white p-4 text-left transition ${selectedId === item.id ? "border-[#2e2877] shadow-sm" : "border-[#e5e1dd] hover:border-[#bcb5c1]"}`}><div className="flex items-start justify-between gap-3"><span className="text-[10px] font-bold uppercase tracking-wide text-[#994704]">{item.course?.name || "Subject"}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${current === "graded" ? "bg-[#e7f4ec] text-[#267045]" : current === "submitted" ? "bg-[#eeeafe] text-[#2e2877]" : current === "overdue" ? "bg-[#fde8e4] text-[#a43522]" : "bg-[#f7eadc] text-[#994704]"}`}>{current}</span></div><h2 className="mt-2 font-semibold">{item.title}</h2><p className="mt-3 flex items-center gap-1.5 text-xs text-[#716c76]"><CalendarDays size={13} />Due {dateTime(item.deadline_at)}</p></button>; }) : <div className="rounded-2xl border border-[#e5e1dd] bg-white py-12 text-center"><FileText className="mx-auto text-[#aaa4ad]" /><p className="mt-3 font-medium">No assignments found</p><p className="mt-1 text-sm text-[#716c76]">Try another filter or search.</p></div>}</section>
      {selected ? <section className="fixed inset-0 z-50 overflow-y-auto bg-[#f8f7f5] p-4 lg:sticky lg:top-24 lg:z-0 lg:max-h-[calc(100vh-7rem)] lg:rounded-2xl lg:border lg:border-[#e5e1dd] lg:bg-white lg:p-6"><button onClick={() => setSelectedId(null)} className="float-right rounded-lg p-2 lg:hidden" aria-label="Close assignment"><X /></button><p className="text-xs font-semibold uppercase tracking-wide text-[#994704]">{selected.course?.name || "Subject"}</p><h2 className="mt-2 pr-10 text-2xl font-semibold">{selected.title}</h2><p className="mt-2 text-sm text-[#716c76]">Due {dateTime(selected.deadline_at)}</p><div className="mt-6 border-t border-[#eeeae6] pt-5"><h3 className="font-semibold">Assignment question(s)</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#5f5964]">{selected.description}</p></div>{selected.attachment_download_url && <a href={selected.attachment_download_url} target="_blank" rel="noreferrer" className="mt-5 flex items-center justify-between rounded-xl bg-[#f3f0ed] p-4 text-sm font-medium text-[#2e2877]"><span className="flex min-w-0 items-center gap-2"><FileText size={18} /><span className="truncate">{selected.attachment_file_name || "Supporting material"}</span></span><Download size={17} /></a>}
        {selected.submission ? <div className="mt-6 rounded-2xl border border-[#d9e9df] bg-[#f5fbf7] p-5"><div className="flex items-center gap-2 font-semibold text-[#267045]"><CheckCircle2 size={19} />{selected.submission.score !== null ? "Graded" : "Submitted"}</div><p className="mt-2 text-sm text-[#5f5964]">Sent {dateTime(selected.submission.submitted_at)}{selected.submission.is_late ? " · Submitted late" : ""}</p>{selected.submission.score !== null && <p className="mt-4 text-3xl font-semibold text-[#2e2877]">{selected.submission.score} marks</p>}{selected.submission.feedback && <div className="mt-4 border-t border-[#d9e9df] pt-4"><p className="text-xs font-semibold uppercase tracking-wide text-[#716c76]">Tutor feedback</p><p className="mt-2 text-sm leading-6">{selected.submission.feedback}</p></div>}{selected.submission.download_url && <a href={selected.submission.download_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#2e2877]"><Download size={16} />Download my submission</a>}</div> : <div className="mt-6"><h3 className="font-semibold">Submit your work</h3><input ref={inputRef} type="file" className="hidden" accept=".pdf,.docx,.pptx,.jpg,.jpeg,.png" onChange={(event) => chooseFile(event.target.files?.[0] || null)} /><button onClick={() => inputRef.current?.click()} className="mt-3 flex w-full flex-col items-center rounded-2xl border-2 border-dashed border-[#cfc8d2] px-5 py-8 text-center hover:border-[#2e2877]"><UploadCloud className="text-[#2e2877]" /><span className="mt-2 text-sm font-medium">{file ? file.name : "Choose your assignment file"}</span><span className="mt-1 text-xs text-[#77727e]">PDF, Word, PowerPoint, JPG or PNG · up to 50MB</span></button><button disabled={!file || submitting} onClick={submitAssignment} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#994704] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Send size={17} />{submitting ? "Submitting…" : "Submit assignment"}</button></div>}
      </section> : <section className="hidden rounded-2xl border border-[#e5e1dd] bg-white p-8 text-center lg:block"><FileText className="mx-auto text-[#aaa4ad]" /><p className="mt-3 font-medium">Choose an assignment</p><p className="mt-1 text-sm text-[#716c76]">Its question(s) and submission area will appear here.</p></section>}
    </div>
  </main>;
}
