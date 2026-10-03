"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  NeedsGradingCard,
  type GradingItem,
} from "@/components/dashboard/needs-grading-card";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { resolveDashboardPersona } from "@/lib/dashboard-persona";
import { DashboardGreeting } from "@/components/dashboard/dashboard-greeting";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { getApiUrl } from "@/config/api";
import { createClient } from "@/lib/supabase/client";
import {
  dashboardQueryKeys,
  useDashboardSession,
} from "@/lib/dashboard-session";

type ScheduleItem = {
  id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  courses?: { name: string } | null;
};
type DashboardStats = {
  organisation_type: "centre" | "independent";
  admin_stats?: {
    total_students: number;
    upcoming_classes: number;
    mtd_revenue: number;
    successful_payments: number;
    tutors_count: number;
    needs_grading: GradingItem[];
    mocks: { pending_count: number; active_count: number };
  };
  tutor_stats?: {
    classes_today: number;
    pending_submissions: number;
    my_courses: number;
    needs_grading: GradingItem[];
    mocks: { pending_count: number; active_count: number };
  };
  today_schedule?: ScheduleItem[];
  my_today_schedule?: ScheduleItem[];
};

function DashboardSummarySkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-20 rounded-xl bg-[#eae8e7]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 rounded-xl bg-[#eae8e7]" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="h-72 rounded-xl bg-[#eae8e7]" />
        <div className="h-72 rounded-xl bg-[#eae8e7]" />
      </div>
    </div>
  );
}

