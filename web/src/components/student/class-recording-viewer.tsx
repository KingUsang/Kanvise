"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Gauge, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { getApiUrl } from "@/config/api";

type Session = {
  id: string; title: string; scheduled_at: string; tutor?: { first_name?: string; last_name?: string } | null;
  course?: { name?: string } | null; courses?: { name?: string } | null;
};
type Recording = { id: string; playback_url: string | null; playback_expires_at?: string | null; status: string };

async function apiJson(path: string) {
  const response = await authenticatedFetch(createClient(), `${getApiUrl()}${path}`, { cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || "Could not load this recording.");
  return body.data;
}

export function ClassRecordingViewer({ sessionId }: { sessionId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const resumeAt = useRef(0);
  const [speed, setSpeed] = useState(1);
  const sessionQuery = useQuery<Session>({ queryKey: ["recording-session", sessionId], queryFn: () => apiJson(`/live-classes/${sessionId}`) });
  const recordingQuery = useQuery<Recording>({ queryKey: ["recording-playback", sessionId], queryFn: () => apiJson(`/live-classes/${sessionId}/recording`), retry: 1 });
  const recapQuery = useQuery<{ published_body?: string | null }>({
    queryKey: ["recording-recap", sessionId],
    queryFn: async () => {
      try { return await apiJson(`/live-classes/${sessionId}/recap`); }
      catch { return { published_body: null }; }
    },
  });

  const progressKey = `kanvise:recording-progress:${recordingQuery.data?.id || sessionId}`;
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const saved = Number(window.localStorage.getItem(progressKey) || 0);
    const restore = () => { video.currentTime = Math.max(saved, resumeAt.current); video.playbackRate = speed; };
    const save = () => window.localStorage.setItem(progressKey, String(Math.floor(video.currentTime)));
    video.addEventListener("loadedmetadata", restore, { once: true });
    video.addEventListener("timeupdate", save);
    return () => video.removeEventListener("timeupdate", save);
  }, [progressKey, recordingQuery.data?.playback_url, speed]);

  const refreshPlayback = async () => {
    resumeAt.current = videoRef.current?.currentTime || 0;
    await recordingQuery.refetch();
  };
  const download = async () => {
    const data = await apiJson(`/live-classes/${sessionId}/recording?download=1`);
    if (data?.playback_url) window.location.assign(data.playback_url);
  };

  if (sessionQuery.isPending || recordingQuery.isPending) {
    return <main className="animate-pulse"><div className="h-5 w-36 rounded bg-[#e8e4e0]" /><div className="mt-7 aspect-video max-w-5xl rounded-2xl bg-[#ddd8d4]" /></main>;
  }
  if (!sessionQuery.data || !recordingQuery.data?.playback_url) {
    return <main><Link href="/dashboard/student/classes" className="inline-flex items-center gap-2 text-sm font-semibold text-[#312783]"><ArrowLeft size={16}/>Back to classes</Link><section className="mt-6 rounded-2xl border border-[#e5e1dd] bg-white p-8 text-center"><Video className="mx-auto text-[#8b8490]"/><h1 className="mt-4 text-lg font-semibold text-[#180d62]">Recording unavailable</h1><p className="mt-2 text-sm text-[#716c76]">{recordingQuery.error instanceof Error ? recordingQuery.error.message : "This recording is not ready to watch."}</p><button onClick={() => void recordingQuery.refetch()} className="mt-5 rounded-lg bg-[#312783] px-4 py-2.5 text-sm font-semibold text-white">Try again</button></section></main>;
  }

  const session = sessionQuery.data;
  const subject = session.course?.name || session.courses?.name || "Class recording";
  const tutor = [session.tutor?.first_name, session.tutor?.last_name].filter(Boolean).join(" ");
  return <main className="w-full pb-20">
    <Link href="/dashboard/student/classes" className="inline-flex items-center gap-2 text-sm font-semibold text-[#625e69] hover:text-[#312783]"><ArrowLeft size={16}/>Back to classes</Link>
    <header className="mt-5">
      <p className="text-sm font-semibold text-[#994704]">{subject}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#180d62]">{session.title}</h1>
      <p className="mt-2 text-sm text-[#716c76]">{new Date(session.scheduled_at).toLocaleString("en-NG", { dateStyle: "long", timeStyle: "short" })}{tutor ? ` · ${tutor}` : ""}</p>
    </header>
    <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="min-w-0">
        <div className="overflow-hidden rounded-xl bg-black shadow-xl sm:rounded-2xl">
          <video ref={videoRef} controls playsInline preload="metadata" src={recordingQuery.data.playback_url} onError={() => void refreshPlayback()} className="aspect-video w-full bg-black object-contain">Your browser cannot play this recording.</video>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#d8d3d0] bg-white px-3 text-sm font-semibold text-[#474551]"><Gauge size={16}/>Speed<select value={speed} onChange={(event) => { const value = Number(event.target.value); setSpeed(value); if (videoRef.current) videoRef.current.playbackRate = value; }} className="bg-transparent outline-none">{[0.75, 1, 1.25, 1.5, 2].map((value) => <option key={value} value={value}>{value}×</option>)}</select></label>
          <button type="button" onClick={() => void download()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#312783] bg-white px-3 text-sm font-semibold text-[#312783]"><Download size={16}/>Download</button>
        </div>
      </section>
      <aside className="min-w-0 rounded-2xl border border-[#e5e1dd] bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-[#180d62]">Class summary</h2>
        {recapQuery.isPending ? <p className="mt-4 text-sm text-[#716c76]">Loading summary…</p> : recapQuery.data?.published_body ? <div className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#474551]">{recapQuery.data.published_body}</div> : <p className="mt-4 text-sm leading-6 text-[#716c76]">No published summary is available for this class.</p>}
      </aside>
    </div>
  </main>;
}
