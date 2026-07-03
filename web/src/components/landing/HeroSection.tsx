"use client";



export default function HeroSection() {

  return (
    <section 
      id="hero"
      className="bg-[#2E2877] pt-[120px] pb-16 md:pb-32 px-6 lg:px-12 text-white min-h-[85vh] flex items-center relative overflow-hidden"
    >
      <div className="max-w-[800px] z-10 w-full pt-8 md:pt-0 mx-auto md:mx-0 md:ml-10 xl:ml-[max(0px,calc((100vw-1200px)/2))]">
        <h1 className="text-4xl md:text-5xl lg:text-[64px] font-bold mb-6 leading-[1.1] text-white drop-shadow-sm tracking-[-0.02em]">
          Your school deserves <br className="hidden md:block" />
          <span className="text-[#C26627]">more than a group chat.</span>
        </h1>
        
        <p className="text-lg md:text-xl font-normal mb-12 text-white opacity-90 max-w-[600px] leading-relaxed">
          Kanvise is the private operating system for serious Nigerian tutors. 
          Run classes, track performance, and collect payments like a real school.
        </p>
        
        <div className="w-full max-w-[500px]">
          <button
            onClick={() => document.getElementById("waitlist-form")?.scrollIntoView({ behavior: "smooth" })}
            className="bg-[#C26627] text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-opacity-90 transition-all shadow-[0px_4px_12px_rgba(0,0,0,0.15)] flex items-center justify-center gap-2 group whitespace-nowrap"
          >
            Claim Spot
            <span className="material-symbols-outlined text-[20px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
          </button>
          <p className="text-white/60 text-sm mt-4 font-medium">
            Free to join. Limited spots per batch.
          </p>
        </div>
      </div>
      
      {/* Abstract Decorative Elements with Subtle Movement */}
      <div className="absolute top-0 right-0 w-1/2 h-full opacity-[0.07] pointer-events-none hidden lg:block">
        <svg className="w-full h-full fill-current text-white animate-[pulse_6s_ease-in-out_infinite]" viewBox="0 0 100 100" preserveAspectRatio="none">
          <circle cx="80" cy="30" r="40" className="origin-center animate-[spin_20s_linear_infinite]"></circle>
          <rect height="50" rx="10" width="50" x="60" y="50" className="origin-center animate-[spin_30s_linear_infinite_reverse]"></rect>
        </svg>
      </div>
    </section>
  );
}
