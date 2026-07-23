"use client";

import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { useRouter } from "next/navigation";
import ClassroomLayout from "@/components/classroom/ClassroomLayout";

interface ClientClassroomProps {
  token: string;
  serverUrl: string;
  roomName: string;
  classId: string;
  isHost: boolean;
  classTitle: string;
  courseName: string | null;
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
  const router = useRouter();

  return (
    <LiveKitRoom
      video={false}
      audio={true}
      token={token}
      serverUrl={serverUrl}
      connect={true}
      data-lk-theme="default"
      className="h-screen w-full flex flex-col bg-background text-foreground overflow-hidden"
      onDisconnected={() => router.push(isHost ? "/dashboard" : "/dashboard/student/classes")}
    >
      {/* Renders audio tracks of other participants */}
      <RoomAudioRenderer />

      {/* Main classroom UI */}
      <ClassroomLayout
        isHost={isHost}
        classId={classId}
        classTitle={classTitle}
        courseName={courseName}
      />
    </LiveKitRoom>
  );
}
