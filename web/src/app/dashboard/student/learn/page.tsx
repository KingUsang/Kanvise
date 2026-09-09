import Link from "next/link";
import { BookOpen, CalendarDays, ClipboardCheck, FileText } from "lucide-react";
import { redirect } from "next/navigation";
import { getStudentDashboard } from "@/lib/student-dashboard";
import { requireServerAccessToken } from "@/lib/server-session";

export default async function StudentLearnPage() {
  const token = await requireServerAccessToken();
  const data = await getStudentDashboard(token);
  if (data.capabilities?.hasCentreLearning === false) redirect("/dashboard/student");

  const destinations = [
    {
      title: "My classes",
      description: data.next_class ? `Next: ${data.next_class.title}` : "See your timetable and join a class when it goes live.",
      href: "/dashboard/student/classes",
      action: "View classes",
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

  return <main className="mx-auto max-w-[1120px] px-4 py-7 pb-28 sm:px-6 lg:px-10 lg:py-10">
    <header>
      <p className="text-sm font-medium text-[#994704]">Your programme</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Learn</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#716c76]">Classes, assignments and study materials from your tutorial centre are together here.</p>
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
      <h2 className="mt-4 text-lg font-semibold">No programme subjects yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#716c76]">Your centre has enrolled your account, but no published subjects are available yet. Check back later or contact the centre.</p>
    </section>}
  </main>;
}
