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
  children,
}: {
  issue: string | null
  onRetry: () => void
  children: React.ReactNode
}) {
  const connectionState = useConnectionState()

  if (issue) {
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

  if (connectionState !== ConnectionState.Connected) {
    return <main className="flex min-h-[100dvh] items-center justify-center bg-[#fbf9f8] px-5 font-sans">
      <section className="w-full max-w-md rounded-2xl border border-[#e5e1dd] bg-white p-7 text-center shadow-sm">
        <span className="material-symbols-outlined animate-spin text-3xl text-[#2e2877]" aria-hidden="true">progress_activity</span>
        <h1 className="mt-3 text-xl font-bold text-[#180d62]">Joining your classroom</h1>
        <p className="mt-2 text-sm leading-6 text-[#66616c]">Getting everything ready for your class…</p>
      </section>
    </main>
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
}: ClientClassroomProps) {
  const isLeavingClassroom = useRef(false);
  const hasConnected = useRef(false)
  const failureHandledForAttempt = useRef<number | null>(null)
  const retryTimer = useRef<number | null>(null)
  const [connectionIssue, setConnectionIssue] = useState<string | null>(null)
  const [connectionAttempt, setConnectionAttempt] = useState(0)
  const dashboardPath = isHost ? "/dashboard" : "/dashboard/student/classes";

  useEffect(() => () => {
    if (retryTimer.current) window.clearTimeout(retryTimer.current)
  }, [])

  const markLeavingClassroom = () => {
    isLeavingClassroom.current = true;
  }

  const retryConnection = () => {
    if (retryTimer.current) window.clearTimeout(retryTimer.current)
    retryTimer.current = null
    failureHandledForAttempt.current = null
    hasConnected.current = false
    setConnectionIssue(null)
    setConnectionAttempt((attempt) => attempt + 1)
  }

  const handleDisconnected = () => {
    if (isLeavingClassroom.current) {
      window.location.assign(dashboardPath)
      return
    }

    // The Azure VM can report healthy just before its WebSocket listener is
    // ready. Do one quiet, fresh connection attempt instead of falsely
    // blaming the student's network on their first visit.
    if (!hasConnected.current && failureHandledForAttempt.current !== connectionAttempt) {
      failureHandledForAttempt.current = connectionAttempt
      if (connectionAttempt === 0) {
        retryTimer.current = window.setTimeout(retryConnection, 1_200)
        return
      }
    }

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
        hasConnected.current = true
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
      <ClassroomConnectionGate issue={connectionIssue} onRetry={retryConnection}>
        {/* Main classroom UI only appears once the room connection succeeds. */}
        <ClassroomLayout
          isHost={isHost}
          classId={classId}
          classTitle={classTitle}
          courseName={courseName}
          onExit={markLeavingClassroom}
        />
      </ClassroomConnectionGate>
    </LiveKitRoom>
  );
}
