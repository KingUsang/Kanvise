"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, ClipboardCheck, FileText, GraduationCap, Home, LogOut, Settings, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
];

type MobileNavigationItem = { label: string; href: string; activeHref?: string; icon: LucideIcon };

const mobileProgrammeNavigation: MobileNavigationItem[] = [
  { label: "Home", href: "/dashboard/student", icon: Home },
  { label: "Learn", href: "/dashboard/student/learn", icon: GraduationCap },
  { label: "Mocks", href: "/dashboard/student/mocks", icon: BookOpen },
  { label: "Progress", href: "/dashboard/student/progress", icon: UserRound },
];

const mobileStandaloneNavigation: MobileNavigationItem[] = [
  { label: "Home", href: "/dashboard/student", icon: Home },
  { label: "Mocks", href: "/dashboard/student/mocks?view=unlocked", activeHref: "/dashboard/student/mocks", icon: BookOpen },
];

export function StudentShell({ children, studentName, schoolName, hasCentreLearning = true }: { children: React.ReactNode; studentName: string; schoolName: string; hasCentreLearning?: boolean }) {
  const pathname = usePathname();
  const [accountOpen, setAccountOpen] = useState(false);

  function isActive(href: string) {
    return href === "/dashboard/student" ? pathname === href : pathname.startsWith(href);
  }

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
        {navigation.filter(item => hasCentreLearning || ['Home', 'Mocks'].includes(item.label)).map((item) => {
          const active = isActive(item.href);
          return <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${active ? "bg-white/14 font-medium text-white" : "text-white/72 hover:bg-white/8 hover:text-white"}`}>
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

  const mobileNavigation = hasCentreLearning ? mobileProgrammeNavigation : mobileStandaloneNavigation;

  return <div className="min-h-screen bg-[#f8f7f5] text-[#25232d]">
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-[#2e2877] lg:flex">{nav}</aside>
    <div className="lg:pl-64">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#e7e3df] bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-10">
        <div className="min-w-0 lg:hidden"><p className="text-sm font-semibold text-[#2e2877]">Kanvise</p><p className="truncate text-xs text-[#77727e]">{schoolName}</p></div>
        <div className="hidden lg:block"><p className="text-sm font-medium text-[#2e2877]">{schoolName}</p><p className="text-xs text-[#77727e]">Student portal</p></div>
        <div className="relative ml-auto">
          <button type="button" aria-label="Open account menu" aria-expanded={accountOpen} onClick={() => setAccountOpen(value => !value)} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eeeafe] text-sm font-semibold text-[#2e2877] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2e2877]">{studentName.charAt(0).toUpperCase() || "S"}</button>
          {accountOpen && <><button aria-label="Close account menu" className="fixed inset-0 z-30" onClick={() => setAccountOpen(false)} /><div className="absolute right-0 top-12 z-40 w-60 overflow-hidden rounded-2xl border border-[#e3ded9] bg-white shadow-xl"><div className="border-b border-[#eeeae6] px-4 py-3"><p className="truncate text-sm font-semibold">{studentName}</p><p className="truncate text-xs text-[#77727e]">{schoolName}</p></div><div className="p-2"><Link href="/dashboard/student/settings" onClick={() => setAccountOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-[#4f4a54] hover:bg-[#f5f2ef]"><Settings size={18} />Settings</Link><button onClick={signOut} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-[#4f4a54] hover:bg-[#f5f2ef]"><LogOut size={18} />Log out</button></div></div></>}
        </div>
      </header>
      <div className="min-w-0">{children}</div>
    </div>
    <nav aria-label="Student navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-[#ded9d4] bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(35,31,38,0.06)] backdrop-blur lg:hidden">
      <div className={`mx-auto grid max-w-lg ${hasCentreLearning ? "grid-cols-4" : "grid-cols-2"}`}>
        {mobileNavigation.map(item => { const active = isActive(item.activeHref || item.href.split('?')[0] || item.href); return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-medium ${active ? "bg-[#eeeafe] text-[#2e2877]" : "text-[#716c76]"}`}><item.icon size={19} strokeWidth={active ? 2.5 : 2} /><span>{item.label}</span></Link> })}
      </div>
    </nav>
  </div>;
}
