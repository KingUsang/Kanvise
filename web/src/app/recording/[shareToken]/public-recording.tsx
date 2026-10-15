"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Payload = {
  recording_id: string; playback_url: string;
  class: { title: string; scheduled_at: string; course?: { name?: string } | null; tutor?: { first_name?: string; last_name?: string } | null };
};

export default function PublicRecording({ shareToken }: { shareToken: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const resumeAt = useRef(0);
  const load = async () => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/live-classes/recordings/${shareToken}`, { cache: "no-store" });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error || "Could not open this recording.");
    setData(body.data);
  };
  useEffect(() => { void load().catch((cause) => setError(cause instanceof Error ? cause.message : "Could not open this recording.")); }, [shareToken]);
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !data) return;
    const restore = () => { if (resumeAt.current) video.currentTime = resumeAt.current; };
    video.addEventListener("loadedmetadata", restore, { once: true });
    return () => video.removeEventListener("loadedmetadata", restore);
  }, [data?.playback_url]);
  const refresh = async () => {
    resumeAt.current = videoRef.current?.currentTime || 0;
    try { await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not reopen this recording."); }
  };
  if (error) return <main className="grid min-h-[100dvh] place-items-center bg-[#fbf9f8] p-6"><section className="max-w-md text-center"><Image src="/kanvise_logo_small_blue.png" alt="Kanvise" width={48} height={48} className="mx-auto"/><h1 className="mt-6 text-xl font-semibold text-[#180d62]">Recording unavailable</h1><p className="mt-2 text-sm text-[#716c76]">{error}</p><button onClick={() => { setError(null); void refresh(); }} className="mt-5 rounded-lg bg-[#312783] px-4 py-2.5 text-sm font-semibold text-white">Try again</button></section></main>;
  if (!data) return <main className="grid min-h-[100dvh] place-items-center bg-[#fbf9f8]"><span className="h-7 w-7 animate-spin rounded-full border-2 border-[#d9d5e8] border-t-[#312783]" aria-label="Loading recording"/></main>;
  const tutor = [data.class.tutor?.first_name, data.class.tutor?.last_name].filter(Boolean).join(" ");
  return <main className="min-h-[100dvh] bg-[#fbf9f8] px-4 py-6 sm:px-8">
    <div className="mx-auto max-w-6xl">
      <Image src="/kanvise_logo_small_blue.png" alt="Kanvise" width={44} height={44}/>
      <header className="mt-6"><p className="text-sm font-semibold text-[#994704]">{data.class.course?.name || "Class recording"}</p><h1 className="mt-1 text-2xl font-semibold text-[#180d62]">{data.class.title}</h1><p className="mt-2 text-sm text-[#716c76]">{new Date(data.class.scheduled_at).toLocaleString("en-NG", { dateStyle: "long", timeStyle: "short" })}{tutor ? ` · ${tutor}` : ""}</p></header>
      <div className="mt-6 overflow-hidden rounded-xl bg-black shadow-xl sm:rounded-2xl"><video ref={videoRef} controls playsInline preload="metadata" src={data.playback_url} onError={() => void refresh()} className="aspect-video w-full bg-black object-contain">Your browser cannot play this recording.</video></div>
    </div>
  </main>;
}
