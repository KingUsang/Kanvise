"use client";

import Link from "next/link";
import { CalendarDays, CheckCircle2, Clock3, Radio, UserRound, Video } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getApiUrl } from "@/config/api";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import type { StudentClass } from "@/lib/student-classes";

type View = "all" | "upcoming" | "past";
type ClassResources = { recordingUrl?: string | null; summary?: string | null; loading?: boolean; error?: string };

export function filterStudentClasses(classes: StudentClass[], view: View, courseId: string, now: number) {
  return classes.filter((item) => {
    const isPast = item.status === "completed" || item.status === "cancelled" || (item.status === "scheduled" && new Date(item.scheduled_at).getTime() < now);
    if (courseId !== "all" && item.course_id !== courseId) return false;
    if (view === "upcoming" && (isPast || item.status === "cancelled")) return false;
    if (view === "past" && !isPast) return false;
    return true;
  });
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-NG", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("en-NG", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function tutorName(item: StudentClass) {
  if (!item.tutor) return "Tutor to be confirmed";
  return [item.tutor.first_name, item.tutor.last_name].filter(Boolean).join(" ") || "Your tutor";
}

export function StudentClassesClient() {
  const classesQuery = useQuery<StudentClass[]>({
    queryKey: ["student-classes"],
    queryFn: async () => {
      const response = await authenticatedFetch(createClient(), `${getApiUrl()}/live-classes`, { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Failed to load student classes");
      return body.data || [];
    },
  });
  const classes = classesQuery.data ?? [];
  const [view, setView] = useState<View>("all");
  const [courseId, setCourseId] = useState("all");
  const [resources, setResources] = useState<Record<string, ClassResources>>({});
  const now = Date.now();
  const visibleClasses = useMemo(() => filterStudentClasses(classes, view, courseId, now), [classes, courseId, now, view]);

  const courses = useMemo(() => Array.from(new Map(classes.map((item) => [item.course_id, item.course?.name || "Subject"])).entries()), [classes]);
  const liveCount = classes.filter((item) => item.status === "live").length;
  const upcomingCount = classes.filter((item) => item.status === "scheduled" && new Date(item.scheduled_at).getTime() >= now).length;
  const completedCount = classes.filter((item) => item.status === "completed").length;

  async function loadResources(classId: string) {
    setResources((current) => ({ ...current, [classId]: { ...current[classId], loading: true, error: undefined } }));
    try {
      const api = getApiUrl();
      const client = createClient();
      const [recordingResponse, recapResponse] = await Promise.all([
        authenticatedFetch(client, `${api}/live-classes/${classId}/recording`, { cache: "no-store" }),
        authenticatedFetch(client, `${api}/live-classes/${classId}/recap`, { cache: "no-store" }),
      ]);
      const recordingBody = await recordingResponse.json().catch(() => null);
      const recapBody = await recapResponse.json().catch(() => null);
      if (!recordingResponse.ok && recordingResponse.status !== 404) throw new Error(recordingBody?.error || "Could not load recording");
      if (!recapResponse.ok && recapResponse.status !== 404) throw new Error(recapBody?.error || "Could not load summary");
      setResources((current) => ({
        ...current,
        [classId]: {
          loading: false,
          recordingUrl: recordingBody?.data?.playback_url || null,
          summary: recapBody?.data?.published_body || null,
        },
      }));
    } catch (error) {
      setResources((current) => ({ ...current, [classId]: { loading: false, error: error instanceof Error ? error.message : "Could not load class resources" } }));
    }
  }

  if (classesQuery.isPending) return <div className="rounded-2xl border border-[#e5e1dd] bg-white p-10 text-center text-sm text-[#716c76]">Loading classes…</div>;
  if (classesQuery.isError) return <div className="rounded-2xl border border-red-200 bg-red-50 p-10 text-center text-sm text-red-800"><p>{classesQuery.error.message}</p><button type="button" onClick={() => void classesQuery.refetch()} className="mt-4 rounded-lg bg-[#2e2877] px-4 py-2 font-semibold text-white">Try again</button></div>;
  return <>
    <section className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-[#e5e1dd] bg-white p-4"><div className="flex items-center gap-2 text-[#994704]"><Radio size={18} /><span className="text-xs font-semibold uppercase tracking-wide">Live now</span></div><p className="mt-2 text-2xl font-semibold">{liveCount}</p></div>
      <div className="rounded-2xl border border-[#e5e1dd] bg-white p-4"><div className="flex items-center gap-2 text-[#2e2877]"><CalendarDays size={18} /><span className="text-xs font-semibold uppercase tracking-wide">Coming up</span></div><p className="mt-2 text-2xl font-semibold">{upcomingCount}</p></div>
      <div className="rounded-2xl border border-[#e5e1dd] bg-white p-4"><div className="flex items-center gap-2 text-[#5f5964]"><CheckCircle2 size={18} /><span className="text-xs font-semibold uppercase tracking-wide">Completed</span></div><p className="mt-2 text-2xl font-semibold">{completedCount}</p></div>
    </section>

    <section className="mt-6 rounded-2xl border border-[#e5e1dd] bg-white p-4 sm:p-6">
      <div className="flex flex-col gap-4 border-b border-[#eeeae6] pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-xl bg-[#f3f0ed] p-1">
          {(["all", "upcoming", "past"] as View[]).map((item) => <button key={item} onClick={() => setView(item)} className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium capitalize transition sm:flex-none ${view === item ? "bg-white text-[#2e2877] shadow-sm" : "text-[#716c76] hover:text-[#2e2877]"}`}>{item}</button>)}
        </div>
        <label className="flex items-center gap-2 text-sm text-[#716c76]"><span className="shrink-0">Subject</span><select value={courseId} onChange={(event) => setCourseId(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-[#dcd6d1] bg-white px-3 py-2.5 text-[#25232d] outline-none focus:border-[#2e2877] sm:min-w-52"><option value="all">All subjects</option>{courses.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      </div>

      <div className="mt-5 space-y-4">
        {visibleClasses.length ? visibleClasses.map((item) => {
          const scheduledTime = new Date(item.scheduled_at).getTime();
          const isPast = item.status === "completed" || item.status === "cancelled" || (item.status === "scheduled" && scheduledTime < now);
          return <article key={item.id} className={`rounded-2xl border p-4 sm:flex sm:items-center sm:gap-5 sm:p-5 ${item.status === "live" ? "border-[#c26627] bg-[#fffaf5]" : "border-[#e5e1dd] bg-white"}`}>
            <div className="flex items-start gap-4 sm:min-w-48"><div className="rounded-xl bg-[#eeeafe] px-3 py-2 text-center text-[#2e2877]"><p className="text-lg font-semibold leading-5">{new Date(item.scheduled_at).getDate()}</p><p className="text-[11px] uppercase">{new Intl.DateTimeFormat("en-NG", { month: "short" }).format(new Date(item.scheduled_at))}</p></div><div><p className="text-sm font-semibold">{timeLabel(item.scheduled_at)}</p><p className="mt-1 text-xs text-[#77727e]">{dateLabel(item.scheduled_at)}</p><p className="mt-1 flex items-center gap-1 text-xs text-[#77727e]"><Clock3 size={12} />{item.duration_minutes} mins</p></div></div>
            <div className="mt-4 min-w-0 flex-1 sm:mt-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.title}</p>{item.status === "live" && <span className="rounded-full bg-[#fbe6d6] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#994704]">Live now</span>}{item.status === "cancelled" && <span className="rounded-full bg-[#f1efed] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#716c76]">Cancelled</span>}</div><p className="mt-1 text-sm text-[#716c76]">{item.course?.name || "Subject"}</p><p className="mt-2 flex items-center gap-1.5 text-xs text-[#77727e]"><UserRound size={13} />{tutorName(item)}</p></div>
            <div className="mt-4 sm:mt-0 sm:text-right">{item.status === "live" ? <Link href={`/class/${item.id}`} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#994704] px-5 py-3 text-sm font-semibold text-white hover:bg-[#7f3a03] sm:w-auto"><Video size={17} />Join class</Link> : item.status === "completed" ? <div className="flex flex-wrap justify-end gap-2">
              {item.recording_status === "ready" && <button type="button" onClick={() => void loadResources(item.id)} className="inline-flex items-center gap-2 rounded-xl border border-[#2e2877] px-3 py-2 text-sm font-semibold text-[#2e2877]">Watch recording</button>}
              {item.recap_status === "published" && <button type="button" onClick={() => void loadResources(item.id)} className="inline-flex items-center gap-2 rounded-xl border border-[#994704] px-3 py-2 text-sm font-semibold text-[#994704]">Read summary</button>}
              {!item.recording_status || item.recording_status === "pending" || item.recording_status === "transferring" ? <span className="self-center text-xs text-[#77727e]">Recording processing</span> : null}
              {item.recap_status === "draft" || item.recap_status === "generating" ? <span className="self-center text-xs text-[#77727e]">Summary pending review</span> : null}
            </div> : <p className={`text-sm font-medium ${isPast ? "text-[#77727e]" : "text-[#2e2877]"}`}>{item.status === "cancelled" ? "Class cancelled" : isPast ? "Awaiting an update" : "Scheduled"}</p>}</div>
            {resources[item.id] && (resources[item.id].loading || resources[item.id].error || resources[item.id].recordingUrl || resources[item.id].summary) && <div className="mt-4 border-t border-[#eeeae6] pt-4 sm:col-span-3">
              {resources[item.id].loading && <p className="text-sm text-[#716c76]">Loading class resources…</p>}
              {resources[item.id].error && <p role="alert" className="text-sm text-red-700">{resources[item.id].error}</p>}
              {resources[item.id].recordingUrl && <video controls preload="metadata" className="w-full rounded-xl bg-black" src={resources[item.id].recordingUrl || undefined}>Your browser does not support video playback.</video>}
              {resources[item.id].summary && <article className="mt-4 rounded-xl border border-[#e5e1dd] bg-[#fbf9f8] p-4"><h3 className="font-semibold text-[#1b1c1c]">Class summary</h3><div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#474551]">{resources[item.id].summary}</div></article>}
            </div>}
          </article>;
        }) : <div className="py-12 text-center"><CalendarDays className="mx-auto text-[#aaa4ad]" /><h2 className="mt-3 font-semibold">No classes here</h2><p className="mt-1 text-sm text-[#716c76]">Try another filter, or check back after your tutor schedules a class.</p></div>}
      </div>
    </section>
  </>;
}
