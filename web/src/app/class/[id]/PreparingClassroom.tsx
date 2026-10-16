"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import PlugNmeetClassroom from "./PlugNmeetClassroom";

type ClassroomToken = {
  provider?: "plugnmeet"; is_host: boolean; class_title: string;
  course_name: string | null; room_id?: string; join_token?: string;
  server_url?: string; share_url?: string | null;
  client_files?: { css_files: string[]; js_files: string[] };
};
type Phase = "connecting" | "waiting_for_host" | "recovering" | "offline";

export default function PreparingClassroom({ classId, classTitle, courseName }: {
  classId: string; classTitle: string; courseName: string | null;
}) {
  const [phase, setPhase] = useState<Phase>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState<ClassroomToken | null>(null);
  const [canTakeover, setCanTakeover] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const requestRef = useRef<Promise<ClassroomToken | null> | null>(null);
  const takeoverRef = useRef(false);
  const supabaseRef = useRef(createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  ));

  const enter = useCallback(async (signal: AbortSignal) => {
    if (requestRef.current) return requestRef.current;
    const request = (async () => {
      if (!navigator.onLine) { setPhase("offline"); return null; }
      const { data: { session } } = await supabaseRef.current.auth.getSession();
      if (!session) throw new Error("Your session has expired. Sign in again to continue.");
      const takeover = takeoverRef.current ? "?takeover=1" : "";
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/live-classes/${classId}/enter${takeover}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        cache: "no-store", signal,
      });
      const body = await response.json().catch(() => null);
      if (response.status === 202) {
        setPhase(body?.data?.state === "recovering" ? "recovering" : "connecting");
        return null;
      }
      if (response.status === 409 && body?.data?.state === "waiting_for_host") {
        setCanTakeover(Boolean(body?.data?.can_takeover));
        setPhase("waiting_for_host");
        return null;
      }
      if (!response.ok) throw new Error(body?.error || "We could not open the classroom.");
      return body.data as ClassroomToken;
    })().finally(() => { requestRef.current = null; });
    requestRef.current = request;
    return request;
  }, [classId]);

  useEffect(() => {
    const controller = new AbortController();
    let timeout: number | undefined;
    let stopped = false;
    setError(null);
    const attempt = async () => {
      if (stopped) return;
      try {
        const token = await enter(controller.signal);
        if (token) return setReady(token);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "We could not connect to the classroom.");
        return;
      }
      timeout = window.setTimeout(attempt, 4_000);
    };
    const onOnline = () => { setPhase("connecting"); setError(null); void attempt(); };
    const onOffline = () => setPhase("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    void attempt();
    return () => {
      stopped = true; controller.abort();
      if (timeout) window.clearTimeout(timeout);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [enter, retryKey]);

  const startAsAdministrator = () => {
    takeoverRef.current = true;
    setCanTakeover(false);
    setError(null);
    setPhase("connecting");
    setRetryKey((value) => value + 1);
  };

  if (ready?.provider === "plugnmeet" && ready.join_token && ready.server_url && ready.client_files) {
    return <PlugNmeetClassroom
      roomId={ready.room_id || classId} joinToken={ready.join_token}
      serverUrl={ready.server_url} clientFiles={ready.client_files}
      classId={classId} isHost={ready.is_host}
      classTitle={ready.class_title || classTitle}
      shareUrl={ready.share_url || undefined}
    />;
  }

  const status = phase === "offline" ? "You’re offline"
    : phase === "waiting_for_host" ? "Waiting for your tutor"
    : phase === "recovering" ? "Restoring the classroom"
    : "Connecting to class";

  return <main className="flex min-h-[100dvh] items-center justify-center bg-[#fbf9f8] px-6 font-sans">
    <section className="w-full max-w-sm text-center" aria-live="polite">
      <Image src="/kanvise_logo_small_blue.png" alt="Kanvise" width={48} height={48} className="mx-auto h-12 w-12 object-contain" priority />
      <h1 className="mt-6 text-xl font-semibold text-[#180d62]">{classTitle}</h1>
      {courseName ? <p className="mt-1 text-sm text-[#66616c]">{courseName}</p> : null}
      <div className="mt-8 flex items-center justify-center gap-3 text-sm font-medium text-[#474551]">
        {!error && phase !== "offline" ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#d9d5e8] border-t-[#312783]" aria-hidden="true" /> : null}
        <span>{error || status}</span>
      </div>
      {phase === "offline" ? <p className="mt-2 text-sm text-[#77727e]">We’ll reconnect when your connection returns.</p> : null}
      <div className="mt-8 flex justify-center gap-3">
        {canTakeover && phase === "waiting_for_host" ? <button type="button" onClick={startAsAdministrator} className="rounded-lg bg-[#312783] px-4 py-2.5 text-sm font-semibold text-white">Start as administrator</button> : null}
        {error ? <button type="button" onClick={() => { setError(null); setPhase("connecting"); setRetryKey((value) => value + 1); }} className="rounded-lg bg-[#312783] px-4 py-2.5 text-sm font-semibold text-white">Try again</button> : null}
        <Link href="/dashboard" className="rounded-lg border border-[#d8d3d0] px-4 py-2.5 text-sm font-semibold text-[#312783]">Back</Link>
      </div>
    </section>
  </main>;
}
