"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, ClipboardCheck, FileText, Home, LogOut, Menu, Settings, UserRound, X } from "lucide-react";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { detachBrowserPushOnLogout } from "@/lib/push-notifications";

const navigation = [
  { label: "Home", href: "/dashboard/student", icon: Home },
  { label: "My classes", href: "/dashboard/student/classes", icon: CalendarDays },
  { label: "Assignments", href: "/dashboard/student/assignments", icon: ClipboardCheck },
  { label: "Mocks", href: "/dashboard/student/mocks", icon: BookOpen },
  { label: "Materials", href: "/dashboard/student/materials", icon: FileText },
  { label: "My progress", href: "/dashboard/student/progress", icon: UserRound },
  { label: "My mocks", href: "/my-mocks", icon: BookOpen },
];

export function StudentShell({ children, studentName, schoolName, hasCentreLearning = true }: { children: React.ReactNode; studentName: string; schoolName: string; hasCentreLearning?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  async function signOut() {
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data: sessionData } = await supabase.auth.getSession();
    await detachBrowserPushOnLogout(sessionData.session?.access_token);
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  }

  const nav = (
    <>
      <div className="border-b border-white/10 px-6 py-6">
        <p className="text-lg font-semibold tracking-tight text-white">Kanvise</p>
        <p className="mt-1 truncate text-xs text-white/60">{schoolName}</p>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-5">
        {navigation.filter(item => hasCentreLearning || !['My classes', 'Assignments', 'Materials'].includes(item.label)).map((item) => {
          const active = item.href === "/dashboard/student" ? pathname === item.href : pathname.startsWith(item.href);
          return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${active ? "bg-white/14 font-medium text-white" : "text-white/72 hover:bg-white/8 hover:text-white"}`}>
            <item.icon size={18} />{item.label}
          </Link>;
        })}
      </nav>
      <div className="space-y-1 border-t border-white/10 p-3">
        <Link href="/dashboard/student/settings" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/72 hover:bg-white/8 hover:text-white"><Settings size={18} />Settings</Link>
        <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/72 hover:bg-white/8 hover:text-white"><LogOut size={18} />Log out</button>
      </div>
    </>
  );

  return <div className="min-h-screen bg-[#f8f7f5] text-[#25232d]">
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-[#2e2877] lg:flex">{nav}</aside>
    {open && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Close navigation" className="absolute inset-0 bg-black/35" onClick={() => setOpen(false)} /><aside className="relative flex h-full w-72 flex-col bg-[#2e2877]">{nav}</aside></div>}
    <div className="lg:pl-64">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#e7e3df] bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-10">
        <button aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)} className="rounded-lg p-2 text-[#2e2877] lg:hidden">{open ? <X size={22} /> : <Menu size={22} />}</button>
        <div className="hidden lg:block"><p className="text-sm font-medium text-[#2e2877]">{schoolName}</p><p className="text-xs text-[#77727e]">Student portal</p></div>
        <div className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-[#eeeafe] text-sm font-semibold text-[#2e2877]">{studentName.charAt(0).toUpperCase() || "S"}</div>
      </header>
      {children}
    </div>
  </div>;
}
