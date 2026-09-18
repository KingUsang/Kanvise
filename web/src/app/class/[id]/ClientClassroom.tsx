"use client";

import { LiveKitRoom, RoomAudioRenderer, useConnectionState, useLocalParticipant } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ClassroomLayout from "@/components/classroom/ClassroomLayout";
import { CLASSROOM_ROOM_OPTIONS } from "@/components/classroom/livekit-room-options";
import { markInstallEligible } from "@/lib/pwa/install-eligibility";

interface ClientClassroomProps {
  token: string;
  serverUrl: string;
  roomName: string;
  classId: string;
  isHost: boolean;
  classTitle: string;
  courseName: string | null;
  guestShareToken?: string;
  onLeave?: () => void;
}

function MuteStudentOnJoin({ isHost }: { isHost: boolean }) {
  const { localParticipant } = useLocalParticipant();
  const hasAppliedInitialMute = useRef(false);

  useEffect(() => {
    if (isHost || !localParticipant || hasAppliedInitialMute.current) return;
    hasAppliedInitialMute.current = true;
    // LiveKitRoom's audio={false} is the intended initial setting. Apply an
    // explicit post-connect mute as well because browsers may restore a local
    // input device during reconnects.
    void localParticipant.setMicrophoneEnabled(false).catch(() => undefined);
  }, [isHost, localParticipant]);

  return null;
}

function ClassroomConnectionGate({
  issue,
  onRetry,
  hasEverConnected,
  offline,
  children,
}: {
  issue: string | null
  onRetry: () => void
  hasEverConnected: boolean
  offline: boolean
  children: React.ReactNode
}) {
  const connectionState = useConnectionState()

  // Once the room has connected, keep the classroom mounted while LiveKit
  // reconnects. Replacing the whole classroom with a join/error page loses
  // the tutor's context and falsely reports a healthy network as offline.
  if (offline && !hasEverConnected) {
    return <main className="flex min-h-[100dvh] items-center justify-center bg-[#fbf9f8] px-5 font-sans"><section className="w-full max-w-md rounded-2xl border border-[#e5e1dd] bg-white p-7 text-center shadow-sm"><span className="material-symbols-outlined text-3xl text-[#994704]" aria-hidden="true">wifi_off</span><h1 className="mt-3 text-xl font-bold text-[#180d62]">You&apos;re offline</h1><p className="mt-2 text-sm leading-6 text-[#66616c]">We&apos;ll reconnect automatically when your connection returns.</p><div className="mt-6 flex justify-center gap-3"><button type="button" onClick={onRetry} className="rounded-lg bg-[#2e2877] px-4 py-2 text-sm font-semibold text-white">Try again</button><Link href="/dashboard/schedule" className="rounded-lg border border-[#c8c5d2] px-4 py-2 text-sm font-semibold text-[#2e2877]">Back to classes</Link></div></section></main>
  }

  if (issue && !hasEverConnected) {
    return <main className="flex min-h-[100dvh] items-center justify-center bg-[#fbf9f8] px-5 font-sans">
      <section className="w-full max-w-md rounded-2xl border border-[#e5e1dd] bg-white p-7 text-center shadow-sm">
        <span className="material-symbols-outlined text-3xl text-[#994704]" aria-hidden="true">wifi_off</span>
        <h1 className="mt-3 text-xl font-bold text-[#180d62]">We couldn&apos;t join the classroom</h1>
        <p className="mt-2 text-sm leading-6 text-[#66616c]">{issue}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={onRetry} className="rounded-lg bg-[#2e2877] px-4 py-2 text-sm font-semibold text-white">Try again</button>
          <Link href="/dashboard/schedule" className="rounded-lg border border-[#c8c5d2] px-4 py-2 text-sm font-semibold text-[#2e2877]">Back to classes</Link>
        </div>
      </section>
    </main>
  }

  if (!hasEverConnected && connectionState !== ConnectionState.Connected) {
    return <main className="flex min-h-[100dvh] items-center justify-center bg-[#fbf9f8] px-5 font-sans">
      <section className="w-full max-w-md rounded-2xl border border-[#e5e1dd] bg-white p-7 text-center shadow-sm">
        <span className="material-symbols-outlined animate-spin text-3xl text-[#2e2877]" aria-hidden="true">progress_activity</span>
        <h1 className="mt-3 text-xl font-bold text-[#180d62]">Joining your classroom</h1>
        <p className="mt-2 text-sm leading-6 text-[#66616c]">Getting everything ready for your class…</p>
      </section>
    </main>
  }

  if (hasEverConnected && (offline || connectionState === ConnectionState.Reconnecting)) {
    return <><>{children}</><div className="pointer-events-none fixed left-1/2 top-16 z-[60] -translate-x-1/2 rounded-full bg-[#292a2d]/95 px-4 py-2 text-xs font-semibold text-white shadow-lg" role="status">Connection interrupted. Reconnecting…</div></>
  }

  return <>{children}</>
}

