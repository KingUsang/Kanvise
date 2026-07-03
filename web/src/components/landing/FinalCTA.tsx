"use client";

import { useState } from "react";
import { useInView } from "@/hooks/useInView";

export default function FinalCTA() {
  const [formData, setFormData] = useState({
    contact_name: "",
    contact_email: "",
    centre_name: "",
    contact_phone: "",
    estimated_student_count: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const { ref, inView } = useInView();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("http://localhost:3001/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok || res.status === 409) {
        setStatus("success");
        setMessage(data.message || "You're on the list!");
      } else {
        setStatus("error");
        setMessage(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Failed to connect to the server. Please try again later.");
    }
  };

  return (
    <section
      id="waitlist-form"
      ref={ref as React.RefObject<HTMLElement>}
      className="bg-[#2E2877] py-[100px] px-6 lg:px-[120px] relative overflow-hidden"
    >
      <div className={`max-w-[1000px] mx-auto grid md:grid-cols-2 gap-12 items-center ${inView ? "animate-fade-up" : "opacity-0"}`}>
        
        {/* Left Side: Copy */}
        <div className="text-left">
          <h2 className="text-3xl md:text-[40px] leading-[1.2] font-semibold text-white mb-6 tracking-[-0.01em]">
            Your school deserves <br className="hidden lg:block"/> the right engine.
          </h2>
          <p className="text-lg text-[#9893e8] mb-8 max-w-[400px]">
            Join the waitlist today. We&apos;re opening access in batches — and the first tutors in will shape what Kanvise becomes.
          </p>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 text-white/80">
              <span className="material-symbols-outlined text-[#C26627]">check_circle</span>
              <span>Free to join the waitlist.</span>
            </div>
            <div className="flex items-center gap-3 text-white/80">
              <span className="material-symbols-outlined text-[#C26627]">check_circle</span>
              <span>Early access to new features.</span>
            </div>
            <div className="flex items-center gap-3 text-white/80">
              <span className="material-symbols-outlined text-[#C26627]">check_circle</span>
              <span>Direct line to the founders.</span>
            </div>
          </div>
        </div>

        {/* Right Side: Form Card */}
        <div className="bg-white rounded-2xl p-8 shadow-xl border border-white/10 relative z-10">
          {status === "success" ? (
            <div className="flex flex-col items-center justify-center text-center py-12">
              <div className="w-16 h-16 rounded-full bg-[#C26627]/10 flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-[#C26627] text-3xl">check</span>
              </div>
              <h3 className="text-2xl font-bold text-[#2E2877] mb-2">Success!</h3>
              <p className="text-[#3C3027] font-medium">{message}</p>
              <p className="text-[#3C3027]/70 text-sm mt-2">We&apos;ll reach out as soon as your batch opens.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <h3 className="text-2xl font-bold text-[#2E2877] mb-2">Request an Invite</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#3C3027]">Full Name *</label>
                  <input
                    type="text"
                    name="contact_name"
                    required
                    value={formData.contact_name}
                    onChange={handleChange}
                    className="w-full bg-[#F7F5F2] border border-[#C2B59B]/30 rounded-lg px-4 py-3 text-[#3C3027] focus:outline-none focus:border-[#C26627] transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#3C3027]">Email Address *</label>
                  <input
                    type="email"
                    name="contact_email"
                    required
                    value={formData.contact_email}
                    onChange={handleChange}
                    className="w-full bg-[#F7F5F2] border border-[#C2B59B]/30 rounded-lg px-4 py-3 text-[#3C3027] focus:outline-none focus:border-[#C26627] transition-colors"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#3C3027]">Tutorial Centre Name *</label>
                <input
                  type="text"
                  name="centre_name"
                  required
                  value={formData.centre_name}
                  onChange={handleChange}
                  className="w-full bg-[#F7F5F2] border border-[#C2B59B]/30 rounded-lg px-4 py-3 text-[#3C3027] focus:outline-none focus:border-[#C26627] transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#3C3027]">Phone Number</label>
                  <input
                    type="tel"
                    name="contact_phone"
                    value={formData.contact_phone}
                    onChange={handleChange}
                    className="w-full bg-[#F7F5F2] border border-[#C2B59B]/30 rounded-lg px-4 py-3 text-[#3C3027] focus:outline-none focus:border-[#C26627] transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#3C3027]">Estimated Students</label>
                  <input
                    type="number"
                    name="estimated_student_count"
                    placeholder="e.g. 150"
                    value={formData.estimated_student_count}
                    onChange={handleChange}
                    className="w-full bg-[#F7F5F2] border border-[#C2B59B]/30 rounded-lg px-4 py-3 text-[#3C3027] focus:outline-none focus:border-[#C26627] transition-colors"
                  />
                </div>
              </div>

              {status === "error" && (
                <p className="text-red-500 text-sm font-medium mt-1">{message}</p>
              )}

              <button
                type="submit"
                disabled={status === "loading"}
                className="mt-2 w-full bg-[#C26627] text-white py-4 rounded-lg text-lg font-semibold hover:bg-opacity-90 transition-all shadow-md disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2 group"
              >
                {status === "loading" ? "Submitting..." : "Claim Your Spot"}
                {status !== "loading" && <span className="material-symbols-outlined text-[20px] group-hover:translate-x-1 transition-transform">arrow_forward</span>}
              </button>
            </form>
          )}
        </div>

      </div>
    </section>
  );
}
