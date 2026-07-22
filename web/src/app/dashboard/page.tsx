import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { StatCard } from '@/components/dashboard/stat-card'
import { NeedsGradingCard, type GradingItem } from '@/components/dashboard/needs-grading-card'
import { resolveDashboardPersona } from '@/lib/dashboard-persona'
import { getApiUrl } from '@/config/api'

type ScheduleItem = {
  id: string
  title: string
  scheduled_at: string
  duration_minutes: number
  status: string
  courses?: { name: string } | null
}

export default async function DashboardHomePage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) return null

  const response = await fetch(`${getApiUrl()}/dashboard/stats`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!response.ok) return <div className="p-8 text-center text-[#ba1a1a]">We could not load your dashboard. Please refresh and try again.</div>

  const { data } = await response.json()
  const isAdmin = Boolean(data.admin_stats)
  const isTutor = Boolean(data.tutor_stats)
  const persona = resolveDashboardPersona({ isAdmin, isTutor })
  const isAdminTutor = persona === 'admin-tutor'
  const admin = data.admin_stats
  const tutor = data.tutor_stats
  const gradingItems: GradingItem[] = (isAdminTutor ? tutor?.needs_grading : admin?.needs_grading || tutor?.needs_grading) || []
  const schedule: ScheduleItem[] = (isTutor ? data.my_today_schedule : data.today_schedule) || []
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: 'NGN', maximumFractionDigits: 0,
  }).format(amount)

  const heading = isAdminTutor ? 'Your centre and teaching today' : isAdmin ? 'Your centre today' : 'Your teaching today'
  const description = isAdminTutor
    ? 'See what needs your attention across teaching, assessments, students and payments.'
    : isAdmin
      ? 'Keep classes, assessments, students and payments moving.'
      : 'See your classes, courses and assessment work in one place.'

  return (
    <div className="animate-in fade-in space-y-8 duration-500">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#994704]">Dashboard</p>
          <h1 className="mt-2 text-3xl font-bold text-[#1b1c1c]">{heading}</h1>
          <p className="mt-1 max-w-2xl text-[#474551]">{description}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/mocks/builder" className="inline-flex items-center gap-2 rounded-lg bg-[#c26627] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#994704]">
            <span className="material-symbols-outlined text-xl">quiz</span>Create Mock
          </Link>
          <Link href="/dashboard/schedule" className="inline-flex items-center gap-2 rounded-lg border border-[#2e2877] bg-white px-4 py-2.5 text-sm font-semibold text-[#2e2877] transition-colors hover:bg-[#f5f3f2]">
            <span className="material-symbols-outlined text-xl">calendar_add_on</span>Schedule Class
          </Link>
        </div>
      </header>

      {isAdmin && (
        <section aria-labelledby="centre-summary">
          {isAdminTutor && <h2 id="centre-summary" className="mb-4 text-lg font-semibold text-[#1b1c1c]">Centre overview</h2>}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Enrolled Students" value={admin.total_students} icon="groups" subtitle="Across the centre" />
            <StatCard title="Classes Today" value={admin.upcoming_classes} icon="event" subtitle="Scheduled centre-wide" />
            <StatCard title="Earnings This Month" value={formatCurrency(admin.mtd_revenue)} icon="payments" subtitle={`${admin.successful_payments || 0} successful payments`} isRevenue />
            {isAdminTutor
              ? <StatCard title="Tutors" value={admin.tutors_count} icon="school" subtitle="Including you" />
              : <StatCard title="Mock Answers to Grade" value={admin.mocks?.pending_count || 0} icon="quiz" subtitle={`${admin.mocks?.active_count || 0} active mocks`} />}
          </div>
        </section>
      )}

      {isTutor && (
        <section aria-labelledby="teaching-summary">
          {isAdminTutor && <h2 id="teaching-summary" className="mb-4 text-lg font-semibold text-[#1b1c1c]">My teaching</h2>}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="My Classes Today" value={tutor.classes_today} icon="laptop_chromebook" subtitle="Sessions assigned to you" />
            <StatCard title="Assignment Submissions to Grade" value={tutor.pending_submissions} icon="assignment_late" subtitle="Waiting for your review" />
            <StatCard title="Mock Answers to Grade" value={tutor.mocks?.pending_count || 0} icon="quiz" subtitle={`${tutor.mocks?.active_count || 0} active mocks`} />
            <StatCard title="My Courses" value={tutor.my_courses} icon="library_books" subtitle="Courses you teach" />
          </div>
        </section>
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        <section className="flex-1 rounded-lg border border-[#c8c5d2] bg-white p-6 shadow-[0_4px_20px_rgba(61,61,61,0.08)]">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div><h2 className="text-lg font-semibold text-[#1b1c1c]">{isTutor ? 'My Schedule Today' : "Today's Centre Schedule"}</h2><p className="mt-1 text-sm text-[#474551]">{schedule.length} {schedule.length === 1 ? 'session' : 'sessions'} today</p></div>
            <Link href="/dashboard/schedule" className="flex items-center text-sm font-semibold text-[#c26627] hover:text-[#994704]">Full Schedule<span className="material-symbols-outlined ml-1 text-base">arrow_forward</span></Link>
          </div>
          {schedule.length ? (
            <div className="divide-y divide-[#eae8e7]">
              {schedule.map((item) => (
                <div key={item.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="w-16 shrink-0 text-sm font-bold text-[#2e2877]">{new Date(item.scheduled_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}</div>
                  <div className="min-w-0 flex-1"><p className="truncate font-semibold text-[#1b1c1c]">{item.title}</p><p className="truncate text-sm text-[#474551]">{item.courses?.name || 'General class'}</p></div>
                  <span className="rounded-full bg-[#f0eded] px-3 py-1 text-xs text-[#474551]">{item.duration_minutes} min</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#eae8e7] py-12 text-center"><span className="material-symbols-outlined mb-3 text-4xl text-[#c8c5d2]">event_available</span><h3 className="text-lg font-medium text-[#1b1c1c]">No classes today</h3><p className="mt-1 text-sm text-[#474551]">Your next scheduled class will appear here.</p></div>
          )}
        </section>

        <div className="w-full shrink-0 lg:w-[420px]"><NeedsGradingCard items={gradingItems} /></div>
      </div>

      {isAdmin && !isAdminTutor && (
        <section className="flex flex-col gap-4 rounded-lg bg-[#2e2877] p-6 text-white sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-lg font-semibold">Run an exam-ready mock</h2><p className="mt-1 text-sm text-[#d9d6ff]">Create practice for JAMB, WAEC, NECO, post-UTME or your next revision test.</p></div>
          <Link href="/dashboard/mocks/builder" className="shrink-0 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-[#2e2877]">Build a Mock</Link>
        </section>
      )}
    </div>
  )
}
