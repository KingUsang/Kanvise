"use client";

import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { useRef } from "react";
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
  const isLeavingClassroom = useRef(false);
  const dashboardPath = isHost ? "/dashboard" : "/dashboard/student/classes";

  const leaveClassroom = () => {
    if (isLeavingClassroom.current) return;
    isLeavingClassroom.current = true;
    // LiveKit disconnects after the room closes. A document navigation ensures
    // the dashboard shell is rebuilt instead of retaining the classroom's
    // client-side navigation state.
    window.location.assign(dashboardPath);
  };

  return (
    <LiveKitRoom
      video={false}
      audio={true}
      token={token}
      serverUrl={serverUrl}
      connect={true}
      data-lk-theme="default"
      className="h-screen w-full flex flex-col bg-background text-foreground overflow-hidden"
      onDisconnected={leaveClassroom}
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