export function DashboardHomeClient() {
  const sessionQuery = useDashboardSession();
  const supabase = createClient();
  const summaryQuery = useQuery({
    queryKey: dashboardQueryKeys.summary,
    enabled: sessionQuery.isSuccess,
    staleTime: 30_000,
    queryFn: async (): Promise<DashboardStats> => {
      const response = await authenticatedFetch(
        supabase,
        `${getApiUrl()}/dashboard/stats`,
      );
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(body?.error || "We could not load your dashboard");
      return body.data as DashboardStats;
    },
  });

  if (sessionQuery.isPending || summaryQuery.isPending)
    return <DashboardSummarySkeleton />;
  if (sessionQuery.isError || summaryQuery.isError) {
    const error = summaryQuery.error || sessionQuery.error;
    return (
      <div className="rounded-xl border border-[#ba1a1a]/20 bg-white p-6 text-center text-sm text-[#ba1a1a]">
        <p>
          {error instanceof Error
            ? error.message
            : "We could not load your dashboard."}
        </p>
        <button
          type="button"
          onClick={() =>
            void (summaryQuery.isError
              ? summaryQuery.refetch()
              : sessionQuery.refetch())
          }
          className="mt-3 font-semibold underline"
        >
          Try again
        </button>
      </div>
    );
  }

  const data = summaryQuery.data;
  const isAdmin = Boolean(data.admin_stats);
  const isTutor = Boolean(data.tutor_stats);
  const persona = resolveDashboardPersona({ isAdmin, isTutor });
  const isAdminTutor = persona === "admin-tutor";
  const admin = data.admin_stats;
  const tutor = data.tutor_stats;
  const gradingItems =
    (isAdminTutor
      ? tutor?.needs_grading
      : admin?.needs_grading || tutor?.needs_grading) || [];
  const schedule =
    (isTutor ? data.my_today_schedule : data.today_schedule) || [];
  const firstName = sessionQuery.data.user.first_name;
  const description = isAdminTutor
    ? "See what needs your attention across teaching, assessments, students and payments."
    : isAdmin
      ? "Keep classes, assessments, students and payments moving."
      : "See your classes, subjects and assessment work in one place.";
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(amount);

  return (
    <div className="animate-in fade-in space-y-6 duration-500 sm:space-y-8">
      <DashboardPageHeader
        title={<DashboardGreeting name={firstName} />}
        description={description}
        actions={
          <>
            <Link
              href="/dashboard/schedule?new=1"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#994704] px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#7a3903] sm:px-4"
            >
              <span
                className="material-symbols-outlined text-xl"
                aria-hidden="true"
              >
                calendar_add_on
              </span>
              Schedule live class
            </Link>
            <Link
              href="/dashboard/mocks/builder"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#2e2877] bg-white px-3 py-2.5 text-sm font-semibold text-[#2e2877] transition-colors hover:bg-[#f5f3f2] sm:px-4"
            >
              <span className="material-symbols-outlined text-xl">quiz</span>
              Create mock
            </Link>
          </>
        }
      />
      {isAdmin && admin && (
        <section aria-labelledby="centre-summary">
          {isAdminTutor && (
            <h2
              id="centre-summary"
              className="mb-4 text-lg font-semibold text-[#1b1c1c]"
            >
              Centre overview
            </h2>
          )}
          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
            <StatCard
              title="Enrolled Students"
              value={admin.total_students}
              icon="groups"
              subtitle="Across the centre"
            />
            <StatCard
              title="Classes Today"
              value={admin.upcoming_classes}
              icon="event"
              subtitle="Scheduled centre-wide"
            />
            <StatCard
              title="Earnings This Month"
              value={formatCurrency(admin.mtd_revenue)}
              icon="payments"
              subtitle={`${admin.successful_payments || 0} successful payments`}
              isRevenue
            />
            <StatCard
              title={isAdminTutor ? "Tutors" : "Mock Answers to Grade"}
              value={
                isAdminTutor
                  ? admin.tutors_count
                  : admin.mocks?.pending_count || 0
              }
              icon={isAdminTutor ? "school" : "quiz"}
              subtitle={
                isAdminTutor
                  ? "Including you"
                  : `${admin.mocks?.active_count || 0} active mocks`
              }
            />
          </div>
        </section>
      )}
      {isTutor && tutor && (
        <section aria-labelledby="teaching-summary">
          {isAdminTutor && (
            <h2
              id="teaching-summary"
              className="mb-4 text-lg font-semibold text-[#1b1c1c]"
            >
              My teaching
            </h2>
          )}
          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
            <StatCard
              title="My Classes Today"
              value={tutor.classes_today}
              icon="laptop_chromebook"
              subtitle="Sessions assigned to you"
            />
            <StatCard
              title="Assignment Submissions to Grade"
              value={tutor.pending_submissions}
              icon="assignment_late"
              subtitle="Waiting for your review"
            />
            <StatCard
              title="Mock Answers to Grade"
              value={tutor.mocks?.pending_count || 0}
              icon="quiz"
              subtitle={`${tutor.mocks?.active_count || 0} active mocks`}
            />
            <StatCard
              title="My Subjects"
              value={tutor.my_courses}
              icon="library_books"
              subtitle="Subjects you teach"
            />
          </div>
        </section>
      )}
      <div className="flex flex-col gap-6 lg:flex-row">
        <section className="flex-1 rounded-lg border border-[#c8c5d2] bg-white p-4 shadow-[0_4px_20px_rgba(61,61,61,0.08)] sm:p-6">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[#1b1c1c]">
                {isTutor ? "My Schedule Today" : "Today's Centre Schedule"}
              </h2>
              <p className="mt-1 text-sm text-[#474551]">
                {schedule.length}{" "}
                {schedule.length === 1 ? "session" : "sessions"} today
              </p>
            </div>
            <Link
              href="/dashboard/schedule"
              className="flex items-center text-sm font-semibold text-[#c26627] hover:text-[#994704]"
            >
              Full Schedule
              <span className="material-symbols-outlined ml-1 text-base">
                arrow_forward
              </span>
            </Link>
          </div>
          {schedule.length ? (
            <div className="divide-y divide-[#eae8e7]">
              {schedule.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div className="w-16 shrink-0 text-sm font-bold text-[#2e2877]">
                    {new Date(item.scheduled_at).toLocaleTimeString("en-NG", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[#1b1c1c]">
                      {item.title}
                    </p>
                    <p className="truncate text-sm text-[#474551]">
                      {item.courses?.name || "General class"}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#f0eded] px-3 py-1 text-xs text-[#474551]">
                    {item.duration_minutes} min
                  </span>
                  {isTutor && (
                    <Link
                      href={`/class/${item.id}?start=true`}
                      className="ml-auto inline-flex min-h-10 items-center rounded-lg bg-[#2e2877] px-4 text-sm font-semibold text-white"
                    >
                      {item.status === "live" ? "Join" : "Start"}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border-2 border-dashed border-[#eae8e7] px-4 py-6 text-center sm:py-10">
              <h3 className="font-medium text-[#1b1c1c]">No classes today</h3>
              <p className="mt-1 text-sm text-[#474551]">
                Your next class will appear here.
              </p>
            </div>
          )}
        </section>
        <div className="w-full shrink-0 lg:w-[420px]">
          <NeedsGradingCard items={gradingItems} />
        </div>
      </div>
    </div>
  );
}
