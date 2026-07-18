"use client";

import { useInView } from "@/hooks/useInView";

export default function WhyInviteOnly() {
  const { ref, inView } = useInView();

  return (
    <section
      id="invite-only"
      ref={ref as React.RefObject<HTMLElement>}
      className="relative py-[100px] px-6 lg:px-[120px] overflow-hidden bg-white"
    >
      <div className="absolute inset-0 bg-[#C2B59B] opacity-15 pointer-events-none"></div>
      
      <div className="max-w-[1000px] mx-auto relative z-10 flex flex-col lg:flex-row gap-16 lg:gap-20 items-center">
        
        {/* Left Side: Story Text */}
        <div className={`w-full lg:w-1/2 ${inView ? "animate-fade-up" : "opacity-0"}`}>
          <h2 className="text-4xl md:text-[48px] leading-[56px] font-bold text-[#2E2877] mb-6 tracking-[-0.02em]">
            We&apos;re not for everyone. <br/>
            <span className="text-[#3C3027] opacity-80">That&apos;s the point.</span>
          </h2>
          
          <div className="text-lg text-[#474551] space-y-6 leading-relaxed">
            <p>
              Kanvise is not a marketplace. Your students don&apos;t browse to find you. They join your school because you invited them. We&apos;re building this deliberately — onboarding serious tutors in batches.
            </p>
            <p className="font-semibold text-[#2E2877]">
              When you join the waitlist, you&apos;re not signing up for a random app. You&apos;re applying to be part of the first generation of tutors to run a truly professional virtual school in Nigeria.
            </p>
            <p className="font-bold text-[#2E2877] text-xl">
              That means something.
            </p>
          </div>
        </div>

        {/* Right Side: What we are not (Visually Appealing Grid) */}
        <div className="w-full lg:w-1/2">
          <div className="mb-6">
             <h4 className={`text-xl font-semibold text-[#2E2877] border-b border-[#C8C5D2] pb-4 ${inView ? "animate-fade-up animation-delay-100" : "opacity-0"}`}>
                What we are not
             </h4>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                title: "Not a marketplace",
                desc: "Students can&apos;t browse to find you.",
                icon: "storefront"
              },
              {
                title: "Not generic e-learning",
                desc: "Built specifically for exam prep tutors.",
                icon: "school"
              },
              {
                title: "Not for universities",
                desc: "We serve serious virtual tutorial centres.",
                icon: "account_balance"
              },
              {
                title: "Not another group chat",
                desc: "A real, private school infrastructure.",
                icon: "forum"
              }
            ].map((item, i) => (
              <div 
                key={item.title} 
                className={`bg-white p-6 rounded-xl shadow-[0px_4px_12px_rgba(60,48,39,0.08)] border border-[#C8C5D2] ${inView ? "animate-fade-up" : "opacity-0"}`}
                style={{ animationDelay: `${(i + 2) * 100}ms` }}
              >
                <div className="w-10 h-10 rounded-full bg-[#C26627]/10 flex items-center justify-center text-[#C26627] mb-4">
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                </div>
                <h5 className="font-bold text-[#2E2877] mb-2">{item.title}</h5>
                <p className="text-sm text-[#474551] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
        
      </div>
    </section>
  );
}
