import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CLASSROOM_ROOM_OPTIONS } from "@/components/classroom/livekit-room-options";
import ClientClassroom from "./ClientClassroom";

const liveKitRoom = vi.fn(({ children }: { children: React.ReactNode }) => <div>{children}</div>);

vi.mock("@livekit/components-react", () => ({
  LiveKitRoom: (props: { children: React.ReactNode }) => liveKitRoom(props),
  RoomAudioRenderer: () => <div data-testid="room-audio" />,
  useLocalParticipant: () => ({ localParticipant: null }),
}));

vi.mock("@/components/classroom/ClassroomLayout", () => ({
  default: () => <div data-testid="classroom-layout" />,
}));

describe("ClientClassroom", () => {
  beforeEach(() => {
    liveKitRoom.mockClear();
  });

  it("starts students muted with camera off and the bandwidth-optimized room options", () => {
    render(
      <ClientClassroom
        token="token"
        serverUrl="wss://livekit.example.com"
        roomName="room"
        classId="class"
        isHost={false}
        classTitle="Physics"
        courseName="Science"
      />,
    );

    expect(liveKitRoom).toHaveBeenCalledWith(expect.objectContaining({
      audio: false,
      video: false,
      connect: true,
      options: CLASSROOM_ROOM_OPTIONS,
    }));
  });

  it("starts tutors with audio on", () => {
    render(
      <ClientClassroom
        token="token"
        serverUrl="wss://livekit.example.com"
        roomName="room"
        classId="class"
        isHost={true}
        classTitle="Physics"
        courseName="Science"
      />,
    );

    expect(liveKitRoom).toHaveBeenCalledWith(expect.objectContaining({
      audio: true,
      video: false,
    }));
  });
});
