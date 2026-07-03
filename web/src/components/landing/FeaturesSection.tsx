"use client";

import { useInView } from "@/hooks/useInView";

const features = [
  {
    icon: "video_camera_front",
    title: "Live & Recorded Classes",
    body: "Run classes your way — live or pre-recorded. Students join your private school, not a random Zoom link.",
  },
  {
    icon: "notifications_active",
    title: "Automated Notifications",
    body: "Kanvise reminds your students about class so you don't have to. Daily summaries. Weekly reports. Done automatically.",
  },
  {
    icon: "rule",
    title: "Attendance & Performance",
    body: "Know who showed up, how they're performing, and where they're falling behind. Real-time, always.",
  },
  {
    icon: "quiz",
    title: "Mock Exams & Assignments",
    body: "Set mocks, receive submissions, share results — all within your school. No WhatsApp, no Google Forms.",
  },
  {
    icon: "payments",
    title: "Payment Landing Page",
    body: "A professional payment page for your centre. Students pay. You get notified. It's that clean.",
  },
  {
    icon: "folder_open",
    title: "Material Uploads",
    body: "Share resources, past questions, and study materials in an organised, searchable library inside your school.",
  },
];

export default function FeaturesSection() {
  const { ref, inView } = useInView();

  return (
    <section
      id="features"
      ref={ref as React.RefObject<HTMLElement>}
      className="bg-white py-[100px] px-6 lg:px-[120px]"
    >
      <div className="max-w-[1200px] mx-auto">
        <div className={`text-center mb-[80px] ${inView ? "animate-fade-up" : "opacity-0"}`}>
          <h2 className="text-[32px] leading-[40px] font-semibold text-[#2E2877] mb-3 tracking-[-0.01em]">
            Kanvise gives you the engine. <br className="hidden sm:block" /> You run the school.
          </h2>
          <p className="text-lg text-[#3C3027] opacity-90 max-w-[600px] mx-auto">
            Everything a professional tutorial centre needs. In one private, invite-only space.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map(({ icon, title, body }, i) => (
            <div
              key={title}
              className={`group bg-[#F7F5F2] p-10 rounded-xl border-l-4 border-l-[#2E2877] shadow-sm hover:shadow-[0px_12px_28px_rgba(46,40,119,0.12)] hover:-translate-y-1 transition-all duration-300 ${
                inView ? "animate-fade-up" : "opacity-0"
              }`}
              style={{ animationDelay: `${(i % 3) * 150}ms` }}
            >
              <div className="w-12 h-12 rounded-full bg-[#2E2877]/10 flex items-center justify-center text-[#2E2877] mb-6 group-hover:bg-[#2E2877]/20 group-hover:scale-110 transition-all duration-300">
                <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {icon}
                </span>
              </div>
              <h3 className="text-xl font-semibold text-[#1b1c1c] mb-3">{title}</h3>
              <p className="text-sm text-[#474551] leading-[22px]">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
