import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpen, CalendarDays, ClipboardCheck, Clock3, FileText, Video } from "lucide-react";
import { getStudentDashboard, type StudentDashboardData } from "@/lib/student-dashboard";

function formatTime(value: string) { return new Intl.DateTimeFormat("en-NG", { hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-NG", { weekday: "short", day: "numeric", month: "short" }).format(new Date(value)); }
function relativeDate(value: string) {
  const days = Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return formatDate(value);
}

async function loadDashboard(): Promise<StudentDashboardData> {
  const cookieStore = await cookies();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => cookieStore.getAll() } });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/auth/login");
  return getStudentDashboard(session.access_token);
}

export default async function StudentDashboardPage() {
  const data = await loadDashboard();
  const firstName = data.student.first_name || "there";
  const nextClass = data.next_class;

  if (data.capabilities?.hasCentreLearning === false) {
    const owned = data.standalone_mocks?.mocks_owned || 0;
    const inProgress = data.standalone_mocks?.attempts_in_progress || 0;
    return <main className="mx-auto max-w-[1120px] px-4 py-7 pb-24 sm:px-6 lg:px-10 lg:py-10">
      <section className="rounded-3xl bg-[#2e2877] px-6 py-8 text-white sm:px-9 sm:py-10"><p className="text-sm text-white/70">Kanvise</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Welcome, {firstName}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">Open a mock from the link you received, practise at your own pace, and keep every result in one place.</p><Link href="/my-mocks" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#2e2877]">Open my mocks <ArrowRight className="ml-2" size={16}/></Link></section>
      <section className="mt-6 grid gap-4 sm:grid-cols-2"><article className="rounded-2xl border border-[#e3ded9] bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[#716c76]">My mocks</p><p className="mt-2 text-3xl font-semibold text-[#2e2877]">{owned}</p><p className="mt-2 text-sm text-[#716c76]">Unlocked practice mocks.</p><Link href="/my-mocks" className="mt-4 inline-flex text-sm font-semibold text-[#2e2877]">Open my mocks</Link></article><article className="rounded-2xl border border-[#e3ded9] bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[#716c76]">Continue practising</p><p className="mt-2 text-3xl font-semibold text-[#2e2877]">{inProgress}</p><p className="mt-2 text-sm text-[#716c76]">Attempt{inProgress === 1 ? '' : 's'} currently in progress.</p><Link href="/my-mocks" className="mt-4 inline-flex text-sm font-semibold text-[#2e2877]">Continue a mock</Link></article></section>
      <section className="mt-6 rounded-2xl border border-[#e3ded9] bg-white p-6"><h2 className="text-lg font-semibold">Joining a tutorial centre later?</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#716c76]">Your Kanvise account stays the same. When a Kanvise-powered centre enrols you, its classes and learning materials will appear here alongside your mock history.</p></section>
    </main>
  }

  return <main className="mx-auto max-w-[1440px] px-4 py-6 pb-24 sm:px-6 lg:px-10 lg:py-9">
    <section className="rounded-3xl bg-[#2e2877] px-6 py-7 text-white sm:px-8 sm:py-9">
      <p className="text-sm text-white/70">{data.school?.name || "Kanvise"}</p>
      <div className="mt-2 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Welcome back, {firstName}</h1><p className="mt-2 max-w-xl text-sm leading-6 text-white/72">Here’s what needs your attention today. Keep learning at your own pace.</p></div>
        <div className="rounded-2xl bg-white/10 px-5 py-3"><p className="text-xs uppercase tracking-wider text-white/60">Subjects you can access</p><p className="mt-1 text-2xl font-semibold">{data.course_count}</p></div>
      </div>
    </section>

    {data.course_count === 0 ? <section className="mt-6 rounded-2xl border border-[#e5e1dd] bg-white p-8 text-center"><BookOpen className="mx-auto text-[#2e2877]" /><h2 className="mt-4 text-xl font-semibold">Your learning space is ready</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#716c76]">Once you enrol in a programme, your classes and learning materials will appear here.</p></section> :
    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <section className="rounded-2xl border border-[#e5e1dd] bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#8a6570]">Up next</p><h2 className="mt-1 text-xl font-semibold">Today’s class</h2></div><CalendarDays className="text-[#2e2877]" size={22} /></div>
          {nextClass ? <div className="mt-5 rounded-2xl border-l-4 border-[#c26627] bg-[#faf8f5] p-4 sm:flex sm:items-center sm:justify-between sm:gap-5">
            <div className="flex gap-4"><div className="min-w-16 border-r border-[#ded8d2] pr-4"><p className="text-lg font-semibold text-[#2e2877]">{formatTime(nextClass.scheduled_at)}</p><p className="text-xs text-[#77727e]">{formatDate(nextClass.scheduled_at)}</p></div><div><p className="font-semibold">{nextClass.title}</p><p className="mt-1 text-sm text-[#716c76]">{nextClass.course_name} · {nextClass.duration_minutes} mins</p></div></div>
            {nextClass.status === "live" ? <Link href={`/class/${nextClass.id}`} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#994704] px-5 py-3 text-sm font-semibold text-white hover:bg-[#7f3a03] sm:mt-0 sm:w-auto"><Video size={17} />Join class</Link> : <Link href="/dashboard/student/classes" className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-[#d7d1cb] bg-white px-5 py-3 text-sm font-semibold text-[#2e2877] hover:bg-[#f4f1ee] sm:mt-0 sm:w-auto">View schedule</Link>}
          </div> : <div className="mt-5 rounded-2xl bg-[#faf8f5] p-6 text-center"><p className="font-medium">No class is scheduled next.</p><p className="mt-1 text-sm text-[#716c76]">You can use the time to review your materials.</p></div>}
        </section>

        <section className="rounded-2xl border border-[#e5e1dd] bg-white p-5 sm:p-6"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Recent updates</h2><Link href="/dashboard/student/classes" className="text-sm font-medium text-[#2e2877]">See all</Link></div>
          <div className="mt-4 divide-y divide-[#eeeae6]">{data.recent_updates.length ? data.recent_updates.map((item) => { const Icon = item.type === "assignment" ? ClipboardCheck : item.type === "mock" ? BookOpen : FileText; return <Link key={`${item.type}-${item.id}`} href={item.href} className="flex items-center gap-4 py-4 first:pt-1 group"><span className="rounded-xl bg-[#f0edff] p-2.5 text-[#2e2877]"><Icon size={18} /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold uppercase tracking-wide text-[#994704]">New {item.type}</span><span className="mt-0.5 block truncate font-medium">{item.title}</span><span className="block truncate text-sm text-[#77727e]">{item.course_name}</span></span><ArrowRight size={17} className="text-[#aaa4ad] group-hover:text-[#2e2877]" /></Link>; }) : <p className="py-8 text-center text-sm text-[#716c76]">No new updates yet.</p>}</div>
        </section>
      </div>

      <aside className="space-y-6">
        <section className="rounded-2xl border border-[#e5e1dd] bg-white p-5"><div className="flex items-center gap-2"><Clock3 size={19} className="text-[#994704]" /><h2 className="font-semibold">Assignments due</h2></div><div className="mt-4 space-y-3">{data.assignments_due.length ? data.assignments_due.map((item) => <Link key={item.id} href="/dashboard/student/assignments" className="block rounded-xl border-l-2 border-[#c26627] bg-[#faf8f5] p-3"><p className="text-sm font-medium">{item.title}</p><p className="mt-1 text-xs text-[#716c76]">{item.course_name}</p><p className="mt-2 text-xs font-semibold text-[#994704]">Due {relativeDate(item.deadline_at)}</p></Link>) : <p className="rounded-xl bg-[#faf8f5] p-4 text-sm text-[#716c76]">You have no outstanding assignments.</p>}</div></section>
        {data.upcoming_classes.length > 1 && <section className="rounded-2xl border border-[#e5e1dd] bg-white p-5"><h2 className="font-semibold">Coming up</h2><div className="mt-3 space-y-3">{data.upcoming_classes.slice(1, 4).map((item) => <div key={item.id} className="border-b border-[#eeeae6] pb-3 last:border-0 last:pb-0"><p className="text-sm font-medium">{item.title}</p><p className="mt-1 text-xs text-[#716c76]">{formatDate(item.scheduled_at)} · {formatTime(item.scheduled_at)}</p></div>)}</div></section>}
      </aside>
    </div>}
  </main>;
}
