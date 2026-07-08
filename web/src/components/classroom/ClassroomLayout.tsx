"use client";

import {
  useConnectionState,
  useRoomContext,
  DisconnectButton,
  useParticipants,
  useTracks,
  VideoTrack,
  TrackToggle,
  useLocalParticipant,
} from "@livekit/components-react";
import { ConnectionState, Track, RoomEvent, Participant } from "livekit-client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import AudioVideoControls from "./AudioVideoControls";
import ScreenShare from "./ScreenShare";
import ChatBox from "./ChatBox";
import VideoPiP from "./VideoPiP";
import ParticipantsPanel from "./ParticipantsPanel";
import CollaborativeWhiteboard from "./CollaborativeWhiteboard";
import {
  Hand,
  MessageSquare,
  Users,
  MonitorPlay,
  PenLine,
  LogOut,
  Clock,
  X,
  ZoomIn,
  ZoomOut,
  Maximize,
} from "lucide-react";

export default function ClassroomLayout({ isHost, classId }: { isHost: boolean; classId: string }) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const participants = useParticipants();
  const screenShareTracks = useTracks([Track.Source.ScreenShare]);
  const { localParticipant } = useLocalParticipant();
  
  const [openSidebar, setOpenSidebar] = useState<"chat" | "participants" | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  const handleEndClass = async () => {
    setIsEnding(true);
    try {
      const honoUrl = process.env.NEXT_PUBLIC_HONO_API_URL || 'http://localhost:3001';
      // The browser must send its own JWT — retrieve from Supabase client-side
      const { createBrowserClient } = await import('@supabase/ssr');
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${honoUrl}/live-classes/${classId}/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      room.disconnect();
    } catch (e) {
      console.error('Failed to end class', e);
      toast.error('Failed to end class');
    } finally {
      setIsEnding(false);
    }
  };

  const handleLeaveBtnClick = () => {
    if (isHost) {
      setShowLeaveModal(true);
    } else {
      room.disconnect();
    }
  };

  const isConnected = connectionState === ConnectionState.Connected;
  const isHandRaised = !!localParticipant?.attributes?.handRaised;

  const toggleHandRaise = () => {
    if (!localParticipant) return;
    localParticipant.setAttributes({ handRaised: isHandRaised ? "" : Date.now().toString() });
  };

  const isTutorPresent = isHost || participants.some((p) => {
    try {
      return JSON.parse(p.metadata || "{}").isHost === true;
    } catch (e) {
      return false;
    }
  });

  // Room Events for Notifications
  useEffect(() => {
    if (!room) return;

    const handleParticipantConnected = (participant: Participant) => {
      // Only host sees join/leave, and only if room has < 15 people
      const participantCount = (room.remoteParticipants?.size || 0) + 1;
      if (isHost && participantCount < 15) {
        toast.success(`${participant.name || participant.identity} joined`);
      }
    };

    const handleParticipantDisconnected = (participant: Participant) => {
      const participantCount = (room.remoteParticipants?.size || 0) + 1;
      if (isHost && participantCount < 15) {
        toast(`${participant.name || participant.identity} left`);
      }
    };

    const handleAttributesChanged = (changed: Record<string, string>, participant: Participant) => {
      if (isHost && changed.handRaised && changed.handRaised !== "0" && changed.handRaised !== "") {
        toast.info(`${participant.name || participant.identity} raised their hand!`);
      }
    };

    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    room.on(RoomEvent.ParticipantAttributesChanged, handleAttributesChanged);

    return () => {
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      room.off(RoomEvent.ParticipantAttributesChanged, handleAttributesChanged);
    };
  }, [room, isHost]);



  // Timer
  useEffect(() => {
    const t = setInterval(() => setElapsedTime((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, "0");
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${h}:${m}:${sec}`;
  };

  const toggleSidebar = (panel: "chat" | "participants") => {
    setOpenSidebar((prev) => (prev === panel ? null : panel));
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-[#fbf9f8] font-['Plus_Jakarta_Sans',sans-serif]">
      {/* ── TOP BAR (Solid, Pinned) ─────── */}
      <header className="flex-shrink-0 h-16 bg-white border-b border-[#e4e2e1] flex items-center justify-between px-4 md:px-6 z-20">
        {/* Left: session info */}
        <div className="flex items-center gap-4 flex-1">
          <div className="w-10 h-10 rounded-lg bg-[#2e2877] flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-lg">K</span>
          </div>
          <div className="hidden sm:block">
            <h1 className="text-[#180d62] font-bold text-[15px] leading-tight">{room.name || "Kanvise Live Class"}</h1>
            <p className="text-[#787582] text-[11px] font-medium uppercase tracking-wider flex items-center gap-2 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-yellow-500"}`} />
              {isConnected ? "Live" : "Connecting"} · {room.metadata || "Mathematics · SS3"}
            </p>
          </div>
        </div>



        {/* Right: timer + role + leave */}
        <div className="flex items-center gap-4 flex-1 justify-end">
          <span className={`hidden lg:inline text-[11px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded
            ${isHost ? "bg-[#994704] text-white" : "bg-[#2e2877]/10 text-[#2e2877]"}`}>
            {isHost ? "Tutor" : "Student"}
          </span>

          <div className="hidden sm:flex items-center gap-1.5 text-[#787582] text-[13px] border-l border-[#e4e2e1] pl-4">
            <Clock size={14} />
            <span className="font-semibold">{formatTime(elapsedTime)}</span>
          </div>
          
          <button
            onClick={handleLeaveBtnClick}
            className="flex items-center gap-1.5 bg-[#ba1a1a]/10 hover:bg-[#ba1a1a]/20 text-[#ba1a1a] px-4 py-2 rounded-lg text-[13px] font-bold transition-all ml-2"
          >
            <LogOut size={15} />
            <span className="hidden md:inline">Leave</span>
          </button>
        </div>
      </header>

      {/* ── MAIN BODY ─────────── */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Canvas Area */}
        <div className="flex-1 flex flex-col bg-[#f5f3f2] relative">
          <div className="flex-1 relative bg-black">
            <VideoPiP />
            
            <div className={`absolute inset-0 ${screenShareTracks.length > 0 ? "hidden pointer-events-none" : "block"}`}>
              <CollaborativeWhiteboard />
            </div>

            {screenShareTracks.length > 0 && (
              <div className="absolute inset-0 z-20 bg-black overflow-hidden group">
                <TransformWrapper
                  initialScale={1}
                  minScale={1}
                  maxScale={8}
                  centerOnInit
                  wheel={{ step: 0.1 }}
                >
                  {({ zoomIn, zoomOut, resetTransform }) => (
                    <>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full flex items-center justify-center">
                          <VideoTrack 
                            trackRef={screenShareTracks[0]} 
                            className="w-full h-full object-contain" 
                          />
                        </TransformComponent>
                      </div>
                      
                      {/* Zoom Controls Overlay */}
                      <div className="absolute bottom-6 right-6 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30">
                        <button 
                          onClick={() => zoomIn()}
                          className="w-10 h-10 rounded-xl bg-[#180d62]/90 backdrop-blur text-white flex items-center justify-center hover:bg-[#180d62] shadow-lg transition-colors"
                          title="Zoom In"
                        >
                          <ZoomIn size={18} />
                        </button>
                        <button 
                          onClick={() => zoomOut()}
                          className="w-10 h-10 rounded-xl bg-[#180d62]/90 backdrop-blur text-white flex items-center justify-center hover:bg-[#180d62] shadow-lg transition-colors"
                          title="Zoom Out"
                        >
                          <ZoomOut size={18} />
                        </button>
                        <button 
                          onClick={() => resetTransform()}
                          className="w-10 h-10 rounded-xl bg-[#180d62]/90 backdrop-blur text-white flex items-center justify-center hover:bg-[#180d62] shadow-lg transition-colors mt-2"
                          title="Reset Zoom"
                        >
                          <Maximize size={18} />
                        </button>
                      </div>
                    </>
                  )}
                </TransformWrapper>
              </div>
            )}

            {!isTutorPresent && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center backdrop-blur-md bg-black/40">
                <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center text-center max-w-sm mx-4">
                  <div className="w-16 h-16 rounded-full bg-[#f5f3f2] flex items-center justify-center mb-4">
                    <Clock className="text-[#180d62]" size={32} />
                  </div>
                  <h2 className="text-xl font-bold text-[#180d62] mb-2">Waiting for Tutor</h2>
                  <p className="text-[#787582] text-[13px] leading-relaxed">
                    The tutor has disconnected or hasn't joined the class yet. Please wait, they should return shortly.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── SIDEBAR PANEL (Pushes content, always mounted to preserve state) ────── */}
        <div className={`flex-shrink-0 flex flex-col bg-white z-20 transition-all duration-300 overflow-hidden
          ${openSidebar ? "w-[320px] border-l border-[#e4e2e1]" : "w-0 border-none"}`}
        >
          {/* Panel Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#e4e2e1] bg-[#fbf9f8] min-w-[320px]">
            <div className="flex gap-1 bg-[#f5f3f2] p-1 rounded-lg border border-[#e4e2e1]">
              <button
                onClick={() => setOpenSidebar("chat")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold transition-all
                  ${openSidebar === "chat" ? "bg-white text-[#180d62] shadow-sm" : "text-[#787582] hover:text-[#180d62]"}`}
              >
                <MessageSquare size={13} />
                Chat
              </button>
              <button
                onClick={() => setOpenSidebar("participants")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold transition-all
                  ${openSidebar === "participants" ? "bg-white text-[#180d62] shadow-sm" : "text-[#787582] hover:text-[#180d62]"}`}
              >
                <Users size={13} />
                People ({participants.length})
              </button>
            </div>
            <button
              onClick={() => setOpenSidebar(null)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#787582] hover:bg-[#f5f3f2] hover:text-[#180d62] transition-all"
            >
              <X size={16} />
            </button>
          </div>

          {/* Panel Body */}
          <div className="flex-1 overflow-hidden relative min-w-[320px]">
            <div className={`absolute inset-0 transition-opacity duration-200 ${openSidebar === "chat" ? "opacity-100 z-10" : "opacity-0 pointer-events-none z-0"}`}>
              <ChatBox />
            </div>
            
            <div className={`absolute inset-0 transition-opacity duration-200 ${openSidebar === "participants" ? "opacity-100 z-10" : "opacity-0 pointer-events-none z-0"}`}>
              <ParticipantsPanel isHost={isHost} classId={classId} />
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM TOOLBAR (Solid, Pinned) ─────────── */}
      <footer className="flex-shrink-0 h-[80px] bg-white border-t border-[#e4e2e1] flex items-center justify-between px-4 md:px-6 shadow-[0_-4px_20px_rgba(24,13,98,0.03)] z-20">
        {/* Left: Participant count */}
        <div className="flex items-center gap-3 flex-1">
          <div className="flex items-center gap-1.5 text-[#787582] text-[13px] font-medium bg-[#f5f3f2] px-3 py-2 rounded-lg border border-[#e4e2e1]">
            <Users size={15} />
            <span className="hidden sm:inline">{participants.length} Participants</span>
            <span className="sm:hidden">{participants.length}</span>
          </div>
        </div>

        {/* Centre: Media Controls */}
        <div className="flex items-center gap-3">
          <AudioVideoControls />
          
          {isHost && (
            <button
              onClick={async () => {
                if (localParticipant) {
                  const isSharing = screenShareTracks.length > 0;
                  await localParticipant.setScreenShareEnabled(!isSharing);
                }
              }}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-semibold transition-all border
                ${screenShareTracks.length > 0
                  ? "bg-[#994704] text-white border-[#994704] shadow-md"
                  : "bg-[#f5f3f2] hover:bg-[#e4e2e1] text-[#180d62] border-[#e4e2e1]"
                }`}
            >
              <MonitorPlay size={16} />
              <span className="hidden md:inline">{screenShareTracks.length > 0 ? "Stop Share" : "Share Screen"}</span>
            </button>
          )}

          {!isHost && (
            <button
              onClick={toggleHandRaise}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-semibold transition-all border
                ${isHandRaised
                  ? "bg-[#994704] text-white border-[#994704] shadow-md"
                  : "bg-[#f5f3f2] hover:bg-[#e4e2e1] text-[#180d62] border-[#e4e2e1]"
                }`}
            >
              <Hand size={16} />
              <span className="hidden md:inline">{isHandRaised ? "Lower Hand" : "Raise Hand"}</span>
            </button>
          )}
        </div>

        {/* Right: Sidebar Toggles */}
        <div className="flex items-center gap-2 flex-1 justify-end">
          <button
            onClick={() => toggleSidebar("chat")}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-[13px] font-semibold transition-all border
              ${openSidebar === "chat"
                ? "bg-[#180d62] text-white border-[#180d62]"
                : "bg-white hover:bg-[#f5f3f2] text-[#787582] hover:text-[#180d62] border-[#e4e2e1]"
              }`}
          >
            <MessageSquare size={16} />
            <span className="hidden sm:inline">Chat</span>
          </button>
          <button
            onClick={() => toggleSidebar("participants")}
            className={`relative flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-[13px] font-semibold transition-all border
              ${openSidebar === "participants"
                ? "bg-[#180d62] text-white border-[#180d62]"
                : "bg-white hover:bg-[#f5f3f2] text-[#787582] hover:text-[#180d62] border-[#e4e2e1]"
              }`}
          >
            <Users size={16} />
            <span className="hidden sm:inline">People</span>
            {participants.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-[#994704] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white">
                {participants.length}
              </span>
            )}
          </button>
        </div>
      </footer>

      {/* ── LEAVE MODAL ─────────── */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#ba1a1a]/10 flex items-center justify-center mb-4 text-[#ba1a1a]">
              <LogOut size={24} />
            </div>
            <h2 className="text-xl font-bold text-[#180d62] mb-2">Leave Classroom</h2>
            <p className="text-[#787582] text-[13px] mb-6">
              Do you want to just leave temporarily, or end the class for everyone?
            </p>
            <div className="flex flex-col gap-3 w-full">
              <button 
                onClick={() => room.disconnect()}
                className="w-full py-2.5 bg-[#f5f3f2] hover:bg-[#e4e2e1] text-[#180d62] font-semibold rounded-lg transition-colors"
              >
                Leave Class
              </button>
              <button 
                onClick={handleEndClass}
                disabled={isEnding}
                className="w-full py-2.5 bg-[#ba1a1a] hover:bg-[#ba1a1a]/90 text-white font-semibold rounded-lg transition-colors flex items-center justify-center"
              >
                {isEnding ? "Ending..." : "End Class for All"}
              </button>
              <button 
                onClick={() => setShowLeaveModal(false)}
                className="w-full py-2.5 text-[#787582] hover:text-[#1b1c1c] font-medium text-sm transition-colors mt-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── SUB-COMPONENTS ─────────────────────────────────────────── */

function ParticipantRow({ name, isHost }: { name: string; isHost: boolean }) {
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-[#f5f3f2] transition-colors group">
      <div className="w-8 h-8 rounded-full bg-[#2e2877] flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
        {initials}
      </div>
      <span className="text-[13px] font-medium text-[#1b1c1c] flex-1 truncate">{name}</span>
      {isHost && (
        <div className="hidden group-hover:flex items-center gap-1">
          <button
            title="Mute"
            className="w-7 h-7 rounded-lg text-[#787582] hover:text-[#ba1a1a] hover:bg-[#ba1a1a]/10 flex items-center justify-center transition-all text-[11px] font-bold"
          >
            M
          </button>
          <button
            title="Remove"
            className="w-7 h-7 rounded-lg text-[#787582] hover:text-[#ba1a1a] hover:bg-[#ba1a1a]/10 flex items-center justify-center transition-all"
          >
            <LogOut size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
