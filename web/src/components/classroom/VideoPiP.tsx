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

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
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
      className="absolute top-4 right-4 z-10 flex items-start gap-3 cursor-grab active:cursor-grabbing"
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Secondary PiP: Active Student or Local Preview */}
      {displayStudentTrack && displayStudent && (
        <div className="w-32 h-24 rounded-lg overflow-hidden border-2 border-[#994704] shadow-lg shadow-black/20 bg-[#1b1c1c] relative pointer-events-auto transition-all animate-in fade-in slide-in-from-right-4">
          <VideoTrack trackRef={displayStudentTrack} className="w-full h-full object-cover" />
          <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
            <span className="truncate max-w-[80px]">
              {displayStudent.identity === localParticipant?.identity ? "You (Preview)" : (displayStudent.name || displayStudent.identity)}
            </span>
            {displayStudent.isSpeaking && (
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
            )}
          </div>
        </div>
      )}

      {/* Primary PiP: Permanent Pinned Tutor */}
      <div className="w-48 h-36 rounded-xl overflow-hidden border-2 border-[#180d62] shadow-xl shadow-black/20 bg-[#1b1c1c] relative pointer-events-auto flex items-center justify-center">
        {tutor.isCameraEnabled && tutorTrack ? (
          <VideoTrack trackRef={tutorTrack} className="w-full h-full object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-[#2e2877] flex items-center justify-center text-white text-2xl font-bold shadow-inner">
            {(tutor.name || tutor.identity).slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[11px] px-2 py-1 rounded-md font-semibold flex items-center gap-1.5">
          <span>Tutor</span>
          {tutor.isSpeaking && (
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}
