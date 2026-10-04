"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import PlugNmeetClassroom from "./PlugNmeetClassroom";
import DemoKnowledgeCheck from "./DemoKnowledgeCheck";

type ClassroomToken = {
  provider?: "plugnmeet";
  is_host: boolean;
  class_title: string;
  course_name: string | null;
  room_id?: string;
  join_token?: string;
  server_url?: string;
  client_files?: { css_files: string[]; js_files: string[] };
};

type Phase =
  | "classroom_waking"
  | "classroom_healthy"
  | "recorder_waking"
  | "room_ready"
  | "unavailable";

const WAITING_LINES = [
  "Your whiteboard, chat and student space are being prepared.",
  "Have your first talking point ready — we will open the room automatically.",
  "Your session is safe. There is nothing else you need to do here.",
];

function waitingMessage(phase: Phase, elapsedSeconds: number) {
  if (phase === "room_ready") return "Your classroom is ready. Opening it now…";
  if (phase === "classroom_healthy" || phase === "recorder_waking")
    return "Putting the finishing touches on your live room…";
  if (elapsedSeconds < 8) return "Creating your live teaching space…";
  if (elapsedSeconds < 25) return "Getting your room ready for students…";
  if (elapsedSeconds < 55)
    return "This is taking a little longer than usual. We are still getting everything ready.";
  return "Still preparing your room. You can stay here — we will take you in automatically.";
}

