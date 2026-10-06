"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CirclePlay,
  FileText,
  Lightbulb,
  Sparkles,
  TrendingDown,
  Upload,
  WandSparkles,
} from "lucide-react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import LandingAnalytics from "@/components/landing/LandingAnalytics";
import { trackLandingEvent } from "@/lib/landing-analytics";

type BrandIconProps = { className?: string; size?: number };

function ZoomBrandIcon({ className, size = 22 }: BrandIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
    >
      <rect x="2" y="2" width="20" height="20" rx="5" fill="#2D8CFF" />
      <rect x="5.25" y="7" width="9.5" height="10" rx="2.2" fill="white" />
      <path
        d="m14.25 10 4.5-2.25v8.5L14.25 14Z"
        fill="white"
        stroke="white"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WhatsAppBrandIcon({ className, size = 22 }: BrandIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
    >
      <circle cx="12" cy="12" r="10" fill="#25D366" />
      <path
        d="M7.8 17.2 8.5 15a6.1 6.1 0 1 1 2.2 2.1l-2.9.1Z"
        stroke="white"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M10 9.1c.2 2 1.8 3.8 3.9 4.5"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DriveBrandIcon({ className, size = 22 }: BrandIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
    >
      <path d="M9 3h6l6 10h-6Z" fill="#FBBC04" />
      <path d="m9 3 3 5-6 10H1Z" fill="#0F9D58" />
      <path d="M6 18h12l3-5H9Z" fill="#4285F4" />
    </svg>
  );
}

function FormsBrandIcon({ className, size = 22 }: BrandIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
    >
      <path d="M5 2h10l4 4v16H5Z" fill="#7248B9" />
      <path d="M15 2v5h4" fill="#A47DDE" />
      <circle cx="9" cy="11" r="1" fill="white" />
      <circle cx="9" cy="15" r="1" fill="white" />
      <path
        d="M12 11h4M12 15h4"
        stroke="white"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PaystackBrandIcon({ className, size = 22 }: BrandIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
    >
      <rect x="3" y="4" width="18" height="3" rx="1.5" fill="#09A5DB" />
      <rect x="3" y="9" width="15" height="3" rx="1.5" fill="#09A5DB" />
      <rect x="3" y="14" width="11" height="3" rx="1.5" fill="#09A5DB" />
      <rect x="3" y="19" width="7" height="2" rx="1" fill="#09A5DB" />
    </svg>
  );
}

function SheetsBrandIcon({ className, size = 22 }: BrandIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
    >
      <path d="M5 2h10l4 4v16H5Z" fill="#0F9D58" />
      <path d="M15 2v5h4" fill="#87CEAC" />
      <path d="M8 10h8v7H8Zm0 3.5h8M12 10v7" stroke="white" strokeWidth="1.2" />
    </svg>
  );
}

function CalendarBrandIcon({ className, size = 22 }: BrandIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
    >
      <rect x="3" y="3" width="18" height="18" rx="3" fill="#4285F4" />
      <path d="M3 8h18V6a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3Z" fill="#EA4335" />
      <path d="M17 21h1a3 3 0 0 0 3-3v-4Z" fill="#34A853" />
      <path d="M3 15v3a3 3 0 0 0 3 3h2Z" fill="#FBBC04" />
      <text
        x="12"
        y="17"
        textAnchor="middle"
        fontSize="8"
        fontWeight="700"
        fill="white"
      >
        31
      </text>
    </svg>
  );
}

const tools = [
  {
    name: "Zoom",
    detail: "Live teaching",
    icon: ZoomBrandIcon,
    position: "left-[7%] top-[23%]",
    tooltip: "left-full ml-3 top-1/2 -translate-y-1/2",
  },
  {
    name: "WhatsApp",
    detail: "Student communication",
    icon: WhatsAppBrandIcon,
    position: "left-[46%] top-[3%]",
    tooltip: "left-1/2 top-full mt-3 -translate-x-1/2",
  },
  {
    name: "Google Drive",
    detail: "Materials and recordings",
    icon: DriveBrandIcon,
    position: "right-[7%] top-[18%]",
    tooltip: "right-full mr-3 top-1/2 -translate-y-1/2",
  },
  {
    name: "Google Forms",
    detail: "Quizzes and responses",
    icon: FormsBrandIcon,
    position: "right-[1%] top-[46%]",
    tooltip: "right-full mr-3 top-1/2 -translate-y-1/2",
  },
  {
    name: "Paystack",
    detail: "Payment collection",
    icon: PaystackBrandIcon,
    position: "left-[12%] top-[70%]",
    tooltip: "left-full ml-3 top-1/2 -translate-y-1/2",
  },
  {
    name: "Google Sheets",
    detail: "Student and result tracking",
    icon: SheetsBrandIcon,
    position: "left-[1%] top-[46%]",
    tooltip: "left-full ml-3 top-1/2 -translate-y-1/2",
  },
  {
    name: "Google Calendar",
    detail: "Class scheduling",
    icon: CalendarBrandIcon,
    position: "right-[12%] top-[70%]",
    tooltip: "right-full mr-3 top-1/2 -translate-y-1/2",
  },
] as const;

const features = [
  {
    number: "01",
    name: "Live classes",
    verb: "Teach",
    headline: "Teach live with everything in one classroom.",
    copy: "Bring video, whiteboard teaching, screen sharing, lesson materials, chat, polls and quick knowledge checks into one live class. Keep attendance, recordings and recaps connected to every session.",
    accent: "#C26627",
    type: "live",
  },
  {
    number: "02",
    name: "Student management",
    verb: "Manage",
    headline: "Students, classes and enrolment in one place.",
    copy: "See who belongs to each class, their information and the activity that matters in one place.",
    accent: "#2E2877",
    type: "students",
  },
  {
    number: "03",
    name: "Materials",
    verb: "Share",
    headline: "Share materials in the right context.",
    copy: "Keep notes, videos and recordings inside the class and subject they belong to.",
    accent: "#C26627",
    type: "materials",
  },
  {
    number: "04",
    name: "Assignments",
    verb: "Assign",
    headline: "Give work. Receive it. Respond.",
    copy: "Create an assignment, collect every submission and return feedback without chasing files in chat.",
    accent: "#2E2877",
    type: "assignments",
  },
  {
    number: "05",
    name: "Quizzes & mocks",
    verb: "Assess",
    headline: "Create, publish and grade automatically.",
    copy: "Run quick quizzes or full mocks, then see the results without marking every answer by hand.",
    accent: "#C26627",
    type: "quiz",
  },
  {
    number: "06",
    name: "Attendance",
    verb: "Attendance",
    headline: "Know who showed up.",
    copy: "Attendance is tied to the actual class session and the student record, ready for follow-up.",
    accent: "#2E2877",
    type: "attendance",
  },
  {
    number: "07",
    name: "Payments",
    verb: "Collect",
    headline: "Know what has been paid and what is still outstanding.",
    copy: "Keep payment and enrolment status connected to the right student and class.",
    accent: "#C26627",
    type: "payments",
  },
  {
    number: "08",
    name: "Student performance",
    verb: "Act early",
    headline: "Spot struggling students early.",
    copy: "Bring scores, attendance and participation together so tutors can step in before a difficulty becomes a lasting setback.",
    accent: "#2E2877",
    type: "performance",
  },
] as const;

