"use client";

import { useParticipants, useTracks, VideoTrack, useSpeakingParticipants, useLocalParticipant } from "@livekit/components-react";
import { Track } from "livekit-client";
import { useState, useRef } from "react";

export default function VideoPiP() {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const cameraTracks = useTracks([Track.Source.Camera]);
  const activeSpeakers = useSpeakingParticipants();

  // Find the tutor based on the metadata we inject in the token route
  const tutor = participants.find((p) => {
    try {
      const meta = JSON.parse(p.metadata || "{}");
      return meta.isHost === true;
    } catch {
      return false;
    }
  });

  // Find the active student (not the tutor, has camera enabled, and is actively speaking)
  // We sort by speaking volume implicitly since useActiveSpeakers orders by activity
  const activeStudent = activeSpeakers.find(
    (p) => p.identity !== tutor?.identity && p.isCameraEnabled
  );

  const tutorTrack = cameraTracks.find((t) => t.participant.identity === tutor?.identity);

  // If an active student is speaking, use them. Otherwise, if the local user is a student and has their camera on, show them as a preview.
  const isLocalHost = localParticipant?.identity === tutor?.identity;
  const showLocalPreview = !isLocalHost && localParticipant?.isCameraEnabled;

  const displayStudent = activeStudent || (showLocalPreview ? localParticipant : null);
  const displayStudentTrack = displayStudent ? cameraTracks.find((t) => t.participant.identity === displayStudent.identity) : null;

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const boundsRef = useRef({ minX: 0, maxX: 0, minY: 0, maxY: 0 });

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    const el = e.currentTarget as HTMLElement;
    const parent = el.parentElement?.getBoundingClientRect();
    const self = el.getBoundingClientRect();
    if (parent) {
      boundsRef.current = {
        minX: position.x - (self.left - parent.left),
        maxX: position.x + (parent.right - self.right),
        minY: position.y - (self.top - parent.top),
        maxY: position.y + (parent.bottom - self.bottom),
      };
    }
    el.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const { minX, maxX, minY, maxY } = boundsRef.current;
    setPosition({
      x: Math.min(Math.max(e.clientX - dragStart.current.x, minX), maxX),
      y: Math.min(Math.max(e.clientY - dragStart.current.y, minY), maxY)
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // We ALWAYS show the PiP container as long as we know who the tutor is, matching the "teacher is always at the front" design.
  if (!tutor) return null;

  return (
    <div
      className="absolute top-3 right-3 md:top-5 md:right-5 z-30 flex items-start gap-2 md:gap-3 cursor-grab active:cursor-grabbing touch-none select-none"
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Secondary PiP: Active Student or Local Preview */}
      {displayStudentTrack && displayStudent && (
        <div className="w-14 h-14 md:w-20 md:h-20 rounded-full overflow-hidden border-[3px] border-[#994704] shadow-lg shadow-black/20 bg-[#1b1c1c] relative pointer-events-auto transition-all animate-in fade-in slide-in-from-right-4">
          <VideoTrack trackRef={displayStudentTrack} className="w-full h-full object-cover" />
          {displayStudent.isSpeaking && <div className="absolute inset-0 rounded-full ring-4 ring-green-400/80" />}
        </div>
      )}

      {/* Primary PiP: Permanent Pinned Tutor */}
      <div className={`w-20 h-20 md:w-28 md:h-28 rounded-full overflow-hidden border-[3px] shadow-xl shadow-black/20 bg-[#1b1c1c] relative pointer-events-auto flex items-center justify-center ${tutor.isSpeaking ? "border-green-400 ring-4 ring-green-400/30" : "border-white"}`}>
        {tutor.isCameraEnabled && tutorTrack ? (
          <VideoTrack trackRef={tutorTrack} className="w-full h-full object-cover" />
        ) : (
          <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-[#2e2877] flex items-center justify-center text-white text-xl md:text-2xl font-bold shadow-inner">
            {(tutor.name || tutor.identity).slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent pt-5 pb-1.5 text-center text-white text-[10px] font-semibold">
          Tutor
        </div>
      </div>
    </div>
  );
}
