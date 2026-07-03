"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToWaitlist = () =>
    document.getElementById("waitlist-form")?.scrollIntoView({ behavior: "smooth" });

  return (
    <nav
      className={`fixed top-0 left-0 w-full z-50 px-4 md:px-12 py-4 transition-all duration-300 ${
        scrolled ? "bg-[#2E2877] shadow-sm" : "bg-[#2E2877]"
      }`}
    >
      <div className="w-full max-w-[1440px] mx-auto flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="relative w-8 h-8 flex-shrink-0">
            <Image
              src="/kanvise_logo.jpeg"
              alt="Kanvise"
              fill
              className="object-contain"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          <div className="text-xl font-bold tracking-tight text-white cursor-pointer hover:opacity-90">
            Kanvise
          </div>
        </div>

        <ul className="hidden md:flex gap-6 lg:gap-8 items-center">
          <li><a className="text-white opacity-80 hover:opacity-100 hover:text-[#ff9653] transition-colors duration-200 text-sm font-medium" href="#story">Our Story</a></li>
          <li><a className="text-white opacity-80 hover:opacity-100 hover:text-[#ff9653] transition-colors duration-200 text-sm font-medium" href="#features">Features</a></li>
          <li><a className="text-white opacity-80 hover:opacity-100 hover:text-[#ff9653] transition-colors duration-200 text-sm font-medium" href="#founder">Founder</a></li>
          <li><a className="text-white opacity-80 hover:opacity-100 hover:text-[#ff9653] transition-colors duration-200 text-sm font-medium" href="#invite-only">Why Invite-Only</a></li>
        </ul>

        <div className="flex items-center gap-3">
          <button 
            onClick={scrollToWaitlist}
            className="bg-[#C26627] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-opacity-90 transition-all scale-95 active:scale-90 shadow-[0px_4px_12px_rgba(60,48,39,0.08)] whitespace-nowrap"
          >
            Join Waitlist
          </button>
        </div>
      </div>
    </nav>
  );
}