const faqs = [
  [
    "What exactly is Kanvise?",
    "Kanvise is a connected workspace for running online tutoring: live classes, students, materials, assignments, quizzes, attendance, payments and performance intelligence.",
  ],
  [
    "Who is Kanvise built for?",
    "Independent tutors, one-on-one tutors and tutorial centres that want to teach online without stitching together several disconnected tools.",
  ],
  [
    "Is Kanvise just another video-class platform?",
    "No. Live teaching is one part of the story. Kanvise keeps what happens before, during and after class connected so tutors can understand and support students.",
  ],
  [
    "What does the AI actually do?",
    "During a class, it can suggest a knowledge-check question from the teaching context. Across assessments, it can help surface recurring difficulty and a useful next action for the tutor.",
  ],
  [
    "Why join the waitlist now?",
    "Access is opening in small batches. Early tutors get closer access to the team and help shape the workflows before wider release.",
  ],
  [
    "Does joining the waitlist cost anything?",
    "No. Joining is free and does not commit you to a paid plan.",
  ],
] as const;

function InstagramBrandIcon({ className, size = 16 }: BrandIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LinkedInBrandIcon({ className, size = 16 }: BrandIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
    >
      <path d="M5.2 7.8H2.1V21h3.1V7.8ZM3.65 2A1.82 1.82 0 1 0 3.6 5.64 1.82 1.82 0 0 0 3.65 2ZM21.9 13.4c0-4-2.14-5.86-5-5.86a4.31 4.31 0 0 0-3.9 2.14V7.84H9.9V21H13v-6.52c0-1.72.33-3.39 2.46-3.39 2.1 0 2.13 1.96 2.13 3.5V21h3.12l1.19-7.6Z" />
    </svg>
  );
}

function XBrandIcon({ className, size = 16 }: BrandIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
    >
      <path d="M18.9 2H22l-6.77 7.74L23.2 22h-6.24l-4.89-6.39L6.48 22H3.36l7.26-8.3L2.98 2h6.4l4.42 5.84L18.9 2Zm-1.1 17.84h1.72L8.44 4.05H6.6L17.8 19.84Z" />
    </svg>
  );
}


function FacebookBrandIcon({ className, size = 16 }: BrandIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
    >
      <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
    </svg>
  );
}

function TikTokBrandIcon({ className, size = 16 }: BrandIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
    >
      <path d="M14.5 2h3.1A5.2 5.2 0 0 0 22 6.4v3.1a8.2 8.2 0 0 1-4.4-1.3v7.1a6.7 6.7 0 1 1-5.8-6.6v3.2a3.55 3.55 0 1 0 2.7 3.45V2Z" />
    </svg>
  );
}

const socialLinks = [
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/company/kanvise",
    icon: LinkedInBrandIcon,
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/joinkanvise",
    icon: FacebookBrandIcon,
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com/joinkanvise/",
    icon: InstagramBrandIcon,
  },
] as const;

