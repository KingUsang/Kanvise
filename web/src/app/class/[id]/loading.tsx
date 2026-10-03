"use client";

import { useEffect, useState } from "react";

const openingLines = [
  "Creating a live space for your lesson…",
  "Getting your classroom ready…",
  "Your class will open automatically.",
];

export default function ClassroomLoading() {
  const [line, setLine] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(
      () => setLine((current) => (current + 1) % openingLines.length),
      2200,
    );
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main
      className="flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#fbf9f8] px-5 font-sans"
      aria-busy="true"
      aria-label="Opening classroom"
    >
      <section className="w-full max-w-md rounded-2xl border border-[#e5e1dd] bg-white p-6 shadow-sm">
        <div className="relative overflow-hidden rounded-2xl border border-[#e4dffc] bg-[#f8f7ff] p-5">
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#e3dfff]" />
          <div className="relative flex h-28 items-center justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2e2877] text-white shadow-lg">
              <span
                className="material-symbols-outlined text-2xl"
                aria-hidden="true"
              >
                cast
              </span>
            </span>
          </div>
        </div>
        <h1 className="mt-6 text-xl font-bold text-[#180d62]">
          Opening your classroom
        </h1>
        <p
          aria-live="polite"
          className="mt-2 min-h-12 text-sm leading-6 text-[#66616c]"
        >
          {openingLines[line]}
        </p>
      </section>
    </main>
  );
}
