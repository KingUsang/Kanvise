"use client";

import { useEffect, useState, useRef } from "react";
import { Upload, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { toast } from "sonner";
import {
  hasSlidePollingTimedOut,
  SLIDE_POLL_INTERVAL_MS,
} from "./slide-polling";

interface PresentationControlsProps {
  classId: string;
  onSlideChange: (imageUrl: string) => void;
}

export default function PresentationControls({ classId, onSlideChange }: PresentationControlsProps) {
  const [slides, setSlides] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file");
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error("PDF is larger than 25 MB", { description: "Compress the file and try again." });
      return;
    }

    setIsUploading(true);
    setStatusMessage("Uploading...");
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const formData = new FormData();
      formData.append("file", file);

      const honoUrl = process.env.NEXT_PUBLIC_API_URL;
      
      const uploadRes = await fetch(`${honoUrl}/live-classes/${classId}/slides/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || "Upload failed");
      }

      const { data: { job_id } } = await uploadRes.json();
      
      setStatusMessage("Converting...");
      pollJobStatus(job_id, session?.access_token || "");
    } catch (err: unknown) {
      toast.error("Could not upload the PDF", { description: err instanceof Error ? err.message : "Please try again." });
      setIsUploading(false);
      setStatusMessage("");
    }
  };

  const pollJobStatus = (jobId: string, token: string) => {
    const honoUrl = process.env.NEXT_PUBLIC_API_URL;
    const startedAt = Date.now();

    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    
    pollTimerRef.current = setInterval(async () => {
      if (hasSlidePollingTimedOut(startedAt)) {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
        setIsUploading(false);
        setStatusMessage("");
        toast.error("PDF conversion timed out", { description: "Try a smaller PDF." });
        return;
      }

      try {
        const res = await fetch(`${honoUrl}/live-classes/${classId}/slides/status/${jobId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          }
        });
        
        if (!res.ok) {
          if (res.status === 404) {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
            setIsUploading(false);
            setStatusMessage("");
            toast.error("PDF conversion was not found", { description: "Upload the file again." });
          }
          return;
        }

        const { data } = await res.json();
        if (data.status === "complete") {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setSlides(data.slides);
          setCurrentIndex(0);
          setIsUploading(false);
          setStatusMessage("");
          if (data.slides.length > 0) {
            onSlideChange(data.slides[0]);
          }
          toast.success("Teaching material is ready");
        } else if (data.status === "error") {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setIsUploading(false);
          setStatusMessage("");
          toast.error("Could not convert the PDF", { description: data.error });
        }
      } catch {
        // ignore fetch errors and keep polling
      }
    }, SLIDE_POLL_INTERVAL_MS);
  };

  useEffect(() => () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
  }, []);

  const goToSlide = (index: number) => {
    if (index >= 0 && index < slides.length) {
      setCurrentIndex(index);
      onSlideChange(slides[index]);
    }
  };

  return (
    <div className="flex items-center gap-2 md:gap-4 md:ml-4 min-w-0">
      <input 
        type="file" 
        accept="application/pdf" 
        ref={fileInputRef} 
        onChange={handleUpload} 
        className="hidden" 
      />
      
      {slides.length === 0 && !isUploading && (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#994704]/10 hover:bg-[#994704]/20 text-[#994704] text-sm font-semibold rounded-lg transition-colors"
        >
          <Upload size={16} />
          <span className="hidden sm:inline">Add material</span>
        </button>
      )}

      {isUploading && (
        <div className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-[#787582]">
          <Loader2 size={16} className="animate-spin text-[#994704]" />
          {statusMessage}
        </div>
      )}

      {slides.length > 0 && !isUploading && (
        <div className="flex items-center gap-1 bg-[#fbf9f8] border border-[#e4e2e1] rounded-xl p-1">
          <button
            onClick={() => goToSlide(currentIndex - 1)}
            disabled={currentIndex === 0}
            title="Previous slide"
            className="flex items-center gap-1 rounded-lg px-2.5 py-2 text-[12px] font-semibold text-[#180d62] hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <ChevronLeft size={17} />
            <span className="hidden lg:inline">Previous</span>
          </button>
          
          <span className="min-w-10 md:min-w-14 rounded-md bg-white px-1.5 md:px-2 py-1.5 text-center text-[12px] font-bold text-[#180d62] shadow-sm">
            {currentIndex + 1} / {slides.length}
          </span>
          
          <button
            onClick={() => goToSlide(currentIndex + 1)}
            disabled={currentIndex === slides.length - 1}
            title="Next slide"
            className="flex items-center gap-1 rounded-lg px-2.5 py-2 text-[12px] font-semibold text-[#180d62] hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <span className="hidden lg:inline">Next</span>
            <ChevronRight size={17} />
          </button>
          
          <div className="w-px h-4 bg-[#e4e2e1] mx-1"></div>
          
          <button
            onClick={() => {
              setSlides([]);
              onSlideChange(""); // This clears the whiteboard and broadcasts to all students
            }}
            title="Close material"
            className="flex items-center gap-1 p-1.5 rounded text-[#787582] hover:bg-white hover:text-[#ba1a1a] text-xs font-semibold lg:px-2"
          >
            <X size={14} />
            <span className="hidden lg:inline">Close material</span>
          </button>
        </div>
      )}
    </div>
  );
}
