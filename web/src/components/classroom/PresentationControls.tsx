"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

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
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Please upload a PDF file.");
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      alert("File exceeds 25MB limit. Please compress your PDF.");
      return;
    }

    setIsUploading(true);
    setStatusMessage("Uploading...");
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const formData = new FormData();
      formData.append("file", file);

      const honoUrl = process.env.NEXT_PUBLIC_HONO_API_URL;
      
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
    } catch (err: any) {
      alert(err.message);
      setIsUploading(false);
      setStatusMessage("");
    }
  };

  const pollJobStatus = (jobId: string, token: string) => {
    const honoUrl = process.env.NEXT_PUBLIC_HONO_API_URL;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${honoUrl}/live-classes/${classId}/slides/status/${jobId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          }
        });
        
        if (res.ok) {
          const { data } = await res.json();
          if (data.status === "complete") {
            clearInterval(interval);
            setSlides(data.slides);
            setCurrentIndex(0);
            setIsUploading(false);
            setStatusMessage("");
            if (data.slides.length > 0) {
              onSlideChange(data.slides[0]);
            }
          } else if (data.status === "error") {
            clearInterval(interval);
            setIsUploading(false);
            setStatusMessage("");
            alert("Error converting PDF: " + data.error);
          }
        }
      } catch (e) {
        // ignore fetch errors and keep polling
      }
    }, 1500);
  };

  const goToSlide = (index: number) => {
    if (index >= 0 && index < slides.length) {
      setCurrentIndex(index);
      onSlideChange(slides[index]);
    }
  };

  return (
    <div className="flex items-center gap-4 ml-4">
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
          Upload Slide
        </button>
      )}

      {isUploading && (
        <div className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-[#787582]">
          <Loader2 size={16} className="animate-spin text-[#994704]" />
          {statusMessage}
        </div>
      )}

      {slides.length > 0 && !isUploading && (
        <div className="flex items-center gap-2 bg-[#fbf9f8] border border-[#e4e2e1] rounded-lg px-1 py-1">
          <button
            onClick={() => goToSlide(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="p-1 rounded text-[#787582] hover:bg-white hover:text-[#180d62] disabled:opacity-50 disabled:hover:bg-transparent"
          >
            <ChevronLeft size={18} />
          </button>
          
          <span className="text-[13px] font-semibold text-[#180d62] w-12 text-center">
            {currentIndex + 1} / {slides.length}
          </span>
          
          <button
            onClick={() => goToSlide(currentIndex + 1)}
            disabled={currentIndex === slides.length - 1}
            className="p-1 rounded text-[#787582] hover:bg-white hover:text-[#180d62] disabled:opacity-50 disabled:hover:bg-transparent"
          >
            <ChevronRight size={18} />
          </button>
          
          <div className="w-px h-4 bg-[#e4e2e1] mx-1"></div>
          
          <button
            onClick={() => {
              setSlides([]);
              onSlideChange(""); // This clears the whiteboard and broadcasts to all students
            }}
            className="p-1 rounded text-[#787582] hover:bg-white hover:text-[#ba1a1a] text-xs font-semibold px-2"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
