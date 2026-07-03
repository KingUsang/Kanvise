"use client";

import { useInView } from "@/hooks/useInView";

export default function FoundersSection() {
  const { ref, inView } = useInView();

  return (
    <section
      id="founder"
      ref={ref as React.RefObject<HTMLElement>}
      className="bg-[#251e0d] py-[120px] px-6 lg:px-[120px] text-white"
    >
      <div className="max-w-[1000px] mx-auto grid md:grid-cols-12 gap-10 lg:gap-16 items-center">
        
        <div className={`group md:col-span-6 relative aspect-[4/3] rounded-xl overflow-hidden shadow-2xl ${inView ? "animate-fade-up" : "opacity-0"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            className="object-cover w-full h-full absolute inset-0 transition-transform duration-[10000ms] group-hover:scale-110" 
            alt="Kanvise founding team" 
            src="/group_photoshoot.jpeg"
          />
        </div>

        <div className={`md:col-span-6 ${inView ? "animate-fade-up animation-delay-200" : "opacity-0"}`}>
          <span className="material-symbols-outlined text-[64px] text-[#C9A68C] opacity-50 mb-4 block">format_quote</span>
          <h2 className="text-[32px] leading-[40px] font-semibold mb-10 tracking-[-0.01em]">
            We built this because we lived this.
          </h2>
          
          <div className="space-y-6 text-xl font-normal leading-relaxed text-[#a79b82] mb-10">
            <p>
              Kanvise didn&apos;t start in a boardroom. It started in a tutorial centre — managing students on WhatsApp, sending attendance on Google Sheets, watching good tutors burn out from the admin, not the teaching.
            </p>
            <p className="text-white font-medium">
              We are tutors. We are builders. We are Nigerian.
            </p>
            <p>
              We built Kanvise because we knew what the tool should feel like — and nothing out there felt right. This is our answer to a problem we know personally.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-1 bg-[#C26627]"></div>
            <span className="text-sm font-semibold tracking-wider uppercase text-white">Mayokun &amp; Team</span>
          </div>
        </div>

      </div>
    </section>
  );
}