function ConfettiBurst() {
  const pieces = Array.from({ length: 34 }, (_, index) => ({
    x: ((index * 37) % 220) - 110,
    y: 110 + ((index * 29) % 100),
    rotate: (index * 53) % 360,
    delay: (index % 9) * 0.045,
    color: ["#C26627", "#2E2877", "#42af84", "#f2bd42", "#d95c86"][index % 5],
  }));

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-0"
    >
      {pieces.map((piece, index) => (
        <i
          key={index}
          className="landing-confetti absolute left-1/2 top-0 h-2.5 w-1.5 rounded-sm"
          style={
            {
              "--confetti-x": `${piece.x}px`,
              "--confetti-y": `${piece.y}px`,
              "--confetti-rotate": `${piece.rotate}deg`,
              "--confetti-delay": `${piece.delay}s`,
              backgroundColor: piece.color,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function ProductShell({
  children,
  title = "Physics · JAMB 2027",
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <div className="overflow-hidden rounded-[1.3rem] border border-[#dcd6eb] bg-white shadow-[0_28px_80px_rgba(31,23,92,.18)]">
      <div className="flex h-9 items-center gap-1.5 border-b border-[#ece8f3] bg-[#faf9fd] px-4">
        <i className="h-2 w-2 rounded-full bg-[#ff8b72]" />
        <i className="h-2 w-2 rounded-full bg-[#ffd36a]" />
        <i className="h-2 w-2 rounded-full bg-[#70d59b]" />
        <span className="ml-3 text-[9px] font-semibold text-[#847d90]">
          {title}
        </span>
      </div>
      <div className="flex min-h-[310px]">
        <aside className="hidden w-[108px] shrink-0 bg-[#2E2877] p-3 text-[8px] text-white/55 sm:block">
          <div className="mb-7 flex items-center gap-1.5 font-bold text-white">
            <span className="grid h-5 w-5 place-items-center rounded-md bg-white/15">
              K
            </span>{" "}
            Kanvise
          </div>
          {["Overview", "Schedule", "Students", "Work", "Performance"].map(
            (item, index) => (
              <p
                key={item}
                className={`mb-2.5 rounded-md px-2 py-1.5 ${index === 0 ? "bg-white/12 text-white" : ""}`}
              >
                {item}
              </p>
            ),
          )}
        </aside>
        <div className="min-w-0 flex-1 bg-[#F7F5F2] p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}

function Row({
  initials,
  title,
  meta,
  state,
  danger = false,
}: {
  initials: string;
  title: string;
  meta: string;
  state: string;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#ebe6f0] bg-white p-3">
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[9px] font-bold ${danger ? "bg-[#fff0ec] text-[#b84d32]" : "bg-[#F7F5F2] text-[#2E2877]"}`}
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <b className="block truncate text-[9px]">{title}</b>
        <span className="block truncate text-[8px] text-[#8a8391]">{meta}</span>
      </div>
      <span
        className={`rounded-full px-2 py-1 text-[8px] font-bold ${danger ? "bg-[#fff0ec] text-[#b84d32]" : "bg-[#edf8f1] text-[#17764a]"}`}
      >
        {state}
      </span>
    </div>
  );
}

function FeatureSurface({ type }: { type: (typeof features)[number]["type"] }) {
  if (type === "live")
    return (
      <ProductShell title="Live class workspace">
        <div className="overflow-hidden rounded-xl border border-[#d8d1e4] bg-white shadow-sm">
          <Image
            src="/landing/kanvise-live-class-workspace-v1.png"
            alt="A tutor leading a video class with a digital whiteboard, student video tiles and class chat"
            width={1672}
            height={941}
            className="h-auto w-full"
            sizes="(min-width: 1024px) 680px, (min-width: 640px) 80vw, 100vw"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[8px] font-bold text-[#2E2877]">
          {["Live video", "Whiteboard & screen share", "Chat & quick checks"].map((capability) => (
            <span key={capability} className="rounded-full bg-[#f0edf6] px-2.5 py-1.5">
              {capability}
            </span>
          ))}
        </div>
      </ProductShell>
    );
  if (type === "students")
    return (
      <ProductShell>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[8px] uppercase tracking-wider text-[#8a8391]">
              18 students
            </p>
            <h4 className="text-base font-bold text-[#2E2877]">
              Your class, beyond a list
            </h4>
          </div>
          <button className="rounded-lg bg-[#2e2877] px-3 py-2 text-[8px] font-bold text-white">
            Add student
          </button>
        </div>
        <div className="mt-4 space-y-2">
          <Row
            initials="DO"
            title="David Okafor"
            meta="Active today · 8/9 classes"
            state="On track"
          />
          <Row
            initials="CE"
            title="Chiamaka Eze"
            meta="Last active yesterday · 6/9 classes"
            state="Needs attention"
            danger
          />
          <Row
            initials="EA"
            title="Emeka Adeyemi"
            meta="Last active 3 days ago · 9/9 classes"
            state="Follow up"
            danger
          />
        </div>
      </ProductShell>
    );
  if (type === "materials")
    return (
      <ProductShell>
        <div className="flex items-center justify-between">
          <h4 className="text-base font-bold text-[#2E2877]">
            Class materials
          </h4>
          <button className="flex items-center gap-1 rounded-lg bg-[#2e2877] px-3 py-2 text-[8px] font-bold text-white">
            <Upload size={10} /> Add material
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            ["Wave interference", "Video · 12:40"],
            ["Mechanics revision", "PDF · 4.2 MB"],
            ["Past questions", "DOCX · 1.8 MB"],
            ["Class recording", "Video · 58:03"],
          ].map(([name, meta], index) => (
            <div
              key={name}
              className="rounded-xl border border-[#e8e3ef] bg-white p-4"
            >
              <span
                className={`grid h-9 w-9 place-items-center rounded-lg ${index % 2 ? "bg-[#fff0e4] text-[#bd5c23]" : "bg-[#F7F5F2] text-[#2E2877]"}`}
              >
                {index === 0 || index === 3 ? (
                  <CirclePlay size={16} />
                ) : (
                  <FileText size={16} />
                )}
              </span>
              <b className="mt-4 block text-[9px]">{name}</b>
              <span className="text-[8px] text-[#8a8391]">{meta}</span>
            </div>
          ))}
        </div>
      </ProductShell>
    );
  if (type === "assignments")
    return (
      <ProductShell>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[8px] text-[#8a8391]">Assignment</p>
            <h4 className="text-base font-bold text-[#2E2877]">
              Forces in everyday motion
            </h4>
          </div>
          <span className="rounded-full bg-[#fff5dd] px-2 py-1 text-[8px] font-bold text-[#936112]">
            Due tomorrow
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            ["Assigned", "18", 100],
            ["Submitted", "14", 78],
            ["Reviewed", "9", 50],
          ].map(([label, value, width]) => (
            <div
              key={String(label)}
              className="rounded-xl border border-[#e9e4ef] bg-white p-3"
            >
              <span className="text-[8px] text-[#847d90]">{label}</span>
              <b className="mt-1 block text-xl text-[#2E2877]">{value}</b>
              <div className="mt-2 h-1 rounded bg-[#eeeaf4]">
                <i
                  className="block h-full rounded bg-[#d79a2b]"
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-xl border border-[#e9e4ef] bg-white p-3">
          <div className="flex items-center justify-between text-[9px]">
            <b>Chiamaka Eze</b>
            <span className="font-bold text-[#2E2877]">Open submission →</span>
          </div>
          <p className="mt-2 text-[8px] text-[#847d90]">
            Submitted 16 minutes ago · 1 PDF attached
          </p>
        </div>
      </ProductShell>
    );
  if (type === "quiz")
    return (
      <ProductShell>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[8px] text-[#8a8391]">Quiz · 10 questions</p>
            <h4 className="text-base font-bold text-[#2E2877]">
              Mechanics check
            </h4>
          </div>
          <span className="rounded-full bg-[#edf8f1] px-2 py-1 text-[8px] font-bold text-[#17764a]">
            Auto-graded
          </span>
        </div>
        <div className="mt-4 rounded-xl border border-[#e8e3ef] bg-white p-4">
          <p className="text-[9px] font-semibold">
            Which law explains why a rocket moves upward as gas is expelled
            downward?
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {["First law", "Second law", "Third law", "Gravitation"].map(
              (answer, i) => (
                <div
                  key={answer}
                  className={`rounded-lg border p-2 text-[8px] ${i === 2 ? "border-[#2E2877] bg-[#F7F5F2] font-bold text-[#2E2877]" : "border-[#ece7f1]"}`}
                >
                  {String.fromCharCode(65 + i)}. {answer}
                </div>
              ),
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-[#2E2877] px-4 py-3 text-white">
          <span className="text-[8px]">16 of 18 submitted</span>
          <b className="text-[8px]">View live results →</b>
        </div>
      </ProductShell>
    );
  if (type === "attendance")
    return (
      <ProductShell>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[8px] text-[#8a8391]">Today · 5:00 PM</p>
            <h4 className="text-base font-bold text-[#2E2877]">
              Physics live class
            </h4>
          </div>
          <span className="text-right">
            <b className="block text-lg text-[#2E2877]">16/18</b>
            <small className="text-[8px] text-[#8a8391]">attended</small>
          </span>
        </div>
        <div className="mt-4 space-y-2">
          <Row
            initials="DO"
            title="David Okafor"
            meta="54 minutes in class"
            state="Present"
          />
          <Row
            initials="EA"
            title="Emeka Adeyemi"
            meta="12 minutes in class"
            state="Left early"
            danger
          />
          <Row
            initials="TB"
            title="Tolu Balogun"
            meta="Did not join"
            state="Absent"
            danger
          />
        </div>
      </ProductShell>
    );
  if (type === "payments")
    return (
      <ProductShell>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[8px] text-[#8a8391]">October collection</p>
            <h4 className="text-base font-bold text-[#2E2877]">
              JAMB 2027 class
            </h4>
          </div>
          <b className="text-lg text-[#2E2877]">₦228,000</b>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            ["Paid", "12"],
            ["Pending", "4"],
            ["Overdue", "2"],
          ].map(([label, value], i) => (
            <div
              key={label}
              className="rounded-xl border border-[#e9e4ef] bg-white p-3"
            >
              <span className="text-[8px] text-[#847d90]">{label}</span>
              <b
                className={`mt-1 block text-xl ${i === 2 ? "text-[#b94d31]" : "text-[#2E2877]"}`}
              >
                {value}
              </b>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-xl bg-[#eefaf7] p-4">
          <p className="flex items-center gap-2 text-[9px] font-bold text-[#176c5c]">
            <Check size={12} /> Payment confirmed for Chiamaka Eze
          </p>
          <p className="mt-1 text-[8px] text-[#5d7b75]">
            Her enrolment record has been updated automatically.
          </p>
        </div>
      </ProductShell>
    );
  return (
    <ProductShell>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[8px] text-[#8a8391]">Class health</p>
          <h4 className="text-base font-bold text-[#2E2877]">Who needs you?</h4>
        </div>
        <span className="rounded-full bg-[#fff0ec] px-2 py-1 text-[8px] font-bold text-[#b74c31]">
          4 need attention
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[.85fr_1.15fr]">
        <div className="rounded-xl bg-[#2E2877] p-4 text-white">
          <span className="text-[8px] text-white/55">Topic performance</span>
          {[
            ["Mechanics", 82],
            ["Electricity", 67],
            ["Waves", 49],
          ].map(([topic, value]) => (
            <div key={topic} className="mt-4">
              <div className="flex justify-between text-[8px]">
                <span>{topic}</span>
                <b>{value}%</b>
              </div>
              <div className="mt-1 h-1 rounded bg-white/15">
                <i
                  className={`block h-full rounded ${Number(value) < 55 ? "bg-[#C26627]" : "bg-[#C2B59B]"}`}
                  style={{ width: `${value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <Row
            initials="DO"
            title="David"
            meta="Declining across 3 assessments"
            state="Review"
            danger
          />
          <Row
            initials="CE"
            title="Chiamaka"
            meta="Repeated errors in Waves"
            state="Review"
            danger
          />
          <Row
            initials="TB"
            title="Tolu"
            meta="2 missing assessments"
            state="Follow up"
            danger
          />
        </div>
      </div>
    </ProductShell>
  );
}

export default function ModernLanding() {
  const [activeTool, setActiveTool] = useState<number | null>(0);
  const exploredTools = useRef(new Set<number>());
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    type: "Independent tutor",
  });
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [waitlistPosition, setWaitlistPosition] = useState<number | null>(null);
  const [alreadyJoined, setAlreadyJoined] = useState(false);
  const formStarted = useRef(false);

  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>("[data-landing-reveal]"),
    );
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reducedMotion || !("IntersectionObserver" in window)) {
      elements.forEach((element) => {
        element.dataset.visible = "true";
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          (entry.target as HTMLElement).dataset.visible = "true";
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -7% 0px" },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  function selectTool(index: number) {
    setActiveTool(index);
    if (!exploredTools.current.has(index)) {
      exploredTools.current.add(index);
      trackLandingEvent("tool_explored", { tool: tools[index].name });
    }
  }

  function startForm() {
    if (formStarted.current) return;
    formStarted.current = true;
    trackLandingEvent("waitlist_form_started");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus("loading");
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_name: form.name,
          contact_email: form.email,
          centre_name:
            form.type === "Tutorial centre"
              ? "Tutorial centre"
              : `${form.type}: ${form.name}`,
          wants_beta_testing: true,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        position?: number;
        already_joined?: boolean;
      };
      if (response.ok || response.status === 409) {
        const position =
          typeof payload.position === "number" && payload.position > 0
            ? payload.position
            : 1;
        setWaitlistPosition(position);
        setAlreadyJoined(Boolean(payload.already_joined));
        setStatus("success");
        trackLandingEvent("waitlist_completed", {
          account_type: form.type,
          already_joined: Boolean(payload.already_joined),
        });
      } else setStatus("error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <main className="overflow-x-clip bg-[#F7F5F2] text-[#25202d] selection:bg-[#C26627] selection:text-white">
      <LandingAnalytics />
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#e4e2e1] bg-[#fbf9f8]/92 text-[#2E2877] backdrop-blur-xl">
        <nav className="mx-auto flex h-[68px] max-w-[1240px] items-center justify-between px-5 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-sm font-bold"
          >
            <img
              src="/kanvise_logo.jpeg"
              alt=""
              className="h-8 w-8 rounded border border-[#C2B59B]/60 object-cover"
            />
            Kanvise
          </Link>
          <div className="flex items-center gap-5 text-xs font-semibold">
            <a
              href="#workspace"
              onClick={() =>
                trackLandingEvent("product_cta_clicked", {
                  action: "view_demo",
                  location: "header",
                })
              }
              className="hidden text-[#474551] hover:text-[#2E2877] sm:block"
            >
              DEMO
            </a>
            <a
              href="#faq"
              className="hidden text-[#474551] hover:text-[#2E2877] sm:block"
            >
              FAQs
            </a>
            <a
              href="#access"
              onClick={() =>
                trackLandingEvent("waitlist_cta_clicked", {
                  location: "header",
                })
              }
              className="rounded-full bg-[#C26627] px-4 py-2.5 text-white shadow-[0_8px_24px_rgba(194,102,39,.3)]"
            >
              Reserve your spot <ArrowRight className="ml-1 inline" size={13} />
            </a>
          </div>
        </nav>
      </header>

      <section
        data-analytics-section="hero"
        className="relative overflow-hidden bg-[#fbf9f8] pb-20 pt-24 text-[#3C3027] sm:pt-28 lg:min-h-[900px] lg:pb-28 lg:pt-36"
      >
        <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_75%_20%,rgba(46,40,119,.12)_0,transparent_34%),radial-gradient(circle_at_12%_88%,rgba(194,102,39,.08)_0,transparent_28%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[.05] [background-image:linear-gradient(rgba(46,40,119,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(46,40,119,.7)_1px,transparent_1px)] [background-size:64px_64px]" />
        <div className="relative mx-auto grid max-w-[1240px] gap-7 px-5 sm:gap-12 lg:grid-cols-[.78fr_1.22fr] lg:items-center lg:gap-14 lg:px-8">
          <div data-landing-reveal className="landing-reveal relative z-10">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#C2B59B]/55 bg-white px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[.12em] text-[#2E2877] shadow-sm sm:text-[10px] sm:tracking-[.14em]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C26627]" /> For
              independent tutors and tutorial centres
            </p>
            <h1 className="mt-5 max-w-[640px] text-[2.1rem] font-medium leading-[1.05] tracking-[-.04em] sm:mt-6 sm:text-[2.75rem] lg:text-[3.25rem]">
              Running one tutorial shouldn&apos;t take{" "}
              <span className="text-[#C26627]">seven tools.</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-6 text-[#474551] sm:mt-6 sm:text-lg sm:leading-8">
              <span className="sm:hidden">
                Run your classes and see which students need your attention.
              </span>
              <span className="hidden sm:inline">
                Kanvise brings live classes, students, materials, assignments,
                quizzes, payments and performance into one place. Tutors can see
                who needs attention before a student falls behind.
              </span>
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row">
              <a
                href="#access"
                onClick={() =>
                  trackLandingEvent("hero_cta_clicked", {
                    location: "hero",
                  })
                }
                className="group inline-flex items-center justify-center rounded-full bg-[#C26627] px-6 py-3.5 text-sm font-bold text-white shadow-[0_14px_34px_rgba(194,102,39,.28)] transition hover:-translate-y-1"
              >
                Reserve your spot{" "}
                <ArrowRight
                  className="ml-2 transition group-hover:translate-x-1"
                  size={16}
                />
              </a>
              <a
                href="#workspace"
                onClick={() =>
                  trackLandingEvent("product_cta_clicked", {
                    action: "view_demo",
                  })
                }
                className="inline-flex items-center justify-center py-2 text-sm font-bold text-[#2E2877] sm:rounded-full sm:border sm:border-[#C2B59B]/70 sm:bg-white sm:px-6 sm:py-3.5 sm:hover:bg-[#F7F5F2]"
              >
                DEMO <ArrowRight className="ml-2" size={15} />
              </a>
            </div>
            <p className="mt-2 text-[10px] text-[#474551]/65 sm:mt-4 sm:text-xs">
              Free to join · Access opens in small batches
            </p>
          </div>
          <div
            data-landing-reveal
            className="landing-reveal landing-reveal-delay-1 relative mx-auto h-[430px] w-full max-w-[700px] sm:h-[570px]"
          >
            <div className="landing-pulse-glow absolute inset-[8%_2%_12%] rounded-[42%] bg-[#C2B59B]/35 blur-3xl" />
            <div className="landing-tutor-visual absolute inset-x-[2%] bottom-[13%] top-[12%] z-10 overflow-hidden rounded-[2rem] border border-[#C2B59B]/60 bg-[linear-gradient(145deg,#2E2877,#C2B59B)] shadow-[0_24px_70px_rgba(46,40,119,.18)]">
              <Image
                priority
                src="/landing/kanvise-tutor-overwhelmed-v1.png"
                alt="An online tutor overwhelmed by disconnected tools"
                fill
                className="object-contain object-bottom"
                sizes="(max-width: 1024px) 85vw, 48vw"
              />
              <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#2E2877] to-transparent" />
            </div>
            <svg
              aria-hidden="true"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible sm:hidden"
            >
              <g
                fill="none"
                stroke="#C26627"
                strokeLinecap="round"
                strokeWidth="0.55"
                opacity="0.58"
              >
                <path d="M10 27 C29 25 44 31 55 42" />
                <path d="M50 7 C54 20 58 30 62 36" />
                <path d="M90 22 C82 27 77 33 74 40" />
                <path d="M96 50 C86 52 81 51 78 49" />
                <path d="M85 74 C79 68 75 64 72 61" />
                <path d="M16 74 C35 70 48 65 57 59" />
                <path d="M5 50 C29 48 45 50 54 52" />
              </g>
              <g fill="#C26627" opacity="0.78">
                <circle cx="55" cy="42" r="0.65" />
                <circle cx="62" cy="36" r="0.65" />
                <circle cx="74" cy="40" r="0.65" />
                <circle cx="78" cy="49" r="0.65" />
                <circle cx="72" cy="61" r="0.65" />
                <circle cx="57" cy="59" r="0.65" />
                <circle cx="54" cy="52" r="0.65" />
              </g>
            </svg>
            <svg
              aria-hidden="true"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 z-20 hidden h-full w-full overflow-visible sm:block"
            >
              <g
                fill="none"
                stroke="#C26627"
                strokeLinecap="round"
                strokeWidth="0.7"
                opacity="0.72"
              >
                <path d="M10 27 C30 20 44 22 57 27" />
                <path d="M50 7 C55 14 59 18 64 20" />
                <path d="M90 22 C82 20 78 23 75 28" />
                <path d="M96 50 C85 49 80 45 78 40" />
                <path d="M85 74 C79 62 76 56 73 53" />
                <path d="M16 74 C36 63 49 52 56 46" />
                <path d="M5 50 C29 48 45 43 55 38" />
              </g>
              <g fill="#C26627" opacity="0.88">
                <circle cx="57" cy="27" r="0.75" />
                <circle cx="64" cy="20" r="0.75" />
                <circle cx="75" cy="28" r="0.75" />
                <circle cx="78" cy="40" r="0.75" />
                <circle cx="73" cy="53" r="0.75" />
                <circle cx="56" cy="46" r="0.75" />
                <circle cx="55" cy="38" r="0.75" />
              </g>
            </svg>
            {tools.map((item, index) => {
              const Icon = item.icon;
              const selected = activeTool === index;
              return (
                <button
                  key={item.name}
                  onClick={() => selectTool(index)}
                  onFocus={() => selectTool(index)}
                  onMouseEnter={() => selectTool(index)}
                  style={{ animationDelay: `${index * 0.16}s` }}
                  aria-label={`${item.name}: ${item.detail}`}
                  className={`group landing-tool-float absolute z-30 ${item.position} grid h-12 w-12 place-items-center rounded-xl border bg-white text-[#2E2877] shadow-[0_10px_28px_rgba(46,40,119,.16)] transition duration-300 hover:-translate-y-1 ${selected ? "scale-105 border-[#C26627] ring-2 ring-[#C26627]/15" : "border-[#C2B59B]/55"}`}
                >
                  <Icon size={23} />
                  <span
                    className={`pointer-events-none absolute z-40 min-w-[150px] rounded-xl border border-[#C2B59B]/55 bg-white p-2.5 text-left shadow-[0_12px_30px_rgba(46,40,119,.16)] transition duration-200 ${item.tooltip} ${selected ? "visible opacity-100" : "invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100"}`}
                  >
                    <b className="block text-[10px] text-[#2E2877]">
                      {item.name}
                    </b>
                    <small className="mt-0.5 block text-[8px] leading-3 text-[#3C3027]/70">
                      {item.detail}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="relative mx-auto mt-8 grid max-w-[900px] grid-cols-3 divide-x divide-[#C2B59B]/45 border-y border-[#C2B59B]/45 px-5 py-5 text-center sm:mt-14">
          <div>
            <b className="text-2xl text-[#C26627]">7</b>
            <span className="mt-1 block text-[8px] uppercase tracking-widest text-[#474551]/65">
              separate tools
            </span>
          </div>
          <div>
            <b className="text-2xl">6+</b>
            <span className="mt-1 block text-[8px] uppercase tracking-widest text-[#474551]/65">
              manual handoffs
            </span>
          </div>
          <div>
            <b className="text-2xl">0</b>
            <span className="mt-1 block text-[8px] uppercase tracking-widest text-[#474551]/65">
              connected picture
            </span>
          </div>
        </div>
      </section>

      <section
        aria-label="Seven tools become one workspace"
        className="relative z-10 -mt-8 px-5"
      >
        <div
          data-landing-reveal
          className="landing-reveal mx-auto max-w-[1040px] overflow-hidden rounded-[1.6rem] border border-[#dcd5e8] bg-white px-5 py-6 shadow-[0_24px_70px_rgba(31,23,92,.14)] sm:px-8"
        >
          <div className="flex flex-col items-center justify-center gap-5 sm:flex-row">
            <div className="flex max-w-[440px] flex-wrap items-center justify-center gap-2">
              {tools.map((tool, index) => {
                const Icon = tool.icon;
                return (
                  <span
                    key={tool.name}
                    className="landing-converge-chip inline-flex items-center gap-1.5 rounded-full border border-[#e1dbea] bg-[#F7F5F2] px-3 py-2 text-[9px] font-bold text-[#62596d]"
                    style={{ animationDelay: `${index * 0.12}s` }}
                  >
                    <Icon size={12} className="text-[#2E2877]" /> {tool.name}
                  </span>
                );
              })}
            </div>
            <ArrowRight className="rotate-90 text-[#C26627] sm:rotate-0" />
            <div className="landing-kanvise-reveal flex items-center gap-3 rounded-2xl bg-[#2E2877] px-5 py-4 text-white shadow-[0_15px_35px_rgba(33,25,104,.25)]">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-white">
                <Image src="/kanvise_logo.jpeg" alt="" width={24} height={24} />
              </span>
              <span>
                <b className="block text-sm">Kanvise</b>
                <small className="text-[9px] text-white/60">
                  One tutoring workspace
                </small>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section
        id="workspace"
        data-analytics-section="workspace"
        className="relative overflow-hidden pb-10 pt-20 sm:pb-12 sm:pt-24"
      >
        <div className="pointer-events-none absolute -right-48 top-0 h-[500px] w-[500px] rounded-full bg-[#F7F5F2] blur-3xl" />
        <div className="relative mx-auto max-w-[1240px] px-5 lg:px-8">
          <div
            data-landing-reveal
            className="landing-reveal mx-auto max-w-3xl text-center"
          >
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#C26627]">
              All of that work. One workspace.
            </p>
            <h2 className="mt-4 text-[1.8rem] font-medium leading-[1.1] tracking-[-.035em] text-[#2E2877] sm:text-[2.75rem]">
              Everything around the class now works together.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#68616e] sm:text-lg">
              Teach, share, assign, assess and follow up without rebuilding the
              story of each student across different tools.
            </p>
          </div>
          <div className="relative mx-auto mt-14 max-w-[1080px]">
            <div className="absolute -inset-5 rounded-[2.5rem] bg-[linear-gradient(135deg,#C2B59B,#fff0e8)] blur-2xl" />
            <div className="relative rounded-[2rem] border border-[#d9d2e5] bg-white p-2.5 shadow-[0_35px_100px_rgba(34,24,105,.18)] sm:p-4">
              <ProductShell title="Kanvise · Tutor workspace">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[8px] font-semibold uppercase tracking-[.15em] text-[#8e8795]">
                      Good afternoon, Tobi 👋
                    </p>
                    <h3 className="mt-1 text-lg font-bold text-[#2E2877]">
                      Here&apos;s what needs your attention.
                    </h3>
                  </div>
                  <button className="rounded-lg bg-[#2e2877] px-3 py-2 text-[8px] font-bold text-white">
                    Schedule live class
                  </button>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-[#2E2877] p-4 text-white sm:col-span-2">
                    <span className="text-[8px] text-white/55">
                      Next class · 5:00 PM
                    </span>
                    <div className="mt-3 flex items-end justify-between">
                      <div>
                        <b className="block text-sm">Physics · JAMB 2027</b>
                        <span className="text-[8px] text-white/55">
                          Newton&apos;s laws · 18 students
                        </span>
                      </div>
                      <button className="rounded-lg bg-[#C26627] px-3 py-2 text-[8px] font-bold text-white">
                        Open class
                      </button>
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#e9e4ef] bg-white p-4">
                    <span className="text-[8px] text-[#847d90]">
                      Needs attention
                    </span>
                    <b className="mt-2 block text-2xl text-[#2E2877]">4</b>
                    <span className="text-[8px] text-[#b74c31]">
                      2 new signals today
                    </span>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[#e9e4ef] bg-white p-4">
                    <span className="text-[8px] text-[#847d90]">
                      Today&apos;s teaching
                    </span>
                    <div className="mt-3 space-y-2">
                      {["Physics · 5:00 PM", "English · 7:00 PM"].map(
                        (x, i) => (
                          <div
                            key={x}
                            className="flex items-center justify-between rounded-lg bg-[#f7f5fa] p-2 text-[8px]"
                          >
                            <b>{x}</b>
                            <span
                              className={
                                i
                                  ? "text-[#847d90]"
                                  : "font-bold text-[#2E2877]"
                              }
                            >
                              {i ? "Scheduled" : "Ready"}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#e9e4ef] bg-white p-4">
                    <span className="text-[8px] text-[#847d90]">
                      Latest signal
                    </span>
                    <p className="mt-3 text-[9px] font-semibold leading-4">
                      8 students repeatedly struggled with wave interference.
                    </p>
                    <button className="mt-3 text-[8px] font-bold text-[#2E2877]">
                      See the evidence →
                    </button>
                  </div>
                </div>
              </ProductShell>
            </div>
          </div>
        </div>
      </section>

      <section
        data-analytics-section="features"
        className="bg-[#F7F5F2] pb-20 pt-8 sm:pb-24 sm:pt-10"
      >
        <div className="mx-auto max-w-[1240px] px-5 lg:px-8">
          <div
            data-landing-reveal
            className="landing-reveal mx-auto max-w-3xl text-center"
          >
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#C26627]">
              From teaching to understanding
            </p>
            <h2 className="mt-4 text-[1.8rem] font-medium leading-[1.1] tracking-[-.035em] text-[#2E2877] sm:text-[2.75rem]">
              Everything tutors need in one place.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#68616e]">
              Teach, manage students, share materials and assess learning in one
              connected workspace.
            </p>
          </div>
          <div className="mt-16 space-y-8">
            {features.map((feature, index) => (
              <article
                key={feature.number}
                data-analytics-feature={feature.name}
                className="landing-feature-card sticky overflow-hidden rounded-[1.75rem] border border-[#d8d2e3] bg-[#F7F5F2] shadow-[0_24px_70px_rgba(35,26,92,.12)]"
                style={{
                  top: `${84 + Math.min(index, 4) * 7}px`,
                  zIndex: index + 1,
                }}
              >
                <div
                  data-landing-reveal
                  className="landing-feature-grid landing-reveal grid min-h-[540px] sm:min-h-[620px] lg:grid-cols-[.72fr_1.28fr] lg:min-h-[680px]"
                >
                  <div className="landing-feature-copy flex flex-col justify-center p-7 sm:p-10 lg:p-14">
                    <div className="mx-auto w-full max-w-[360px]">
                      <div>
                        <div className="flex items-center gap-3">
                          <span
                            className="text-sm font-bold"
                            style={{ color: feature.accent }}
                          >
                            {feature.number}
                          </span>
                          <span className="h-px w-10 bg-[#d6d0dd]" />
                          <span className="text-[10px] font-bold uppercase tracking-[.18em] text-[#817989]">
                            {feature.verb}
                          </span>
                        </div>
                        <h3 className="mt-8 text-2xl font-medium leading-[1.12] tracking-[-.03em] text-[#2E2877] sm:text-[2.15rem]">
                          {feature.headline}
                        </h3>
                        <p className="mt-5 max-w-md text-sm leading-7 text-[#68616e] sm:text-base">
                          {feature.copy}
                        </p>
                      </div>
                      <div className="mt-10 flex items-center gap-3 text-xs font-bold">
                        <span
                          className="grid h-9 w-9 place-items-center rounded-full text-white"
                          style={{ backgroundColor: feature.accent }}
                        >
                          <ArrowRight size={15} />
                        </span>
                        {feature.name}
                      </div>
                    </div>
                  </div>
                  <div className="landing-feature-visual relative flex items-center justify-center bg-[#F7F5F2] p-4 sm:p-8 lg:p-10">
                    <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(#C2B59B_1px,transparent_1px)] [background-size:20px_20px]" />
                    <div className="relative mx-auto w-full max-w-[680px]">
                      <FeatureSurface type={feature.type} />
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        data-analytics-section="intelligence"
        className="relative overflow-hidden bg-[#2E2877] py-24 text-white sm:py-32"
      >
        <div className="pointer-events-none absolute inset-0 opacity-[.07] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="relative mx-auto max-w-[1240px] px-5 lg:px-8">
          <div
            data-landing-reveal
            className="landing-reveal mx-auto max-w-3xl text-center"
          >
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#C26627]">
              From learning activity to insight
            </p>
            <h2 className="mt-4 text-[1.8rem] font-medium leading-[1.1] tracking-[-.035em] sm:text-[2.75rem]">
              Spot struggling students early.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
              Kanvise uses AI to spot patterns across class responses,
              assessments and participation, so tutors can see who needs support
              and what to do next.
            </p>
          </div>
          <div className="mt-14 grid gap-5 lg:grid-cols-2">
            <div
              data-landing-reveal
              className="landing-reveal rounded-[1.75rem] border border-white/12 bg-white/[.06] p-5 sm:p-7"
            >
              <div className="flex items-start justify-between gap-5">
                <div className="min-w-0">
                  <span className="text-[9px] font-bold uppercase tracking-[.16em] text-[#C26627]">
                    During the class
                  </span>
                  <h3 className="mt-2 text-xl font-bold">
                    A question from what was just taught.
                  </h3>
                </div>
                <WandSparkles className="mt-1 shrink-0 text-[#C26627]" />
              </div>
              <div className="mt-7 rounded-2xl bg-white p-5 text-[#2a2432]">
                <p className="flex items-center gap-2 text-[9px] font-bold text-[#2E2877]">
                  <Sparkles size={13} /> Kanvise suggested a knowledge check
                </p>
                <p className="mt-4 text-sm font-semibold leading-6">
                  A swimmer pushes water backward. Which law explains why they
                  move forward?
                </p>
                <div className="mt-4 space-y-2">
                  {[
                    "Newton’s first law",
                    "Newton’s second law",
                    "Newton’s third law",
                  ].map((answer, i) => (
                    <div
                      key={answer}
                      className={`rounded-lg border p-2.5 text-[9px] ${i === 2 ? "border-[#2E2877] bg-[#F7F5F2] font-bold text-[#2E2877]" : "border-[#e6e0ec]"}`}
                    >
                      {answer}
                    </div>
                  ))}
                </div>
                <button className="mt-4 w-full rounded-lg bg-[#C26627] py-3 text-[9px] font-bold text-white">
                  Send to 18 students
                </button>
              </div>
            </div>
            <div
              data-landing-reveal
              className="landing-reveal landing-reveal-delay-1 rounded-[1.75rem] border border-white/12 bg-white/[.06] p-5 sm:p-7"
            >
              <div className="flex items-start justify-between gap-5">
                <div className="min-w-0">
                  <span className="text-[9px] font-bold uppercase tracking-[.16em] text-[#F7F5F2]">
                    Across their work
                  </span>
                  <h3 className="mt-2 text-xl font-bold">
                    A pattern no single score could show.
                  </h3>
                </div>
                <Lightbulb className="mt-1 shrink-0 text-[#F7F5F2]" />
              </div>
              <div className="mt-7 rounded-2xl bg-white p-5 text-[#2a2432]">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#fff0ec] text-[#c05436]">
                    <TrendingDown size={17} />
                  </span>
                  <div>
                    <p className="text-[9px] font-bold text-[#b6472c]">
                      Repeated difficulty detected
                    </p>
                    <h4 className="mt-1 text-base font-bold text-[#2E2877]">
                      Wave interference · 8 students
                    </h4>
                  </div>
                </div>
                <div className="mt-5 flex items-end gap-2">
                  {[72, 64, 58, 49, 52].map((score, i) => (
                    <div
                      key={i}
                      className="flex flex-1 flex-col items-center gap-1"
                    >
                      <b className="text-[8px] text-[#7f7788]">{score}%</b>
                      <i
                        className={`w-full rounded-t ${i > 2 ? "bg-[#C26627]" : "bg-[#C2B59B]"}`}
                        style={{ height: `${Math.max(28, score)}px` }}
                      />
                      <span className="text-[7px] text-[#99919f]">
                        {i < 3 ? `Quiz ${i + 1}` : `Mock ${i - 2}`}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-xl bg-[#F7F5F2] p-3">
                  <b className="text-[9px] text-[#2E2877]">
                    Suggested tutor action
                  </b>
                  <p className="mt-1 text-[9px] leading-4 text-[#5f5868]">
                    Revisit interference before the next session and assign
                    targeted practice.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        data-analytics-section="bigger-idea"
        className="border-y border-[#e3ddea] bg-[#fff7f2] py-20"
      >
        <div
          data-landing-reveal
          className="landing-reveal mx-auto max-w-[1000px] px-5 text-center"
        >
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#C26627]">
            One connected tutoring workflow
          </p>
          <h2 className="mt-4 text-[1.8rem] font-medium tracking-[-.035em] text-[#2E2877] sm:text-[2.75rem]">
            Teach the class. Understand the student.
          </h2>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2 text-[9px] font-bold uppercase tracking-wider text-[#4d4655]">
            {[
              "Teach",
              "Manage",
              "Share",
              "Assign",
              "Assess",
              "Track",
              "Understand",
            ].map((x, i) => (
              <span key={x} className="contents">
                <b
                  className={`rounded-full border px-4 py-2.5 ${i === 6 ? "border-[#C26627] bg-[#C26627] text-white" : "border-[#ded7e5] bg-white"}`}
                >
                  {x}
                </b>
                {i < 6 && <ArrowRight size={13} className="text-[#aba3b2]" />}
              </span>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-base leading-7 text-[#68616e]">
            Kanvise keeps teaching activity and evidence of learning in one
            place, so tutors can see who needs attention and act while it still
            matters.
          </p>
        </div>
      </section>

      <section
        id="access"
        data-analytics-section="access"
        className="relative overflow-hidden bg-[#2E2877] py-24 text-white sm:py-32"
      >
        <div className="pointer-events-none absolute -right-40 -top-40 h-[540px] w-[540px] rounded-full bg-[#2E2877] opacity-35 blur-3xl" />
        <div className="relative mx-auto grid max-w-[1120px] gap-10 px-5 lg:grid-cols-[.8fr_1.2fr] lg:items-center lg:px-8">
          <div data-landing-reveal className="landing-reveal">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#C26627]">
              Early access
            </p>
            <h2 className="mt-4 text-[1.8rem] font-medium leading-[1.1] tracking-[-.035em] sm:text-[2.75rem]">
              Be among the first to use Kanvise.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/62">
              We&apos;re opening access gradually. Add your details and
              we&apos;ll tell you when your place opens.
            </p>
            <div className="mt-7 space-y-3 text-sm text-white/72">
              {[
                "No cost to reserve your place",
                "Be among the first tutors to use new workflows",
                "A direct channel for product feedback",
              ].map((x) => (
                <p key={x} className="flex items-center gap-3">
                  <Check className="text-[#C26627]" size={16} />
                  {x}
                </p>
              ))}
            </div>
          </div>
          <div
            data-landing-reveal
            className="landing-reveal landing-reveal-delay-1 relative overflow-hidden rounded-[1.5rem] border border-white/12 bg-white p-6 text-[#2b2532] shadow-2xl sm:p-8"
          >
            {status === "success" ? (
              <div className="relative py-12 text-center">
                <ConfettiBurst />
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#eaf8ef] text-[#17834e]">
                  <Check size={24} />
                </span>
                <h3 className="mt-5 text-2xl font-bold text-[#2E2877]">
                  You&apos;re in.
                </h3>
                <p className="mt-3 text-lg font-bold text-[#C26627]">
                  You&apos;re #{(waitlistPosition ?? 1).toLocaleString()} on the
                  Kanvise waitlist.
                </p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#6f6877]">
                  {alreadyJoined
                    ? "Welcome back. This is still your place."
                    : "Your place is saved. We’ll let you know as your access batch opens."}
                </p>
              </div>
            ) : (
              <form onSubmit={submit} onFocus={startForm}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[.16em] text-[#C26627]">
                      Your details
                    </p>
                    <h3 className="mt-1 text-xl font-bold text-[#2E2877]">
                      Reserve your place
                    </h3>
                  </div>
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#F7F5F2] text-[#2E2877]">
                    <Sparkles size={18} />
                  </span>
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-semibold">
                    Your name
                    <input
                      required
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      placeholder="e.g. Tobi Adeyemi"
                      className="mt-2 w-full rounded-xl border border-[#ddd6e4] bg-[#F7F5F2] px-4 py-3 text-sm font-normal outline-none focus:border-[#2E2877]"
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Email address
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                      placeholder="you@example.com"
                      className="mt-2 w-full rounded-xl border border-[#ddd6e4] bg-[#F7F5F2] px-4 py-3 text-sm font-normal outline-none focus:border-[#2E2877]"
                    />
                  </label>
                  <label className="text-xs font-semibold sm:col-span-2">
                    Tutorial type
                    <select
                      value={form.type}
                      onChange={(e) =>
                        setForm({ ...form, type: e.target.value })
                      }
                      className="mt-2 w-full rounded-xl border border-[#ddd6e4] bg-[#F7F5F2] px-4 py-3 text-sm font-normal outline-none focus:border-[#2E2877]"
                    >
                      <option>Independent tutor</option>
                      <option>Tutorial centre</option>
                    </select>
                  </label>
                </div>
                {status === "error" && (
                  <p className="mt-3 text-xs font-semibold text-[#b7372e]">
                    We couldn&apos;t save your place. Please try again.
                  </p>
                )}
                <button
                  disabled={status === "loading"}
                  onClick={() =>
                    trackLandingEvent("waitlist_cta_clicked", {
                      location: "form",
                    })
                  }
                  className="mt-5 flex w-full items-center justify-center rounded-xl bg-[#C26627] px-5 py-3.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(255,135,84,.25)] disabled:opacity-60"
                >
                  {status === "loading"
                    ? "Saving your place…"
                    : "Reserve your spot"}
                  <ArrowRight className="ml-2" size={15} />
                </button>
                <p className="mt-3 text-center text-[9px] text-[#8c8493]">
                  No payment. No spam. Just product updates and your access
                  invitation.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      <section id="faq" data-analytics-section="faq" className="py-24">
        <div
          data-landing-reveal
          className="landing-reveal mx-auto grid max-w-[1100px] gap-10 px-5 lg:grid-cols-[.55fr_1.45fr] lg:px-8"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#C26627]">
              FAQ
            </p>
            <h2 className="mt-4 text-[1.8rem] font-medium tracking-[-.035em] text-[#2E2877] sm:text-[2.4rem]">
              Before you join.
            </h2>
            <p className="mt-4 text-sm leading-6 text-[#6f6877]">
              The important things to know about Kanvise and the waitlist.
            </p>
          </div>
          <div>
            {faqs.map(([question, answer], index) => (
              <button
                key={question}
                data-landing-reveal
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                aria-expanded={openFaq === index}
                className="landing-reveal w-full border-b border-[#ddd7e4] py-5 text-left"
                style={{ transitionDelay: `${Math.min(index * 45, 180)}ms` }}
              >
                <span className="flex items-center justify-between gap-4">
                  <b className="text-sm sm:text-base">{question}</b>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#efecf5]">
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-300 ${openFaq === index ? "rotate-180" : ""}`}
                    />
                  </span>
                </span>
                <span
                  className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${openFaq === index ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                >
                  <span className="overflow-hidden">
                    <span className="block max-w-2xl pt-4 text-sm leading-7 text-[#6f6877]">
                      {answer}
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section
        data-analytics-section="social"
        className="border-y border-[#ded8e5] bg-[#F7F5F2] py-12"
      >
        <div className="mx-auto flex max-w-[1100px] flex-col gap-7 px-5 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#2E2877]">
              Building in public
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-.035em] text-[#2E2877]">
              Follow the Kanvise journey.
            </h2>
            <p className="mt-2 text-sm text-[#6f6877]">
              Product decisions, progress and launch updates without the noise.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {socialLinks.map((social) => {
              const Icon = social.icon;
              return (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Follow Kanvise on ${social.name}`}
                  onClick={() =>
                    trackLandingEvent("social_clicked", {
                      platform: social.name,
                    })
                  }
                  className="group inline-flex items-center gap-2 rounded-full border border-[#d7cfe4] bg-white px-4 py-2.5 text-xs font-bold text-[#2E2877] shadow-sm transition hover:-translate-y-1 hover:border-[#2E2877] hover:shadow-md"
                >
                  <Icon size={15} className="text-[#2E2877]" />
                  {social.name}
                </a>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="border-t border-[#ded8e5] py-9">
        <div className="mx-auto flex max-w-[1240px] flex-col justify-between gap-5 px-5 sm:flex-row sm:items-center lg:px-8">
          <div>
            <b className="flex items-center gap-2 text-sm text-[#2E2877]">
              <Image src="/kanvise_logo.jpeg" alt="" width={22} height={22} />{" "}
              Kanvise
            </b>
            <p className="mt-2 text-[9px] text-[#8b8492]">
              The workspace for smarter tutoring.
            </p>
          </div>
          <div className="flex flex-wrap gap-5 text-[9px] font-semibold text-[#6f6877]">
            <a href="#workspace">DEMO</a>
            <a href="#faq">FAQs</a>
            <Link href="/terms">Terms of Service</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <a href="mailto:info@kanvise.com">Contact</a>
            <span>© {new Date().getFullYear()} Kanvise</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
