"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  PaymentsMockup, 
  ScheduleMockup, 
  MockExamsMockup, 
  LiveClassesMockup, 
  MaterialsMockup 
} from '@/components/landing/ImagineMockups';
import { AnimatedSection } from '@/components/landing/AnimatedSection';

// You can uncomment these existing components later if needed:
// import Navbar from "@/components/landing/Navbar";
// import HeroSection from "@/components/landing/HeroSection";
// import ProblemSection from "@/components/landing/ProblemSection";
// import FeaturesSection from "@/components/landing/FeaturesSection";
// import FoundersSection from "@/components/landing/FoundersSection";
// import WhyInviteOnly from "@/components/landing/WhyInviteOnly";
// import FinalCTA from "@/components/landing/FinalCTA";
// import Footer from "@/components/landing/Footer";

export default function LandingPage() {
  const [countdown, setCountdown] = useState("");
  const [tutorsCount, setTutorsCount] = useState(0);
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null);
  const [suggestionText, setSuggestionText] = useState("");
  const [suggestionStatus, setSuggestionStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const [waitlistData, setWaitlistData] = useState({
    contact_name: "",
    contact_email: "",
    centre_name: "",
    contact_phone: "",
    estimated_student_count: "",
    wants_beta_testing: false
  });
  const [waitlistSubmitStatus, setWaitlistSubmitStatus] = useState<"idle" | "loading" | "success" | "error" | "conflict">("idle");

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWaitlistSubmitStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(waitlistData),
      });
      if (res.status === 409) {
        setWaitlistSubmitStatus("conflict");
        return;
      }
      if (!res.ok) throw new Error("Failed to submit");
      setWaitlistSubmitStatus("success");
    } catch (e) {
      setWaitlistSubmitStatus("error");
    }
  };

  const handleSuggestionSubmit = async () => {
    if (!suggestionText.trim()) return;
    setSuggestionStatus("loading");
    try {
      const res = await fetch("http://localhost:3001/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestion: suggestionText }),
      });
      if (!res.ok) throw new Error("Failed to submit");
      setSuggestionStatus("success");
      setTimeout(() => setSuggestionStatus("idle"), 5000);
      setSuggestionText("");
    } catch (e) {
      setSuggestionStatus("error");
    }
  };

  useEffect(() => {
    // Fetch live waitlist count
    const fetchWaitlistCount = async () => {
      try {
        const res = await fetch("http://localhost:3001/waitlist/count");
        if (res.ok) {
          const data = await res.json();
          setWaitlistCount(data.count);
        }
      } catch (err) {
        console.error("Failed to fetch waitlist count:", err);
      }
    };
    fetchWaitlistCount();
  }, []);

  useEffect(() => {
    // Stats animation logic
    let animated = false;
    const statsSection = document.getElementById('timeline');
    if (!statsSection) return;

    const statsObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !animated) {
        animated = true;
        let start = 0;
        const end = 52;
        const duration = 2000;
        const range = end - start;
        const stepTime = Math.abs(Math.floor(duration / range));
        
        const timer = setInterval(() => {
          start += 1;
          setTutorsCount(start);
          if (start === end) clearInterval(timer);
        }, stepTime);
      }
    });

    statsObserver.observe(statsSection);
    return () => statsObserver.disconnect();
  }, []);

  useEffect(() => {
    // Countdown logic to August 1st 2026
    const updateCountdown = () => {
      const now = new Date();
      const targetDate = new Date('2026-08-01T00:00:00');
      const diff = targetDate.getTime() - now.getTime();
      
      if (diff <= 0) {
        setCountdown("00:00:00");
        return;
      }

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      
      if (d > 0) {
        setCountdown(`${d}d ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`);
      } else {
        setCountdown(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      }
    };

    const interval = setInterval(updateCountdown, 1000);
    updateCountdown();
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="landing font-body-md overflow-x-hidden text-[#241915]">
      {/* TopNavBar */}
      <div className="fixed top-0 left-0 w-full z-50 bg-surface/80 backdrop-blur-sm border-b border-outline-variant">
        <nav className="flex justify-between items-center px-6 md:px-12 max-w-[1440px] mx-auto h-16">
          <div className="flex items-center gap-2 cursor-pointer">
            <div className="relative w-8 h-8 flex-shrink-0">
              <img src="/kanvise_logo_small_blue.png" alt="Kanvise" className="w-full h-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            </div>
            <div className="text-[24px] font-bold text-primary">Kanvise</div>
          </div>
          <div className="hidden md:flex gap-8 items-center">
          <a className="font-label-md text-on-surface-variant hover:text-primary transition-colors duration-200" href="#story">Our Story</a>
          <a className="font-label-md text-on-surface-variant hover:text-primary transition-colors duration-200" href="#mission">Mission</a>
          <a className="font-label-md text-on-surface-variant hover:text-primary transition-colors duration-200" href="#timeline">Timeline</a>
          <a className="px-6 py-2 bg-primary text-white font-label-md rounded-lg active:scale-95 transition-all" href="#waitlist">Join Waitlist</a>
        </div>
        <button className="md:hidden text-primary">
          <span className="material-symbols-outlined">menu</span>
        </button>
        </nav>
      </div>

      {/* Hero Section */}
      <header className="pt-32 pb-20 px-6 md:px-12 max-w-[1120px] mx-auto text-center overflow-hidden">
        <div className="mb-6 flex justify-center">
          <span className="inline-block px-4 py-1 border-b-2 border-primary/40 font-annotation italic">
            Built by university students <span className="text-primary font-bold">for the future of education</span>
          </span>
        </div>
        <h1 className="text-[36px] md:text-[64px] mb-6 max-w-4xl mx-auto leading-tight font-bold">
          Your tutorial deserves more than a <span className="annotation-underline">group chat</span>.
        </h1>
        <p className="text-[18px] text-on-surface-variant mb-10 max-w-2xl mx-auto">
          Kanvise is the Operating System for private tutors and students. Organize materials, track payments, and automate attendance in one tactile, focused space.
        </p>
        <div className="flex flex-col md:flex-row justify-center items-center gap-4 mb-20">
          <a className="w-full md:w-auto px-10 py-4 bg-primary text-white font-label-md rounded-lg text-[16px] hover:bg-primary/90 transition-all desk-mockup-shadow text-center" href="#waitlist">
            Join Waitlist
          </a>
          <a className="w-full md:w-auto px-10 py-4 border border-primary text-primary font-label-md rounded-lg text-[16px] hover:bg-surface-variant transition-all text-center" href="#suggest">
            Suggest a Feature
          </a>
        </div>

        {/* Hero Mockup & Live Data */}
        <AnimatedSection delay={100} className="relative w-full max-w-[1080px] mx-auto animate-float">
          <div className="desk-mockup-shadow rounded-xl overflow-hidden border border-outline-variant bg-white p-4">
            <img 
              alt="Kanvise App Mockup" 
              className="w-full rounded-lg h-auto object-cover aspect-video" 
              src="/shirt_design.png"
            />
          </div>
          
          {/* Live Data Chips */}
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex flex-wrap justify-center gap-4 w-full md:w-auto">
            <div className="bg-white px-6 py-4 rounded-xl border border-outline-variant flex flex-col items-center min-w-[140px] desk-mockup-shadow">
              <span className="text-primary font-bold text-[24px]">{countdown}</span>
              <span className="font-annotation text-[13px] opacity-60">Beta Launch In</span>
            </div>
            
            {waitlistCount !== null && waitlistCount >= 20 && (
              <>
                <div className="bg-white px-6 py-4 rounded-xl border border-outline-variant flex flex-col items-center min-w-[140px] desk-mockup-shadow">
                  <span className="text-primary font-bold text-[24px]">{waitlistCount.toLocaleString()}</span>
                  <span className="font-annotation text-[13px] opacity-60">Waitlist Size</span>
                </div>
                <div className="hidden md:flex bg-white px-6 py-4 rounded-xl border border-outline-variant flex flex-col items-center min-w-[140px] desk-mockup-shadow">
                  <span className="text-secondary font-bold text-[24px]">#{waitlistCount + 1}</span>
                  <span className="font-annotation text-[13px] opacity-60">Next Spot</span>
                </div>
              </>
            )}
          </div>
        </AnimatedSection>
      </header>

      {/* Our Story */}
      <section className="py-20 px-6 md:px-12 bg-surface-container-low" id="story">
        <AnimatedSection className="max-w-[640px] mx-auto">
          <h2 className="text-[32px] font-semibold mb-8 italic">The WhatsApp Exhaustion</h2>
          <div className="space-y-6 text-[18px] text-on-surface-variant leading-relaxed">
            <p>It starts with one student. A simple message. &quot;Can you help me with Calculus?&quot; Then it becomes five. Then ten. Suddenly, your phone is a non-stop vibration of administrative chaos.</p>
            <blockquote className="pl-6 border-l-4 border-primary/20 italic font-medium py-2 my-8 text-on-surface">
                &quot;Have you paid for last week yet?&quot; <br/>
                &quot;Where is the link for today&apos;s session?&quot; <br/>
                &quot;Check the pinned message in the group chat...&quot;
            </blockquote>
            <p>We saw our tutors spending 30% of their time chasing payments and scrolling through endless chat history to find a single PDF. We saw students feeling lost in the noise of a 50-person group chat.</p>
            <p>As university students ourselves, we knew there had to be a better way to treat the sanctity of teaching. Something more intentional. Something that felt like a well-organized desk, not a noisy digital lobby.</p>
            <p className="font-bold text-on-surface pt-4">So we decided to build Kanvise.</p>
            <div className="pt-8 flex items-center gap-4">
              <div className="flex -space-x-4 items-center">
                <Image src="/techie_photoshoot.jpeg" alt="Techie" width={80} height={80} className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover shadow-lg border-2 border-white" />
                <Image src="/my_photoshoot-small.jpeg" alt="Emmah" width={80} height={80} className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover shadow-lg border-2 border-white" />
              </div>
              <div className="ml-2">
                <p className="font-semibold text-[14px]">Techie &amp; Emmah</p>
                <p className="text-[13px] opacity-60">Co-founders, Kanvise</p>
              </div>
            </div>
          </div>
        </AnimatedSection>
      </section>

      {/* Inspiration (Conversation Cluster) */}
      <section className="py-20 px-6 md:px-12 max-w-[1120px] mx-auto overflow-hidden">
        <AnimatedSection className="text-center mb-16">
          <h2 className="text-[32px] font-semibold mb-4">Recognize these?</h2>
          <p className="text-on-surface-variant">The friction points we&apos;re deleting for good.</p>
        </AnimatedSection>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 items-start">
          <AnimatedSection delay={100} className="whatsapp-bubble p-6 rounded-2xl bg-white relative hover:-translate-y-2 transition-transform duration-300">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-[12px] font-bold">PL</div>
              <span className="font-bold text-[14px]">Pelumi</span>
            </div>
            <p className="text-[12px] text-on-surface-variant mb-2">Kanvise asked: &quot;What&apos;s eating up most of your time running your tutorial?&quot;</p>
            <p className="text-[14px] mb-4">&quot;Administrative duties. Timetables clashing, sending reminders, handling student registrations. It&apos;s a lot before I even get to teaching.&quot;</p>
            <div className="pt-4 border-t border-outline-variant">
              <p className="text-primary font-bold text-[13px] flex items-center gap-1">
                <span className="material-symbols-outlined text-[18px]">verified</span> Automated Scheduling
              </p>
            </div>
          </AnimatedSection>
          <AnimatedSection delay={300} className="whatsapp-bubble p-6 rounded-2xl bg-white relative md:mt-12 hover:-translate-y-2 transition-transform duration-300">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-[12px] font-bold">TM</div>
              <span className="font-bold text-[14px]">Tomiwa</span>
            </div>
            <p className="text-[12px] text-on-surface-variant mb-2">Kanvise asked: &quot;What&apos;s the hardest part of managing your students?&quot;</p>
            <p className="text-[14px] mb-4">&quot;Payments overlapping, chasing responses from students, keeping class timing and attendance straight.&quot;</p>
            <div className="pt-4 border-t border-outline-variant">
              <p className="text-primary font-bold text-[13px] flex items-center gap-1">
                <span className="material-symbols-outlined text-[18px]">verified</span> Payment Tracking
              </p>
            </div>
          </AnimatedSection>
          <AnimatedSection delay={500} className="whatsapp-bubble p-6 rounded-2xl bg-white relative hover:-translate-y-2 transition-transform duration-300">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-[12px] font-bold">ST</div>
              <span className="font-bold text-[14px]">Stephen</span>
            </div>
            <p className="text-[12px] text-on-surface-variant mb-2">Kanvise asked: &quot;How do you keep students accountable?&quot;</p>
            <p className="text-[14px] mb-4">&quot;Tutors struggle just to schedule classes in the first place. I call every student biweekly. It works, but it&apos;s exhausting to keep up.&quot;</p>
            <div className="pt-4 border-t border-outline-variant">
              <p className="text-primary font-bold text-[13px] flex items-center gap-1">
                <span className="material-symbols-outlined text-[18px]">verified</span> Auto Attendance Logging
              </p>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 px-6 md:px-12 bg-[#241915] text-[#fff8f6]" id="mission">
        <AnimatedSection className="max-w-[1120px] mx-auto">
          <div className="flex justify-center">
            <div className="w-full max-w-2xl">
              <h2 className="text-[36px] md:text-[48px] font-bold mb-8 leading-tight">
                Making online tutorials <span className="italic text-[var(--kv-ruddy-brown)]">less passive.</span>
              </h2>
              <p className="text-[18px] opacity-80 mb-12">
                Every year, tutorials like this one help thousands of students get into university and succeed. Kanvise exists to become the operating system that lets tutors teach with less stress, and gives students a better place to learn.
              </p>
              {/*<ul className="space-y-8">
                <li className="flex gap-4">
                  <div className="w-10 h-10 rounded-full border border-[var(--kv-ruddy-brown)] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[var(--kv-ruddy-brown)]">videocam</span>
                  </div>
                  {/*<div>
                    <h3 className="text-[24px] font-semibold mb-1 text-white">Built-In Classroom</h3>
                    <p className="opacity-60">No Zoom link to hunt for, no meeting ID typed wrong. Open Kanvise, and class is already there.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="w-10 h-10 rounded-full border border-[var(--kv-ruddy-brown)] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[var(--kv-ruddy-brown)]">bolt</span>
                  </div>
                  <div>
                    <h3 className="text-[24px] font-semibold mb-1 text-white">Instant Results</h3>
                    <p className="opacity-60">Submit a mock, see the score right away. No more waiting days to find out how you did.</p>
                  </div>
                </li>
              </ul>}*/}
            </div>
          </div>
        </AnimatedSection>
      </section>

      {/* Imagine a Better Way (Real Mockups) */}
      <section className="py-24 px-6 md:px-12 max-w-[1120px] mx-auto">
        <h2 className="text-[32px] font-semibold text-center mb-20 italic">Imagine a better way...</h2>
        
        <div className="space-y-24">
          
          {/* 1. Receive Payments */}
          <AnimatedSection className="flex flex-col md:flex-row items-center gap-12">
            <PaymentsMockup />
            <div className="w-full md:w-1/2">
              <h4 className="font-semibold text-primary mb-2">Payments & Access</h4>
              <h3 className="text-[24px] font-semibold mb-3">Frictionless onboarding</h3>
              <p className="text-on-surface-variant">Money flows directly to the tutor, unlocking course access instantly without manual DMs or requesting bank transfer screenshots.</p>
            </div>
          </AnimatedSection>

          {/* 2. Schedule Classes */}
          <AnimatedSection className="flex flex-col md:flex-row-reverse items-center gap-12">
            <ScheduleMockup />
            <div className="w-full md:w-1/2">
              <h4 className="font-semibold text-primary mb-2">Automated Scheduling</h4>
              <h3 className="text-[24px] font-semibold mb-3">Set it and forget it</h3>
              <p className="text-on-surface-variant">Schedule a class once and Kanvise automatically handles the reminders. No more manually messaging the WhatsApp group to remind students.</p>
            </div>
          </AnimatedSection>

          {/* 3. Mock Exams */}
          <AnimatedSection className="flex flex-col md:flex-row items-center gap-12">
            <MockExamsMockup />
            <div className="w-full md:w-1/2">
              <h4 className="font-semibold text-primary mb-2">Mock Exams</h4>
              <h3 className="text-[24px] font-semibold mb-3">Mocks that grade themselves</h3>
              <p className="text-on-surface-variant">Set a mock to publish at the right time. The second a student submits, their score is ready. Effortless creation meets instant, closed-loop feedback.</p>
            </div>
          </AnimatedSection>

          {/* 4. Live Classes & Auto Attendance */}
          <AnimatedSection className="flex flex-col md:flex-row-reverse items-center gap-12">
            <LiveClassesMockup />
            <div className="w-full md:w-1/2">
              <h4 className="font-semibold text-primary mb-2">Live Classrooms</h4>
              <h3 className="text-[24px] font-semibold mb-3">No more roll call</h3>
              <p className="text-on-surface-variant">An active, highly-engaged teaching environment where the whiteboard is front-and-center, and roll-call happens automatically in the background.</p>
            </div>
          </AnimatedSection>

          {/* 5. Teaching Materials */}
          <AnimatedSection className="flex flex-col md:flex-row items-center gap-12">
            <MaterialsMockup />
            <div className="w-full md:w-1/2">
              <h4 className="font-semibold text-primary mb-2">Organization</h4>
              <h3 className="text-[24px] font-semibold mb-3">A clean, centralized library</h3>
              <p className="text-on-surface-variant">Moving away from chaotic chat histories and scattered Google Drive links into a structured, tactile learning environment for your PDFs and slides.</p>
            </div>
          </AnimatedSection>

        </div>
      </section>

      {/* Help Us Build (Sticky Note) */}
      <section className="py-20 px-6 md:px-12 bg-surface-container flex justify-center" id="suggest">
        <AnimatedSection className="max-w-xl w-full sticky-note p-10 md:p-16 rounded-sm">
          <h3 className="text-[24px] font-semibold mb-4">What&apos;s missing?</h3>
          <p className="mb-8 text-on-surface-variant">We&apos;re building for you. Tell us the feature that would save you 5 hours a week.</p>
          <textarea 
            className="w-full bg-transparent border-b-2 border-on-surface/20 border-t-0 border-l-0 border-r-0 focus:ring-0 focus:border-primary min-h-[120px] text-[18px] outline-none" 
            placeholder="Type your idea here..."
            value={suggestionText}
            onChange={(e) => setSuggestionText(e.target.value)}
            disabled={suggestionStatus === "loading"}
          ></textarea>
          
          <div className="mt-8 flex justify-between items-center">
            <span className="text-[14px] font-medium">
              {suggestionStatus === "success" && <span className="text-green-700">Thank you! Added to our roadmap.</span>}
              {suggestionStatus === "error" && <span className="text-red-600">Failed to send. Try again.</span>}
            </span>
            <button 
              onClick={handleSuggestionSubmit}
              disabled={suggestionStatus === "loading" || !suggestionText.trim()}
              className="px-8 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {suggestionStatus === "loading" ? "Sending..." : "Send Suggestion"}
            </button>
          </div>
        </AnimatedSection>
      </section>

      {/* Building in Public (Timeline) */}
      <section className="py-20 px-6 md:px-12 max-w-[1120px] mx-auto" id="timeline">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
          <div>
            <h2 className="text-[32px] font-semibold italic mb-2">Building in Public</h2>
            <p className="text-on-surface-variant">Our journey from dorm room to tutorial OS.</p>
          </div>
          <div className="flex gap-12">
            <div className="text-center">
              <span className="block text-[32px] font-bold text-primary">{tutorsCount}</span>
              <span className="text-[13px] opacity-60">Tutors Interviewed</span>
            </div>
            <div className="text-center">
              <span className="block text-[32px] font-bold text-primary">85%</span>
              <span className="text-[13px] opacity-60">Code Progress</span>
            </div>
          </div>
        </div>
        <div className="space-y-12">
          <AnimatedSection className="flex gap-8 items-start">
            <div className="w-24 shrink-0 font-semibold text-on-surface-variant pt-1 text-right">MAY 2026</div>
            <div className="pb-12 border-l border-outline-variant pl-8 relative">
              <div className="absolute w-3 h-3 bg-primary rounded-full -left-[6.5px] top-2"></div>
              <h4 className="text-[20px] font-semibold mb-2">The First Sieve</h4>
              <p className="text-on-surface-variant">Interviews with 50+ university tutors to find the biggest pain points. Group chats were the undisputed villain.</p>
            </div>
          </AnimatedSection>
          <AnimatedSection delay={200} className="flex gap-8 items-start">
            <div className="w-24 shrink-0 font-semibold text-on-surface-variant pt-1 text-right">JUN 2026</div>
            <div className="pb-12 border-l border-outline-variant pl-8 relative">
              <div className="absolute w-3 h-3 bg-[#8a7269] rounded-full -left-[6.5px] top-2"></div>
              <h4 className="text-[20px] font-semibold mb-2">Architecture Locked</h4>
              <p className="text-on-surface-variant">Database designed for scale. First interactive wireframes tested with our waitlist alpha group.</p>
            </div>
          </AnimatedSection>
          <AnimatedSection delay={400} className="flex gap-8 items-start">
            <div className="w-24 shrink-0 font-semibold text-on-surface-variant pt-1 text-right italic">AUG 1, 2026</div>
            <div className="pb-12 pl-8 relative">
              <div className="absolute w-3 h-3 bg-[var(--kv-ruddy-brown)] rounded-full -left-[6.5px] top-2 animate-pulse"></div>
              <h4 className="text-[20px] font-semibold mb-2 text-[var(--kv-ruddy-brown)]">Private Beta Launch</h4>
              <p className="text-on-surface-variant">Limited rollout for the first 100 people on the waitlist. Be one of them.</p>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Join the Waitlist Form */}
      <section className="py-20 px-6 md:px-12 max-w-[1120px] mx-auto" id="waitlist">
        <AnimatedSection className="bg-surface-container-high rounded-3xl p-10 md:p-20 text-center desk-mockup-shadow">
          <h2 className="text-[36px] md:text-[48px] font-bold mb-4">Join the movement.</h2>
          <p className="text-[18px] text-on-surface-variant mb-12 max-w-lg mx-auto">Sign up to be notified when Kanvise officially launches. Want early access? Opt into our private beta starting August 1st below.</p>
          <form className="max-w-md mx-auto grid grid-cols-1 gap-6" onSubmit={handleWaitlistSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <input name="contact_name" value={waitlistData.contact_name} onChange={(e) => setWaitlistData({...waitlistData, contact_name: e.target.value})} className="w-full px-6 py-4 rounded-xl border border-outline-variant focus:ring-2 focus:ring-primary focus:border-transparent bg-white outline-none" placeholder="Full Name *" required type="text" />
              <input name="contact_email" value={waitlistData.contact_email} onChange={(e) => setWaitlistData({...waitlistData, contact_email: e.target.value})} className="w-full px-6 py-4 rounded-xl border border-outline-variant focus:ring-2 focus:ring-primary focus:border-transparent bg-white outline-none" placeholder="Email Address *" required type="email" />
            </div>
            <input name="centre_name" value={waitlistData.centre_name} onChange={(e) => setWaitlistData({...waitlistData, centre_name: e.target.value})} className="w-full px-6 py-4 rounded-xl border border-outline-variant focus:ring-2 focus:ring-primary focus:border-transparent bg-white outline-none" placeholder="Tutorial Centre Name *" required type="text" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <input name="contact_phone" value={waitlistData.contact_phone} onChange={(e) => setWaitlistData({...waitlistData, contact_phone: e.target.value})} className="w-full px-6 py-4 rounded-xl border border-outline-variant focus:ring-2 focus:ring-primary focus:border-transparent bg-white outline-none" placeholder="Phone Number" type="tel" />
              <input name="estimated_student_count" value={waitlistData.estimated_student_count} onChange={(e) => setWaitlistData({...waitlistData, estimated_student_count: e.target.value})} className="w-full px-6 py-4 rounded-xl border border-outline-variant focus:ring-2 focus:ring-primary focus:border-transparent bg-white outline-none" placeholder="Estimated Students" type="number" />
            </div>
            
            <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-outline-variant text-left">
              <input 
                type="checkbox" 
                id="wants_beta" 
                checked={waitlistData.wants_beta_testing}
                onChange={(e) => setWaitlistData({...waitlistData, wants_beta_testing: e.target.checked})}
                className="w-5 h-5 accent-primary cursor-pointer"
              />
              <label htmlFor="wants_beta" className="text-[14px] text-on-surface-variant cursor-pointer select-none">
                I&apos;m interested in being part of the private beta testing group.
              </label>
            </div>

            {waitlistSubmitStatus === "success" && (
              <div className="p-4 bg-green-50 text-green-700 rounded-xl font-medium border border-green-200">
                You&apos;re on the list! Keep an eye on your email.
              </div>
            )}
            {waitlistSubmitStatus === "conflict" && (
              <div className="p-4 bg-blue-50 text-primary rounded-xl font-medium border border-blue-200">
                You&apos;ve already joined the waitlist! We&apos;ll be in touch.
              </div>
            )}
            {waitlistSubmitStatus === "error" && (
              <div className="p-4 bg-red-50 text-red-600 rounded-xl font-medium border border-red-200">
                Oops, something went wrong. Please try again.
              </div>
            )}

            <button 
              type="submit"
              disabled={waitlistSubmitStatus === "loading" || waitlistSubmitStatus === "success"}
              className="w-full py-5 bg-[#C26627] text-white font-semibold text-[18px] rounded-xl desk-mockup-shadow active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100" 
            >
              {waitlistSubmitStatus === "loading" ? "Joining..." : waitlistSubmitStatus === "success" ? "Joined!" : "Join Waitlist"}
            </button>
          </form>
        </AnimatedSection>
      </section>

      {/* Follow the Journey */}
      <section className="py-20 px-6 md:px-12 max-w-[1120px] mx-auto text-center">
        <h2 className="text-[32px] font-semibold mb-4">Follow the Journey</h2>
        <p className="text-[18px] text-on-surface-variant max-w-2xl mx-auto mb-12">
          Rather than simply building behind closed doors, we invite you to continue building Kanvise with us. Follow along as we share our wins, mistakes, product decisions, and progress publicly.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a className="aspect-square bg-surface border border-outline-variant flex flex-col items-center justify-center gap-4 hover:bg-[#241915] hover:text-white transition-all group rounded-xl" href="https://x.com/Join_kanvise" target="_blank" rel="noopener noreferrer">
            <span className="material-symbols-outlined text-[32px]">share</span>
            <span className="font-semibold">X / Twitter</span>
          </a>
          <a className="aspect-square bg-surface border border-outline-variant flex flex-col items-center justify-center gap-4 hover:bg-[#241915] hover:text-white transition-all group rounded-xl" href="https://www.instagram.com/kanvisetechnologies/" target="_blank" rel="noopener noreferrer">
            <span className="material-symbols-outlined text-[32px]">photo_camera</span>
            <span className="font-semibold">Instagram</span>
          </a>
          <a className="aspect-square bg-surface border border-outline-variant flex flex-col items-center justify-center gap-4 hover:bg-[#241915] hover:text-white transition-all group rounded-xl" href="https://web.facebook.com/joinkanvise" target="_blank" rel="noopener noreferrer">
            <span className="material-symbols-outlined text-[32px]">group</span>
            <span className="font-semibold">Facebook</span>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full py-20 px-6 md:px-12 max-w-[1120px] mx-auto border-t border-outline-variant">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-[24px] font-bold text-primary mb-4 md:mb-0">Kanvise</div>
          <p className="text-on-surface-variant order-last md:order-none">© 2026 Kanvise. Built by University Students</p>
          <div className="flex gap-6 mb-4 md:mb-0">
            <a className="text-on-surface-variant hover:text-primary transition-colors" href="mailto:info@kanvise.com">info@kanvise.com</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