export default function ClientClassroom({
  token,
  serverUrl,
  roomName,
  classId,
  isHost,
  classTitle,
  courseName,
  guestShareToken,
  onLeave,
}: ClientClassroomProps) {
  const isLeavingClassroom = useRef(false);
  const [hasConnected, setHasConnected] = useState(false)
  const failureHandledForAttempt = useRef<number | null>(null)
  const retryTimer = useRef<number | null>(null)
  const [connectionIssue, setConnectionIssue] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [connectionAttempt, setConnectionAttempt] = useState(0)
  const dashboardPath = isHost ? "/dashboard" : guestShareToken ? "/" : "/dashboard/student/classes";

  useEffect(() => () => {
    if (retryTimer.current) window.clearTimeout(retryTimer.current)
  }, [])

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])

  const markLeavingClassroom = () => {
    isLeavingClassroom.current = true;
  }

  const retryConnection = () => {
    if (retryTimer.current) window.clearTimeout(retryTimer.current)
    retryTimer.current = null
    failureHandledForAttempt.current = null
    setHasConnected(false)
    setConnectionIssue(null)
    setConnectionAttempt((attempt) => attempt + 1)
  }

  const handleDisconnected = () => {
    if (isLeavingClassroom.current) {
      if (onLeave) {
        onLeave()
      } else {
        window.location.assign(dashboardPath)
      }
      return
    }

    // The Azure VM can report healthy just before its WebSocket listener is
    // ready. Do one quiet, fresh connection attempt instead of falsely
    // blaming the student's network on their first visit.
    if (!hasConnected && failureHandledForAttempt.current !== connectionAttempt) {
      failureHandledForAttempt.current = connectionAttempt
      if (connectionAttempt === 0) {
        retryTimer.current = window.setTimeout(retryConnection, 1_200)
        return
      }
    }

    // A connected room can briefly enter Reconnecting/Disconnected while the
    // SDK recovers. Keep the classroom mounted; the header reflects the
    // transient state and LiveKit will restore the tracks when ready.
    if (hasConnected) return
    setConnectionIssue('Check your connection, then try joining the class again.')
  };

  return (
    <LiveKitRoom
      key={connectionAttempt}
      video={false}
      audio={isHost}
      token={token}
      serverUrl={serverUrl}
      connect={true}
      options={CLASSROOM_ROOM_OPTIONS}
      data-lk-theme="default"
      className="h-screen h-dvh w-full flex flex-col bg-background text-foreground overflow-hidden"
      onConnected={() => {
        setHasConnected(true)
        failureHandledForAttempt.current = null
        setConnectionIssue(null)
        markInstallEligible()
      }}
      onDisconnected={handleDisconnected}
      onError={handleDisconnected}
    >
      <MuteStudentOnJoin isHost={isHost} />
      {/* Renders audio tracks of other participants */}
      <RoomAudioRenderer />
      <ClassroomConnectionGate issue={connectionIssue} onRetry={retryConnection} hasEverConnected={hasConnected} offline={offline}>
        {/* Main classroom UI only appears once the room connection succeeds. */}
        <ClassroomLayout
          isHost={isHost}
          classId={classId}
          classTitle={classTitle}
          courseName={courseName}
          guestShareToken={guestShareToken}
          onExit={markLeavingClassroom}
        />
      </ClassroomConnectionGate>
    </LiveKitRoom>
  );
}
