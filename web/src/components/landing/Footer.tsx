"use client";

import Image from "next/image";

export default function Footer() {
  return (
    <footer className="w-full py-16 px-6 lg:px-[120px] flex flex-col md:flex-row justify-between items-center gap-6 bg-[#f3dfd1] border-t border-[#c8c5d2] text-[#1b1c1c]">
      <div className="flex flex-col items-center md:items-start gap-3">
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
          <div className="text-2xl font-bold text-[#180d62]">Kanvise</div>
        </div>
        <div className="text-sm">© 2026 Kanvise OS. Built for serious educators.</div>
      </div>
      <ul className="flex flex-wrap justify-center gap-6">
        <li>
          <a className="text-[#474551] hover:text-[#C26627] transition-colors text-xs font-semibold opacity-80 hover:opacity-100" href="#">
            Terms of Service
          </a>
        </li>
        <li>
          <a className="text-[#474551] hover:text-[#C26627] transition-colors text-xs font-semibold opacity-80 hover:opacity-100" href="#">
            Privacy Policy
          </a>
        </li>
        <li>
          <a className="text-[#474551] hover:text-[#C26627] transition-colors text-xs font-semibold opacity-80 hover:opacity-100" href="#">
            Support
          </a>
        </li>
        <li>
          <a className="text-[#474551] hover:text-[#C26627] transition-colors text-xs font-semibold opacity-80 hover:opacity-100" href="mailto:info@kanvise.com">
            info@kanvise.com
          </a>
        </li>
      </ul>
    </footer>
  );
}
