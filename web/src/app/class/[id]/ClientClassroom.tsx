"use client";

import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ClassroomLayout from "@/components/classroom/ClassroomLayout";

function ClassroomConnection({ roomId }: { roomId: string }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const router = useRouter();
  const username = searchParams.get("username") || "Student-" + Math.floor(Math.random() * 1000);
  const isHost = searchParams.get("isHost") === "true";

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(
          `/api/livekit/token?room=${roomId}&username=${username}&isHost=${isHost}`
        );
        const data = await resp.json();
        
        if (!resp.ok) {
          setError(data.error || "Failed to fetch token");
          return;
        }
        
        setToken(data.token);
      } catch (e: unknown) {
        setError((e as Error).message);
        console.error(e);
      }
    })();
  }, [roomId, username, isHost]);

  if (error) {
    // We will just log the error and allow the UI to render for development
    console.warn("LiveKit connection error:", error);
  }

  return (
    <LiveKitRoom
      video={false} // Audio-first MVP
      audio={true}
      token={token || "dummy-token"}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || "wss://dummy.livekit.cloud"}
      connect={!!token} // Only try connecting if we actually have a valid token
      data-lk-theme="default"
      className="h-screen w-full flex flex-col bg-background text-foreground overflow-hidden"
      onDisconnected={() => router.push("/")}
    >
      {/* Renders audio tracks of other participants */}
      <RoomAudioRenderer />
      
      {/* The main UI layout for the classroom */}
      <ClassroomLayout isHost={isHost} />
    </LiveKitRoom>
  );
}

export default function ClientClassroom({ roomId }: { roomId: string }) {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-background">Loading...</div>}>
      <ClassroomConnection roomId={roomId} />
    </Suspense>
  );
}
