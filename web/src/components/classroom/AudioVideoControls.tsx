"use client";

import { useLocalParticipant } from "@livekit/components-react";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";
import { toast } from "sonner";

export default function AudioVideoControls() {
  const { localParticipant } = useLocalParticipant();
  const isMicEnabled = localParticipant?.isMicrophoneEnabled;
  const isCamEnabled = localParticipant?.isCameraEnabled;

  const toggleMic = async () => {
    if (!localParticipant) return;
    try {
      await localParticipant.setMicrophoneEnabled(!isMicEnabled);
    } catch (error) {
      toast.error("Could not change the microphone", { description: error instanceof Error ? error.message : "Check your browser permission." });
    }
  };

  const toggleCam = async () => {
    if (!localParticipant) return;
    try {
      await localParticipant.setCameraEnabled(!isCamEnabled);
    } catch (error) {
      toast.error("Could not change the camera", { description: error instanceof Error ? error.message : "Check your browser permission." });
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={toggleMic}
        aria-label={isMicEnabled ? "Turn off microphone" : "Turn on microphone"}
        className={`flex items-center justify-center w-11 h-11 rounded-full transition-all border ${
          isMicEnabled
            ? "bg-[#180d62] text-white border-[#180d62] shadow-md hover:bg-[#180d62]/90"
            : "bg-[#ba1a1a]/10 text-[#ba1a1a] border-[#ba1a1a]/20 hover:bg-[#ba1a1a]/20"
        }`}
      >
        {isMicEnabled ? <Mic size={18} /> : <MicOff size={18} />}
      </button>

      <button
        onClick={toggleCam}
        aria-label={isCamEnabled ? "Turn off camera" : "Turn on camera"}
        className={`flex items-center justify-center w-11 h-11 rounded-full transition-all border ${
          isCamEnabled
            ? "bg-[#180d62] text-white border-[#180d62] shadow-md hover:bg-[#180d62]/90"
            : "bg-[#ba1a1a]/10 text-[#ba1a1a] border-[#ba1a1a]/20 hover:bg-[#ba1a1a]/20"
        }`}
      >
        {isCamEnabled ? <Video size={18} /> : <VideoOff size={18} />}
      </button>
    </div>
  );
}
