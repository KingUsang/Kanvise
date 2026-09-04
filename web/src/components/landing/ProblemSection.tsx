"use client";

import { useInView } from "@/hooks/useInView";

export default function ProblemSection() {
  const { ref: storyRef, inView: storyInView } = useInView();
  const { ref: problemRef, inView: problemInView } = useInView();

  return (
    <>
      {/* ── Story Section ── */}
      <section
        id="story"
        ref={storyRef as React.RefObject<HTMLElement>}
        className="bg-white py-[100px] px-6 lg:px-[120px]"
      >
        <div className="max-w-[1200px] mx-auto grid md:grid-cols-2 gap-16 lg:gap-[64px] items-center">
          
          <div className={storyInView ? "animate-slide-right" : "opacity-0"}>
            <h2 className="text-3xl md:text-[32px] leading-[40px] font-semibold text-[#2E2877] mb-6 tracking-[-0.01em]">
              You&apos;ve been running a school with tools that were never built for one.
            </h2>
            <div className="w-16 h-1 bg-[#C2B59B] mb-8"></div>
            
            <div className="space-y-6 text-lg text-[#3C3027] opacity-90 leading-relaxed">
              <p>
                I attempted UTME three times before I got into Pharmacy. Three times. The kind of number that makes people start suggesting alternatives. 
              </p>
              <p>
                When I missed OAU&apos;s cut-off, I applied to UI. I found an online tutorial centre and signed up. I attended two classes. Just two. And then I stopped.
              </p>
              <p>
                I was lucky enough to pass Post-UTME. But I had friends who weren&apos;t. Friends who fell through the crack, silently, and no one caught them.
              </p>
              <p className="font-semibold text-[#2E2877] text-xl border-l-4 border-[#C26627] pl-4 mt-6">
                That&apos;s the thing about virtual learning nobody talks about enough. It&apos;s not the content that kills you. It&apos;s the silence.
              </p>
              <p className="font-semibold text-[#2E2877]">
                Kanvise exists because of those friends. Because &quot;nobody noticed&quot; is not a neutral outcome — it&apos;s a design failure.
              </p>
            </div>
          </div>

          <div className={`relative h-[400px] md:h-[500px] rounded-xl overflow-hidden shadow-[0px_4px_24px_rgba(60,48,39,0.12)] ${storyInView ? "animate-fade-up animation-delay-200" : "opacity-0"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              className="object-cover w-full h-full absolute inset-0" 
              alt="High-end desk setup of a modern educator" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDKbUiPaz-MXgGRjMANXsAoZKX5Le36yVdxO3evSGZMnXh_bXm5Tq7WpZXHvEZPWyu7aiKPWufxkC49AUoBLtJlbk_GmIJIzsNTIL2dQCV4fX0SP4K8t50Rql4fpggBu6G6oi9b_giDRE4KNeZxuF0d6l4_cUFGc_ng1xEUMFr6L6MC3t5yLQ9CWYs8497xBpcxEjuKhcNqwVOdbFb7hHQfbjcsnyCEyuYCUtgxZxy17IN8t0A5K1rwuaL8dWmW436Q2ZPQSoycSVM"
            />
          </div>

        </div>
      </section>

      {/* ── Problem Statement ── */}
      <section
        id="problem"
        ref={problemRef as React.RefObject<HTMLElement>}
        className="bg-[#F7F5F2] py-[100px] px-6 lg:px-[120px]"
      >
        <div className="max-w-[1200px] mx-auto text-center">
          <h2
            className={`text-3xl md:text-[32px] font-semibold text-[#2E2877] mb-12 max-w-2xl mx-auto tracking-[-0.01em] ${problemInView ? "animate-fade-up" : "opacity-0"}`}
          >
            The infrastructure is broken.
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16 text-left">
            {[
              "Posting class links on WhatsApp at 6am.",
              "Chasing students for payment via DMs.",
              "Sending attendance manually.",
              "Building reports in voice notes.",
            ].map((item, i) => (
              <div 
                key={i}
                className={`bg-white rounded-xl p-6 shadow-sm border border-[#C2B59B]/20 hover:shadow-md hover:-translate-y-1 transition-all duration-300 ${problemInView ? `animate-fade-up` : "opacity-0"}`}
                style={{ animationDelay: `${(i + 1) * 100}ms` }}
              >
                <div className="text-[#C26627] font-bold text-lg mb-3">0{i + 1}</div>
                <p className="text-[#3C3027] leading-relaxed">{item}</p>
              </div>
            ))}
          </div>

          <div
            className={`max-w-3xl mx-auto bg-white border-l-4 border-l-[#C26627] rounded-xl p-8 shadow-[0px_4px_12px_rgba(46,40,119,0.06)] text-left ${problemInView ? "animate-fade-up animation-delay-500" : "opacity-0"}`}
          >
            <p className="text-[#2E2877] font-bold text-xl mb-3">
              You are not the problem. The infrastructure is.
            </p>
            <p className="text-[#3C3027] text-lg leading-relaxed opacity-90">
              Nigerian tutors have been working harder than they should — not because they&apos;re not serious, but because no one built the right system for them. Until now.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
