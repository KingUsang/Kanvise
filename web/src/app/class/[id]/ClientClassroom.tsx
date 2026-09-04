"use client";

import { LiveKitRoom, RoomAudioRenderer, useLocalParticipant } from "@livekit/components-react";
import { useEffect, useRef } from "react";
import ClassroomLayout from "@/components/classroom/ClassroomLayout";
import { CLASSROOM_ROOM_OPTIONS } from "@/components/classroom/livekit-room-options";

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
      audio={isHost}
      token={token}
      serverUrl={serverUrl}
      connect={true}
      options={CLASSROOM_ROOM_OPTIONS}
      data-lk-theme="default"
      className="h-screen h-dvh w-full flex flex-col bg-background text-foreground overflow-hidden"
      onDisconnected={leaveClassroom}
    >
      <MuteStudentOnJoin isHost={isHost} />
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
