import { BookOpenCheck, CalendarCheck2, CheckCircle2, ChevronRight, ClipboardCheck } from 'lucide-react'
import Link from 'next/link'
import type { ProgressMetrics, StudentProgress } from '@/lib/student-progress'

function Metric({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof CalendarCheck2 }) {
  return <article className="rounded-2xl border border-[#e3ded9] bg-white p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-[#716c76]">{label}</p><p className="mt-2 text-3xl font-semibold text-[#2e2877]">{value}</p></div><span className="rounded-xl bg-[#f0edff] p-2.5 text-[#2e2877]"><Icon size={20} /></span></div><p className="mt-3 text-xs leading-5 text-[#716c76]">{detail}</p></article>
}

function percentage(value: number | null) { return value === null ? 'Not enough data' : `${value}%` }

function CourseProgress({ course }: { course: ProgressMetrics & { id: string; name: string } }) {
  const metrics = [course.attendance_percentage, course.assignment_completion_percentage, course.mock_average_percentage].filter((value): value is number => value !== null)
  const combined = metrics.length ? Math.round(metrics.reduce((sum, value) => sum + value, 0) / metrics.length) : null
  return <article className="rounded-2xl border border-[#e3ded9] bg-white p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{course.name}</h3><p className="mt-1 text-xs text-[#716c76]">Based only on recorded activity</p></div><span className="text-lg font-semibold text-[#2e2877]">{combined === null ? '—' : `${combined}%`}</span></div><div className="mt-5 space-y-4">{[
    ['Attendance', course.attendance_percentage, `${course.classes_attended} of ${course.classes_held} completed classes`],
    ['Assignments', course.assignment_completion_percentage, `${course.assignments_submitted} of ${course.assignments_published} submitted`],
    ['Mocks', course.mock_average_percentage, `${course.mocks_completed} completed`],
  ].map(([label, value, detail]) => <div key={String(label)}><div className="flex justify-between text-xs"><span>{label}</span><span className="font-semibold">{value === null ? '—' : `${value}%`}</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#eeeae6]"><div className="h-full rounded-full bg-[#2e2877]" style={{ width: `${value || 0}%` }} /></div><p className="mt-1 text-[11px] text-[#8b858f]">{detail}</p></div>)}</div></article>
}

export function StudentProgressClient({ progress }: { progress: StudentProgress }) {
  const overall = progress.overall
  return <main className="mx-auto max-w-[1440px] px-4 py-7 pb-24 sm:px-6 lg:px-10 lg:py-10">
    <header><p className="text-sm font-medium text-[#994704]">Your learning record</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">My progress</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#716c76]">See what Kanvise has actually recorded from your classes, assignments, and mocks. Missing activity is shown as missing—not estimated.</p></header>
    <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Metric label="Attendance" value={percentage(overall.attendance_percentage)} detail={`${overall.classes_attended} of ${overall.classes_held} completed classes attended`} icon={CalendarCheck2} /><Metric label="Assignments submitted" value={percentage(overall.assignment_completion_percentage)} detail={`${overall.assignments_submitted} of ${overall.assignments_published} published assignments`} icon={ClipboardCheck} /><Metric label="Mock average" value={percentage(overall.mock_average_percentage)} detail={`${overall.mocks_completed} completed mock attempt${overall.mocks_completed === 1 ? '' : 's'}`} icon={BookOpenCheck} /></section>
    <section className="mt-8"><h2 className="text-xl font-semibold">Progress by course</h2>{progress.courses.length ? <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{progress.courses.map(course => <CourseProgress key={course.id} course={course} />)}</div> : <div className="mt-4 rounded-2xl border border-[#e3ded9] bg-white p-10 text-center"><p className="font-medium">No course activity yet</p><p className="mt-1 text-sm text-[#716c76]">Your progress will build as you attend classes and complete coursework.</p></div>}</section>
    <section className="mt-8"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Recent mock results</h2><Link href="/dashboard/student/mocks" className="text-sm font-semibold text-[#2e2877]">All mocks</Link></div><div className="mt-4 overflow-hidden rounded-2xl border border-[#e3ded9] bg-white">{progress.recent_mock_results.length ? progress.recent_mock_results.map(item => <Link key={item.attempt_id} href={`/dashboard/student/mocks/result/${item.attempt_id}`} className="flex items-center gap-4 border-b border-[#eeeae6] p-4 last:border-0 hover:bg-[#faf8f6]"><span className="rounded-xl bg-[#edf8f1] p-2.5 text-[#29724b]"><CheckCircle2 size={19} /></span><span className="min-w-0 flex-1"><span className="block truncate font-medium">{item.title}</span><span className="mt-0.5 block text-xs text-[#716c76]">{item.submitted_at ? new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(item.submitted_at)) : 'Completed'}</span></span><span className="font-semibold text-[#2e2877]">{item.percentage === null ? '—' : `${item.percentage}%`}</span><ChevronRight size={17} className="text-[#aaa4ad]" /></Link>) : <p className="p-8 text-center text-sm text-[#716c76]">No completed mock results yet.</p>}</div></section>
  </main>
}