export default function PreparingClassroom({
  classId,
  isStarting,
  classTitle,
  courseName,
  isHost,
  studentName,
  studentId,
}: {
  classId: string;
  isStarting: boolean;
  classTitle: string;
  courseName: string | null;
  isHost: boolean;
  studentName?: string;
  studentId?: string;
}) {
  const [phase, setPhase] = useState<Phase>("classroom_waking");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState<ClassroomToken | null>(null);
  const [offline, setOffline] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const tokenRequestRef = useRef<Promise<ClassroomToken | null> | null>(null);

  // Keep a stable supabase client across re-renders
  const supabaseRef = useRef(
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    ),
  );

  const fetchToken = useCallback(
    async (signal: AbortSignal) => {
      const {
        data: { session },
      } = await supabaseRef.current.auth.getSession();
      if (!session)
        throw new Error("Your session has expired. Sign in again to continue.");

      const base = `${process.env.NEXT_PUBLIC_API_URL}/live-classes/${classId}`;
      const endpoint = isStarting ? "start" : "join";
      const res = await fetch(`${base}/${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
        signal,
      });
      const body = await res.json().catch(() => null);
      if (res.status === 202 && body?.data?.state === "preparing") return null;
      if (!res.ok)
        throw new Error(body?.error || "We could not open the classroom.");
      return body.data as ClassroomToken;
    },
    [classId, isStarting],
  );

  const requestToken = useCallback(
    (signal: AbortSignal) => {
      if (tokenRequestRef.current) return tokenRequestRef.current;

      const request = fetchToken(signal).finally(() => {
        if (tokenRequestRef.current === request) tokenRequestRef.current = null;
      });
      tokenRequestRef.current = request;
      return request;
    },
    [fetchToken],
  );

  useEffect(() => {
    setPhase("classroom_waking");
    setError(null);
    setOffline(!navigator.onLine);
    setElapsedSeconds(0);

    const controller = new AbortController();
    const { signal } = controller;

    const run = async () => {
      try {
        const {
          data: { session },
        } = await supabaseRef.current.auth.getSession();
        if (!session) {
          setError("Your session has expired. Please sign in again.");
          return;
        }

        const intent = isStarting ? "?intent=start" : "";
        const base = `${process.env.NEXT_PUBLIC_API_URL}/live-classes/${classId}`;

        // Open a single long-lived fetch connection for SSE
        const res = await fetch(`${base}/readiness/stream${intent}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
          signal,
        });

        if (!res.ok || !res.body) {
          setError("Could not connect to the classroom. Please try again.");
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE events are separated by double newlines
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data:")) continue;
            try {
              const event = JSON.parse(line.slice(5).trim()) as {
                phase: Phase;
                message?: string;
              };
              if (signal.aborted) return;

              if (event.phase === "unavailable") {
                setError(
                  event.message ?? "The classroom is temporarily unavailable.",
                );
                return;
              }

              setPhase(event.phase);

              if (event.phase === "room_ready") {
                // The room can be created as soon as PlugNmeet is healthy.
                // Recording may finish its per-class handshake just after
                // that. A 202 must therefore retry instead of closing the SSE
                // path and leaving the page permanently on "Opening".
                while (!signal.aborted) {
                  const token = await requestToken(signal);
                  if (token) {
                    setReady(token);
                    return;
                  }
                  setPhase("recorder_waking");
                  await new Promise<void>((resolve) => {
                    const timeout = window.setTimeout(resolve, 2_000);
                    signal.addEventListener("abort", () => {
                      window.clearTimeout(timeout);
                      resolve();
                    }, { once: true });
                  });
                }
                return;
              }
            } catch {
              /* malformed event — skip */
            }
          }
        }
      } catch (cause) {
        if (
          signal.aborted ||
          (cause instanceof DOMException && cause.name === "AbortError")
        )
          return;
        setOffline(!navigator.onLine);
        setError(
          cause instanceof Error
            ? cause.message
            : "We could not connect to the classroom.",
        );
      }
    };

    run();
    return () => controller.abort();
  }, [classId, isStarting, requestToken, retryKey]);

  // Some reverse proxies buffer SSE response chunks. Keep the readiness
  // stream for immediate status updates, but independently attempt the
  // idempotent start/join handoff so a buffered stream cannot strand the
  // tutor on this screen.
  useEffect(() => {
    if (ready || error) return;

    const controller = new AbortController();
    let stopped = false;
    let timeout: number | undefined;

    const poll = async () => {
      if (stopped) return;

      try {
        const token = await requestToken(controller.signal);
        if (token) {
          setReady(token);
          return;
        }
        setPhase("recorder_waking");
      } catch (cause) {
        if (
          controller.signal.aborted ||
          (cause instanceof DOMException && cause.name === "AbortError")
        )
          return;
        // The readiness stream remains authoritative for fatal errors. A
        // transient start/join failure is retried while the classroom boots.
      }

      timeout = window.setTimeout(poll, 4_000);
    };

    timeout = window.setTimeout(poll, 1_500);
    return () => {
      stopped = true;
      controller.abort();
      if (timeout) window.clearTimeout(timeout);
    };
  }, [error, ready, requestToken, retryKey]);

  useEffect(() => {
    if (ready || error) return;
    const interval = window.setInterval(
      () => setElapsedSeconds((seconds) => seconds + 1),
      1000,
    );
    return () => window.clearInterval(interval);
  }, [error, ready]);

  // Handoff to the live classroom
  if (ready) {
    if (
      ready.provider === "plugnmeet" &&
      ready.join_token &&
      ready.server_url &&
      ready.client_files
    ) {
      return (<>
        <DemoKnowledgeCheck classId={classId} isHost={ready.is_host} studentName={studentName} studentId={studentId} />
        <PlugNmeetClassroom
          roomId={ready.room_id || classId}
          joinToken={ready.join_token}
          serverUrl={ready.server_url}
          clientFiles={ready.client_files}
          classId={classId}
          isHost={ready.is_host}
          classTitle={ready.class_title || classTitle}
        />
      </>);
    }
    return null;
  }

  const statusMessage = waitingMessage(phase, elapsedSeconds);
  const rotatingLine =
    WAITING_LINES[Math.floor(elapsedSeconds / 6) % WAITING_LINES.length];

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-[#fbf9f8] px-5 font-sans">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eeeaff] px-3 py-1 text-xs font-semibold text-[#2e2877]">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#746bc7] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#2e2877]" />
            </span>
            OPENING LIVE CLASS
          </span>
          <h1 className="mt-3 text-2xl font-bold leading-tight text-[#180d62]">
            {classTitle}
          </h1>
          {courseName ? (
            <p className="mt-1 text-sm text-[#66616c]">{courseName}</p>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#e5e1dd] bg-white shadow-sm">
          {error ? (
            <div className="p-6">
              <div className="flex items-start gap-3 rounded-xl bg-[#fff3e8] p-4">
                <span className="material-symbols-outlined mt-0.5 text-[1.1rem] text-[#b45309]">
                  warning
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#7c3d0e]">
                    {error}
                  </p>
                  <p className="mt-1 text-xs text-[#92400e]">
                    Your class is still scheduled and safe. Try rejoining below.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setPhase("classroom_waking");
                    setRetryKey((k) => k + 1);
                  }}
                  className="rounded-xl bg-[#180d62] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2e2877] active:scale-95 transition-all"
                >
                  Try again
                </button>
                <Link
                  href="/dashboard/schedule"
                  className="rounded-xl border border-[#c8c5d2] px-5 py-2.5 text-sm font-semibold text-[#2e2877] hover:bg-[#f5f4f8] transition-colors"
                >
                  Back to classes
                </Link>
              </div>
            </div>
          ) : (
            <div aria-live="polite" className="p-6">
              <div className="relative overflow-hidden rounded-2xl border border-[#e4dffc] bg-[#f8f7ff] p-5">
                <div className="absolute -right-9 -top-9 h-28 w-28 rounded-full bg-[#e3dfff] opacity-70" />
                <div className="absolute -bottom-12 left-10 h-24 w-24 rounded-full bg-[#ffe8d4] opacity-70" />
                <div className="relative flex min-h-32 items-center justify-center">
                  <div className="relative flex h-20 w-28 items-center justify-center rounded-xl border border-[#cfc8f7] bg-white shadow-sm">
                    <span className="absolute left-3 top-3 h-2 w-7 rounded-full bg-[#e7e4ff]" />
                    <span className="absolute left-3 top-8 h-2 w-12 rounded-full bg-[#f1efff]" />
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2e2877] text-white">
                      <span className="material-symbols-outlined text-xl">
                        cast
                      </span>
                    </span>
                    <span className="absolute -right-3 bottom-3 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#c26627] text-white">
                      <span className="material-symbols-outlined text-base">
                        groups
                      </span>
                    </span>
                  </div>
                </div>
              </div>
              <h2 className="mt-6 text-xl font-bold text-[#180d62]">
                Getting your class ready
              </h2>
              <p className="mt-2 min-h-12 text-sm leading-6 text-[#5f5964]">
                {statusMessage}
              </p>
              {offline && (
                <div className="mb-4 flex items-center gap-2 rounded-xl bg-[#fff3e8] px-4 py-3 text-xs font-medium text-[#7a3903]">
                  <span className="material-symbols-outlined text-[0.9rem]">
                    wifi_off
                  </span>
                  You&apos;re offline. Reconnecting automatically…
                </div>
              )}
              <div className="mt-5 rounded-xl border border-[#eeeae6] bg-[#fcfbff] px-4 py-3">
                <p className="text-xs font-semibold text-[#2e2877]">
                  While you wait
                </p>
                <p className="mt-1 text-xs leading-5 text-[#625e69]">
                  {rotatingLine}
                </p>
              </div>
              <p className="mt-5 text-xs leading-5 text-[#8b8580]">
                {isHost
                  ? "Keep this page open. Your students can join as soon as the classroom opens."
                  : "Your tutor is setting up the room. We will take you in automatically."}
              </p>
            </div>
          )}
        </div>

        {!error && (
          <p className="mt-4 text-center text-xs leading-5 text-[#8b8580]">
            First live class today? It can take a little longer to prepare.
          </p>
        )}
      </div>
    </main>
  );
}
