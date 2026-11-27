"use client";
import Link from "next/link";
import { BookOpen, CalendarDays, ClipboardCheck, FileText } from "lucide-react";
import { useQuery } from '@tanstack/react-query';
import type { StudentDashboardData } from '@/lib/student-dashboard';
import { createClient } from '@/lib/supabase/client';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { getApiUrl } from '@/config/api';
import { QueryErrorState } from '@/components/common/query-error-state';

export default function StudentLearnPage() {
  const dashboardQuery = useQuery<StudentDashboardData>({ queryKey: ['student-dashboard'], queryFn: async () => { const response = await authenticatedFetch(createClient(), `${getApiUrl()}/dashboard/student`, { cache: 'no-store' }); const body = await response.json().catch(() => null); if (!response.ok) throw new Error(body?.error || 'Could not load your class'); return body.data; } });
  if (dashboardQuery.isPending) return <div className="mx-auto max-w-[1120px] px-4 py-10 text-center text-sm text-[#716c76]">Loading your class…</div>;
  if (dashboardQuery.isError) return <div className="mx-auto max-w-[1120px] px-4 py-10"><QueryErrorState error={dashboardQuery.error} onRetry={() => void dashboardQuery.refetch()} fallback="We could not load your class." retrying={dashboardQuery.isFetching} /></div>;
  const data = dashboardQuery.data;
  if (!data || data.capabilities?.hasCentreLearning === false) return <div className="mx-auto max-w-[1120px] px-4 py-10 text-center"><h1 className="text-lg font-bold text-[#1b1c1c]">No class access yet</h1><p className="mt-2 text-sm text-[#716c76]">You are not enrolled in a tutoring account class. Ask your tutor for an invitation to see your classes here.</p><Link href="/dashboard/student" className="mt-4 inline-block text-sm font-semibold text-[#2e2877] underline">Back to your dashboard</Link></div>;

  const destinations = [
    {
      title: "Live classes",
      description: data.next_class ? `Next: ${data.next_class.title}` : "See your timetable and join a live class when it starts.",
      href: "/dashboard/student/classes",
      action: "View live classes",
      icon: CalendarDays,
    },
    {
      title: "Assignments",
      description: data.assignments_due.length
        ? `${data.assignments_due.length} assignment${data.assignments_due.length === 1 ? "" : "s"} need your attention.`
        : "You have no outstanding assignments right now.",
      href: "/dashboard/student/assignments",
      action: "View assignments",
      icon: ClipboardCheck,
    },
    {
      title: "Materials",
      description: "Open notes, slides and documents shared by your tutors.",
      href: "/dashboard/student/materials",
      action: "View materials",
      icon: FileText,
    },
  ];

  return <div className="mx-auto max-w-[1120px] px-4 py-7 pb-28 sm:px-6 lg:px-10 lg:py-10">
    <header>
      <p className="text-sm font-medium text-[#994704]">Your class</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Learn</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#716c76]">Live classes, assignments and study materials from your tutoring agency are together here.</p>
    </header>

    {data.course_count > 0 ? <section className="mt-7 grid gap-4 md:grid-cols-3">
      {destinations.map(item => <Link key={item.href} href={item.href} className="group flex min-w-0 flex-col rounded-2xl border border-[#e3ded9] bg-white p-5 shadow-[0_1px_2px_rgba(35,31,38,0.04)] transition hover:-translate-y-0.5 hover:border-[#c9c1d7] hover:shadow-md">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eeeafe] text-[#2e2877]"><item.icon size={21} /></span>
        <h2 className="mt-5 text-lg font-semibold">{item.title}</h2>
        <p className="mt-2 text-sm leading-6 text-[#716c76]">{item.description}</p>
        <span className="mt-5 text-sm font-semibold text-[#2e2877] group-hover:underline">{item.action}</span>
      </Link>)}
    </section> : <section className="mt-7 rounded-2xl border border-[#e3ded9] bg-white px-5 py-14 text-center">
      <BookOpen className="mx-auto text-[#aaa4ad]" />
      <h2 className="mt-4 text-lg font-semibold">No class subjects yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#716c76]">Your tutoring agency has enrolled your account, but no published subjects are available yet. Check back later or contact the tutoring agency.</p>
    </section>}
  </div>;
}
