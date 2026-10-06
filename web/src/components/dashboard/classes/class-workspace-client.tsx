"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  FilePlus2,
  GraduationCap,
  Plus,
  UsersRound,
  X,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dashboardQueryKeys } from "@/lib/dashboard-session";
import { authenticatedApiFetch } from "@/lib/authenticated-fetch";
import {
  ClassAssessmentsPanel,
  ClassLearnersPanel,
  ClassMaterialsPanel,
  ClassPerformancePanel,
  ClassSchedulePanel,
  LearnerPerformancePanel,
  type ClassAssessmentItem,
  type ClassMaterialItem,
  type ClassRecurringSlotItem,
  type ClassSessionItem,
  type LearnerRow,
} from "./class-workspace-panels";
import { ClassMaterialUploadDialog } from "./class-material-upload-dialog";
import { ClassStudentInviteDialog } from "./class-student-invite-dialog";
import { MockBuilderClient } from "../mocks/mock-builder-client";
import { MockResultsClient } from "../mocks/mock-results-client";
import { SubmissionsClient } from "../assignments/submissions-client";
import { AssignmentsClient } from "@/components/dashboard/assignments/assignments-client";
import { SessionDetailClient } from "../schedule/session-detail-client";
import { ClassSessionComposer } from "./class-session-composer";

type Subject = { id: string; name: string };
type ClassData = {
  id: string;
  name: string;
  description?: string | null;
  is_published: boolean;
  teaching_mode: string;
  courses: Subject[];
  enrolled_count?: number;
};
type LiveClass = {
  id: string;
  title: string;
  scheduled_at: string;
  status: string;
  course_id: string;
  course?: { name: string } | null;
};
type Mock = {
  id: string;
  title: string;
  status: string;
  course_id?: string | null;
  programme_id?: string | null;
  metrics?: { attempts: number };
};
type Assignment = {
  id: string;
  title: string;
  is_published: boolean;
  course_id: string;
  deadline_at?: string | null;
  submission_count?: number;
  course?: { id: string; name: string } | null;
};
type Note = {
  id: string;
  title: string;
  description?: string | null;
  file_type?: string | null;
  created_at: string;
  course_id: string;
  download_url?: string | null;
  file_name?: string | null;
  file_size_bytes?: number | null;
};
type RecurringSlot = {
  id: string;
  title?: string | null;
  course_id: string;
  weekday: number;
  start_time: string;
  duration_minutes?: number | null;
  course?: { name: string } | null;
};
type ScheduleData = { sessions: LiveClass[]; recurring_slots: RecurringSlot[] };
type LearnerSignal = {
  id: string;
  name: string;
  latest_result: number | null;
  attended: number;
  scheduled_sessions: number;
  attendance_rate: number | null;
  last_activity: string | null;
  attention: "Needs attention" | "On track" | "No signal yet";
};
type Topic = {
  topic: string;
  score: number;
  questions: number;
  state: "strong" | "developing" | "needs_attention";
};
type LearnerDetail = LearnerSignal & {
  previous_score: number | null;
  trend: "up" | "down" | "steady" | "no_signal";
  topics: Topic[];
  assessments: Array<{
    id: string;
    title: string;
    score: number | null;
    submitted_at: string | null;
  }>;
  insight_summary: string | null;
  recommended_action: string | null;
};
type Insights = {
  learners: LearnerSignal[];
  topics: Topic[];
  learner_detail?: LearnerDetail | null;
  class_health: {
    average_assessment_score: number | null;
    attendance: number | null;
    needs_attention: number;
  };
};
type Tab =
  | "overview"
  | "schedule"
  | "assessments"
  | "materials"
  | "learners"
  | "performance";

const tabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "schedule", label: "Schedule" },
  { id: "assessments", label: "Assessments" },
  { id: "materials", label: "Materials" },
  { id: "learners", label: "Students" },
  { id: "performance", label: "Performance" },
];
const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const activityFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

export function ClassWorkspaceClient({
  classId,
  token,
  canManageStudents = false,
}: {
  classId: string;
  token: string;
  canManageStudents?: boolean;
}) {
  const api = process.env.NEXT_PUBLIC_API_URL;
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [activeSubject, setActiveSubject] = useState("all");
  const [openAssessmentCreator, setOpenAssessmentCreator] = useState(0);
  const [showMaterialUpload, setShowMaterialUpload] = useState(false);
  const [showStudentInvite, setShowStudentInvite] = useState(false);
  const [showSessionComposer, setShowSessionComposer] = useState(false);
  const isCreatingQuiz = searchParams.get("create") === "quiz";
  const isCreatingAssignment = searchParams.get("create") === "assignment";
  const assessmentView = searchParams.get("assessment");
  const assessmentId = searchParams.get("assessment_id");
  const assessmentMode = searchParams.get("assessment_mode");
  const sessionId = searchParams.get("session_id");
  const [selectedLearnerId, setSelectedLearnerId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (requestedTab && tabs.some((item) => item.id === requestedTab)) {
      setActiveTab(requestedTab as Tab);
    } else {
      setActiveTab("overview");
    }
    if (searchParams.get("add_student") === "true" && canManageStudents) {
      setActiveTab("learners");
      setShowStudentInvite(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("add_student");
      window.history.replaceState(
        null,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
  }, [searchParams, canManageStudents]);

  const classQuery = useQuery({
    queryKey: ["class-workspace", classId],
    queryFn: async () => {
      const response = await authenticatedApiFetch(`${api}/classes/${classId}`);
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(body?.error || "Could not load this class");
      return body.data as ClassData;
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  });
  const data = classQuery.data;
  const scheduleQuery = useQuery({
    queryKey: ["class-schedule", classId],
    queryFn: async () => {
      const response = await authenticatedApiFetch(`${api}/classes/${classId}/schedule`);
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(body?.error || "Could not load this class schedule");
      return {
        sessions: body?.data?.sessions || [],
        recurring_slots: body?.data?.recurring_slots || [],
      } as ScheduleData;
    },
    staleTime: 30_000,
    refetchInterval: (query) => query.state.data?.sessions.some(s => s.status === 'live') ? 15000 : false,
  });
  const mocksQuery = useQuery({
    queryKey: ["class-mocks", classId],
    queryFn: async () => {
      const response = await authenticatedApiFetch(`${api}/mocks`);
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(body?.error || "Could not load assessments");
      return (body?.data || []) as Mock[];
    },
    staleTime: 60_000,
  });
  const assignmentsQuery = useQuery({
    queryKey: ["class-assignments", classId],
    queryFn: async () => {
      const response = await authenticatedApiFetch(`${api}/assignments?page_size=100`);
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(body?.error || "Could not load assignments");
      return (body?.data || []) as Assignment[];
    },
    staleTime: 60_000,
  });
  const visibleMaterialSubjectIds = useMemo(
    () =>
      data?.courses
        .filter(
          (subject) => activeSubject === "all" || subject.id === activeSubject,
        )
        .map((subject) => subject.id) || [],
    [activeSubject, data?.courses],
  );
  const materialsQuery = useQuery({
    queryKey: ["class-materials", classId, activeSubject],
    queryFn: async () => {
      const responses = await Promise.all(
        visibleMaterialSubjectIds.map(async (courseId) => {
          const response = await authenticatedApiFetch(`${api}/notes/${courseId}`);
          const body = await response.json().catch(() => null);
          if (!response.ok)
            throw new Error(body?.error || "Could not load materials");
          return (body?.data || []) as Note[];
        }),
      );
      return responses.flat();
    },
    // Materials are not part of Overview; defer potentially many per-subject
    // requests until the tutor actually opens that tab.
    enabled: Boolean(
      activeTab === "materials" && data && visibleMaterialSubjectIds.length,
    ),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const insightsQuery = useQuery({
    queryKey: ["class-insights", classId, activeSubject],
    queryFn: async () => {
      const query =
        activeSubject === "all"
          ? ""
          : `?course_id=${encodeURIComponent(activeSubject)}`;
      const response = await authenticatedApiFetch(
        `${api}/classes/${classId}/insights${query}`,
      );
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(body?.error || "Could not load learning signals");
      return body?.data as Insights;
    },
    enabled: Boolean(classQuery.data),
    staleTime: 60_000,
  });
  // A one-student class is not a tiny cohort. Fetch the same detailed evidence
  // that the student sheet uses and make it the Performance tab's main view.
  const singletonLearnerId =
    activeTab === "performance" && insightsQuery.data?.learners.length === 1
      ? insightsQuery.data.learners[0].id
      : null;
  const detailLearnerId = selectedLearnerId || singletonLearnerId;
  const learnerDetailQuery = useQuery({
    queryKey: [
      "class-learner-detail",
      classId,
      activeSubject,
      detailLearnerId,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({ learner_id: detailLearnerId! });
      if (activeSubject !== "all") params.set("course_id", activeSubject);
      const response = await authenticatedApiFetch(
        `${api}/classes/${classId}/insights?${params.toString()}`,
      );
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(body?.error || "Could not load this learner");
      return body?.data?.learner_detail as LearnerDetail | null;
    },
    enabled: Boolean(classQuery.data && detailLearnerId),
  });

  const schedule = scheduleQuery.data || { sessions: [], recurring_slots: [] };
  const sessions = schedule.sessions;
  const mocks = mocksQuery.data || [];
  const assignments = assignmentsQuery.data || [];
  const materials = materialsQuery.data || [];
  const insights = insightsQuery.data || null;

  const subjectIds = useMemo(
    () => new Set(data?.courses.map((subject) => subject.id) || []),
    [data],
  );
  const selectedSubject =
    activeSubject === "all"
      ? null
      : data?.courses.find((subject) => subject.id === activeSubject);
  const selectedName = selectedSubject?.name || "All subjects";
  const classSessions = sessions.filter(
    (session) =>
      subjectIds.has(session.course_id) &&
      (activeSubject === "all" || session.course_id === activeSubject),
  );
  const classMocks = mocks.filter((mock) => {
    const belongsToVisibleSubject = Boolean(
      mock.course_id && subjectIds.has(mock.course_id),
    );
    const isClassWide = mock.programme_id === classId;
    if (!belongsToVisibleSubject && !isClassWide) return false;
    // Class-wide assessments apply across its subjects; a subject-scoped view
    // keeps the matching subject plus any assessment that belongs to the whole class.
    return (
      activeSubject === "all" || mock.course_id === activeSubject || isClassWide
    );
  });
  const classAssignments = assignments.filter(
    (assignment) =>
      subjectIds.has(assignment.course_id) &&
      (activeSubject === "all" || assignment.course_id === activeSubject),
  );
  const upcoming = classSessions
    .filter(
      (item) =>
        item.status === "live" || new Date(item.scheduled_at) >= new Date(),
    )
    .sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at))[0];
  const needsAttention =
    insights?.learners.filter(
      (learner) => learner.attention === "Needs attention",
    ) || [];

  if (classQuery.isPending) return <WorkspaceLoading />;
  if (!data)
    return (
      <main className="w-full">
        <div className="rounded-2xl border border-[#f0c7c1] bg-[#fff8f7] p-6 text-sm text-[#8d2f22]">
          <p>This class could not be loaded.</p>
          <button
            onClick={() => void classQuery.refetch()}
            className="mt-3 rounded-lg border border-[#8d2f22] px-3 py-2 text-sm font-semibold"
          >
            Try again
          </button>
        </div>
      </main>
    );

  return (
    <>
      <main className="w-full pb-20 sm:pb-0">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#625e69]">
          <Link
            href="/dashboard/classes"
            className="inline-flex items-center gap-2 transition-colors hover:text-[#2e2877]"
          >
            <ArrowLeft size={16} /> Classes
          </Link>
          <span aria-hidden="true" className="text-[#aaa5af]">
            /
          </span>
          <span className="max-w-48 truncate text-[#46414a]">{data.name}</span>
        </div>
        <header className="mt-4">
          <div className="flex flex-col gap-4 border-b border-dashboard-outline pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-bold tracking-tight text-[#180d62] sm:text-[28px]">
                  {data.name}
                </h1>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${data.is_published ? "bg-[#e7f5eb] text-[#14532d]" : "bg-[#f5f3f2] text-[#625e69]"}`}
                >
                  {data.is_published ? "Published" : "Draft"}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-dashboard-muted">
                {data.courses.length > 1
                  ? "Multi-subject class"
                  : "Single-subject class"}
                {data.description ? ` · ${data.description}` : ""}
              </p>
            </div>
            <button
              type="button"
              disabled
              title="Subject management will be enabled with the class update flow."
              className="inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-[#312783] px-3.5 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-70 sm:w-fit"
            >
              <Plus size={17} /> Add subject
            </button>
          </div>
          {data.courses.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto py-3 [scrollbar-width:none]">
              <SubjectChip
                label="All subjects"
                active={activeSubject === "all"}
                onClick={() => setActiveSubject("all")}
              >
                All subjects
              </SubjectChip>
              {data.courses.map((subject) => (
                <SubjectChip
                  key={subject.id}
                  label={subject.name}
                  active={activeSubject === subject.id}
                  onClick={() => setActiveSubject(subject.id)}
                >
                  {subject.name}
                </SubjectChip>
              ))}
            </div>
          ) : null}
        </header>
        <div className="mt-2">
          <WorkspaceRail classId={classId} activeTab={activeTab} isOneToOne={classQuery.data?.teaching_mode === 'one_to_one'} />
          <div className="min-w-0">
            {activeTab === "overview" &&
              (scheduleQuery.isPending ||
              mocksQuery.isPending ||
              assignmentsQuery.isPending ||
              insightsQuery.isPending ? (
                <WorkspaceSectionLoading cards={3} />
              ) : (
                <Overview
                  upcoming={upcoming}
                  sessions={classSessions}
                  mocks={[
                    ...classMocks,
                    ...classAssignments.map(toAssignmentAsAssessment),
                  ]}
                  insights={insights}
                  needsAttention={needsAttention}
                  selectedName={selectedName}
                  subjects={data.courses}
                  onSelectSubject={setActiveSubject}
                  onCreateAssessment={() => {
                    router.push(
                      `/dashboard/classes/${classId}?tab=assessments`,
                    );
                    setOpenAssessmentCreator((value) => value + 1);
                  }}
                  onOpenSchedule={() => setShowSessionComposer(true)}
                  onAddMaterial={() => {
                    router.push(`/dashboard/classes/${classId}?tab=materials`);
                    setShowMaterialUpload(true);
                  }}
                />
              ))}
            {activeTab === "schedule" &&
              (sessionId ? (
                <section className="mt-5">
                  <SessionDetailClient
                    sessionId={sessionId}
                    backHref={`/dashboard/classes/${classId}?tab=schedule`}
                  />
                </section>
              ) : scheduleQuery.isPending ? (
                <WorkspaceSectionLoading cards={2} />
              ) : (
                <div className="mt-6 space-y-5">
                  <ClassSchedulePanel
                    sessions={classSessions.map(toSessionItem)}
                    recurringSlots={schedule.recurring_slots
                      .filter(
                        (slot) =>
                          activeSubject === "all" ||
                          slot.course_id === activeSubject,
                      )
                      .map((slot): ClassRecurringSlotItem => ({
                        id: slot.id,
                        title:
                          slot.title || slot.course?.name || "Teaching session",
                        subject: slot.course?.name || "Subject",
                        weekday: slot.weekday,
                        startTime: slot.start_time,
                        durationMinutes: slot.duration_minutes,
                      }))}
                    onAddSession={() => setShowSessionComposer(true)}
                    onOpenSession={(session) =>
                      navigate(
                        `/dashboard/classes/${classId}?tab=schedule&session_id=${session.id}`,
                      )
                    }
                    onStartSession={(session) =>
                      window.open(
                        `/class/${session.id}${session.status === "live" ? "" : "?start=true"}`,
                        "_blank",
                        "noopener,noreferrer"
                      )
                    }
                  />
                </div>
              ))}
            {activeTab === "assessments" &&
              (assessmentView === "assignment" && assessmentId ? (
                <section className="mt-5">
                  <ClassAssessmentBackButton classId={classId} />
                  <SubmissionsClient
                    assignmentId={assessmentId}
                    session={{ access_token: token }}
                    embedded
                  />
                </section>
              ) : assessmentView === "quiz" && assessmentId ? (
                <section className="mt-5">
                  <ClassAssessmentBackButton classId={classId} />
                  {assessmentMode === "builder" ? (
                    <MockBuilderClient token={token} embedded />
                  ) : (
                    <MockResultsClient
                      mockId={assessmentId}
                      embedded
                    />
                  )}
                </section>
              ) : isCreatingQuiz ? (
                <section className="mt-5">
                  <div className="mb-5 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-dashboard-outline bg-[#faf9ff] px-5 py-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[.14em] text-dashboard-accent">
                        Class assessment
                      </p>
                      <h2 className="mt-1 text-xl font-bold text-[#180d62]">
                        Create quiz
                      </h2>
                      <p className="mt-1 text-sm text-dashboard-muted">
                        This quiz is only for students in {data.name}.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/dashboard/classes/${classId}?tab=assessments`,
                        )
                      }
                      className="rounded-lg border border-[#312783] px-3.5 py-2 text-sm font-bold text-[#312783] hover:bg-[#f1efff]"
                    >
                      Back to assessments
                    </button>
                  </div>
                  <MockBuilderClient token={token} embedded />
                </section>
              ) : isCreatingAssignment ? (
                <section className="mt-5">
                  <ClassAssessmentBackButton classId={classId} />
                  <AssignmentsClient embedded />
                </section>
              ) : mocksQuery.isPending || assignmentsQuery.isPending ? (
                <WorkspaceSectionLoading cards={3} />
              ) : (
                <div className="mt-5">
                  <ClassAssessmentsPanel
                    assessments={[
                      ...classMocks.map((mock) => toAssessmentItem(mock, data)),
                      ...classAssignments.map(toAssignmentAsAssessment),
                    ]}
                    onCreate={() =>
                      navigate(
                        `/dashboard/classes/${classId}?tab=assessments&create=quiz&class_id=${encodeURIComponent(classId)}${activeSubject === "all" ? "" : `&course_id=${encodeURIComponent(activeSubject)}`}`,
                      )
                    }
                    onCreateAssignment={() =>
                      navigate(
                        `/dashboard/classes/${classId}?tab=assessments&create=assignment&class_id=${encodeURIComponent(classId)}${activeSubject === "all" ? "" : `&course_id=${encodeURIComponent(activeSubject)}`}`,
                      )
                    }
                    openCreateSignal={openAssessmentCreator}
                    onOpen={(assessment) =>
                      navigate(
                        assessment.type === "assignment"
                          ? `/dashboard/classes/${classId}?tab=assessments&assessment=assignment&assessment_id=${assessment.id}`
                          : `/dashboard/classes/${classId}?tab=assessments&assessment=quiz&assessment_id=${assessment.id}&assessment_mode=${assessment.status === "draft" ? "builder" : "results"}&class_id=${classId}`,
                      )
                    }
                  />
                </div>
              ))}
            {activeTab === "materials" &&
              (materialsQuery.isPending &&
              visibleMaterialSubjectIds.length > 0 ? (
                <WorkspaceSectionLoading cards={3} />
              ) : (
                <div className="mt-5">
                  <ClassMaterialsPanel
                    materials={materials.map((material) =>
                      toMaterialItem(material, data),
                    )}
                    onAdd={() => setShowMaterialUpload(true)}
                    onOpen={(material) => {
                      const item = materials.find(
                        (note) => note.id === material.id,
                      );
                      if (item?.download_url)
                        window.open(
                          item.download_url,
                          "_blank",
                          "noopener,noreferrer",
                        );
                    }}
                  />
                </div>
              ))}
            {activeTab === "learners" &&
              (insightsQuery.isPending ? (
                <WorkspaceSectionLoading cards={3} />
              ) : (
                <div className="mt-5">
                  <ClassLearnersPanel
                    learners={(insights?.learners || []).map(toLearnerRow)}
                    onInvite={
                      canManageStudents
                        ? () => setShowStudentInvite(true)
                        : undefined
                    }
                    onOpenLearner={(learner) =>
                      setSelectedLearnerId(learner.id)
                    }
                  />
                </div>
              ))}
            {activeTab === "performance" &&
              (insightsQuery.isPending ? (
                <WorkspaceSectionLoading cards={3} />
              ) : (
                <ClassPerformance
                  insights={insights}
                  learnerDetail={learnerDetailQuery.data || null}
                  learnerDetailLoading={learnerDetailQuery.isPending}
                  learnerDetailError={learnerDetailQuery.error instanceof Error ? learnerDetailQuery.error.message : null}
                  onRetryLearnerDetail={() => void learnerDetailQuery.refetch()}
                  onOpenLearner={setSelectedLearnerId}
                />
              ))}
          </div>
        </div>
      </main>
      {selectedLearnerId ? (
        <LearnerDetailSheet
          detail={learnerDetailQuery.data || null}
          loading={learnerDetailQuery.isPending}
          error={
            learnerDetailQuery.error instanceof Error
              ? learnerDetailQuery.error.message
              : null
          }
          onClose={() => setSelectedLearnerId(null)}
          onRetry={() => void learnerDetailQuery.refetch()}
        />
      ) : null}
      <ClassMaterialUploadDialog
        open={showMaterialUpload}
        onClose={() => setShowMaterialUpload(false)}
        subjects={data.courses}
        initialSubjectId={activeSubject === "all" ? null : activeSubject}
        api={api}
        onUploaded={async () => {
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: ["class-materials", classId],
            }),
            queryClient.invalidateQueries({
              queryKey: dashboardQueryKeys.summary,
            }),
          ]);
        }}
      />
      <ClassStudentInviteDialog
        open={showStudentInvite}
        onClose={() => setShowStudentInvite(false)}
        classId={classId}
        className={data.name}
        api={api}
        onInvited={async () => {
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: ["class-insights", classId],
            }),
            queryClient.invalidateQueries({
              queryKey: dashboardQueryKeys.summary,
            }),
          ]);
        }}
      />
      <ClassSessionComposer
        open={showSessionComposer}
        onClose={() => setShowSessionComposer(false)}
        onSaved={() => {
          void Promise.all([
            queryClient.invalidateQueries({
              queryKey: ["class-schedule", classId],
            }),
            queryClient.invalidateQueries({
              queryKey: ["class-insights", classId],
            }),
            queryClient.invalidateQueries({
              queryKey: dashboardQueryKeys.schedule,
            }),
            queryClient.invalidateQueries({
              queryKey: dashboardQueryKeys.timetable,
            }),
            queryClient.invalidateQueries({
              queryKey: dashboardQueryKeys.summary,
            }),
          ]);
        }}
        classId={classId}
        subjects={data.courses}
        initialCourseId={activeSubject === "all" ? undefined : activeSubject}
      />
    </>
  );
}

function WorkspaceRail({
  classId,
  activeTab,
  isOneToOne,
}: {
  classId: string;
  activeTab: Tab;
  isOneToOne: boolean;
}) {
  return (
    <section className="border-b border-dashboard-outline">
      <nav
        aria-label="Class workspace"
        className="flex gap-1 overflow-x-auto [scrollbar-width:none]"
      >
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={`/dashboard/classes/${classId}?tab=${tab.id}`}
            aria-current={activeTab === tab.id ? "page" : undefined}
            className={`relative min-h-12 shrink-0 border-b-[3px] px-4 py-3 text-left text-sm font-semibold transition ${activeTab === tab.id ? "border-[#994704] text-[#211969]" : "border-transparent text-[#625e69] hover:text-[#211969]"}`}
          >
            {tab.id === "learners" && isOneToOne ? "Student" : tab.label}
          </Link>
        ))}
      </nav>
    </section>
  );
}

function LearnerDetailSheet({
  detail,
  loading,
  error,
  onClose,
  onRetry,
}: {
  detail: LearnerDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close learner detail"
        onClick={onClose}
        className="absolute inset-0 bg-[#17141d]/35 backdrop-blur-[1px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Learner evidence"
        className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-3xl bg-[#fbfafb] shadow-2xl sm:inset-y-0 sm:left-auto sm:w-[min(680px,92vw)] sm:rounded-none"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-dashboard-outline bg-white/95 px-5 py-4 backdrop-blur sm:px-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-dashboard-accent">
              Student evidence
            </p>
            <h2 className="mt-1 text-lg font-bold text-[#180d62]">
              {detail?.name || "Student"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#625e69] hover:bg-[#f1efff] hover:text-[#180d62]"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-5 sm:p-7">
          {loading ? (
            <WorkspaceSectionLoading cards={3} />
          ) : error ? (
            <div className="rounded-2xl border border-[#f0c7c1] bg-[#fff8f7] p-5 text-sm text-[#8d2f22]">
              <p>{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 rounded-lg border border-[#8d2f22] px-3 py-2 font-semibold"
              >
                Try again
              </button>
            </div>
          ) : detail ? (
            <LearnerPerformancePanel
              data={{
                name: detail.name,
                recentScore: detail.latest_result,
                previousScore: detail.previous_score,
                trend: detail.trend,
                attendanceLabel: detail.scheduled_sessions
                  ? `${detail.attended}/${detail.scheduled_sessions}`
                  : null,
                topics: detail.topics.map((topic) => ({
                  topic: topic.topic,
                  state: topic.state,
                  detail: `${topic.score}% across ${topic.questions} marked ${topic.questions === 1 ? "question" : "questions"}`,
                })),
                assessments: detail.assessments.map((assessment) => ({
                  id: assessment.id,
                  title: assessment.title,
                  score: assessment.score,
                  dateLabel: assessment.submitted_at
                    ? activityFormat.format(new Date(assessment.submitted_at))
                    : null,
                })),
                insightSummary: detail.insight_summary,
                recommendedAction: detail.recommended_action,
              }}
            />
          ) : (
            <p className="text-sm text-dashboard-muted">
              No learner evidence is available yet.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

function navigate(href: string) {
  window.location.assign(href);
}

function ClassAssessmentBackButton({ classId }: { classId: string }) {
  return (
    <button
      type="button"
      onClick={() => navigate(`/dashboard/classes/${classId}?tab=assessments`)}
      className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#312783] bg-white px-3.5 text-sm font-bold text-[#312783] hover:bg-[#f1efff]"
    >
      <ArrowLeft size={16} /> Back to assessments
    </button>
  );
}
const weekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
function RecurringSchedule({ slots }: { slots: RecurringSlot[] }) {
  if (!slots.length) return null;
  return (
    <section className="rounded-2xl border border-dashboard-outline bg-white p-5 shadow-dashboard-card sm:p-6">
      <p className="text-[11px] font-bold uppercase tracking-[.14em] text-dashboard-accent">
        Recurring teaching times
      </p>
      <h2 className="mt-1 text-xl font-bold tracking-tight text-[#180d62]">
        Weekly arrangement
      </h2>
      <p className="mt-1 text-sm leading-6 text-dashboard-muted">
        These recurring slots create the dated sessions shown above.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {slots.map((slot) => (
          <article
            key={slot.id}
            className="rounded-xl border border-dashboard-outline bg-[#fbfaff] px-4 py-3"
          >
            <p className="font-bold text-[#27242d]">
              {slot.title || slot.course?.name || "Teaching session"}
            </p>
            <p className="mt-1 text-sm text-dashboard-muted">
              {weekdays[slot.weekday - 1] || "Weekly"} ·{" "}
              {slot.start_time.slice(0, 5)}
            </p>
            {slot.duration_minutes ? (
              <p className="mt-1 text-xs text-[#625e69]">
                {slot.duration_minutes} minutes
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
function toSessionItem(session: LiveClass): ClassSessionItem {
  const status: ClassSessionItem["status"] =
    session.status === "live"
      ? "live"
      : session.status === "completed"
        ? "completed"
        : session.status === "cancelled"
          ? "cancelled"
          : "scheduled";
  return {
    id: session.id,
    title: session.title,
    subject: session.course?.name || "Subject",
    startsAt: session.scheduled_at,
    status,
  };
}
function toAssessmentItem(mock: Mock, data: ClassData): ClassAssessmentItem {
  const status: ClassAssessmentItem["status"] =
    mock.status === "draft"
      ? "draft"
      : mock.status === "published" || mock.status === "open"
        ? "open"
        : mock.status === "completed" || mock.status === "closed"
          ? "closed"
          : "scheduled";
  return {
    id: mock.id,
    title: mock.title,
    subject: data.courses.find((subject) => subject.id === mock.course_id)
      ?.name,
    type: "mock",
    status,
    attempts: mock.metrics?.attempts,
  };
}
function toAssignmentAsAssessment(assignment: Assignment): ClassAssessmentItem {
  return {
    id: assignment.id,
    title: assignment.title,
    subject: assignment.course?.name || "Subject",
    type: "assignment",
    status: assignment.is_published ? "open" : "draft",
    dueAt: assignment.deadline_at || null,
    attempts: assignment.submission_count,
  };
}
function toMaterialItem(material: Note, data: ClassData): ClassMaterialItem {
  const fileType = material.file_type || "";
  const type: ClassMaterialItem["type"] =
    ["mp4", "webm", "mov"].includes(fileType) || fileType.startsWith("video/")
      ? "video"
      : fileType === "text/uri-list"
        ? "link"
        : fileType.includes("worksheet")
          ? "worksheet"
          : "document";
  return {
    id: material.id,
    title: material.title,
    description: material.description || null,
    subject:
      data.courses.find((subject) => subject.id === material.course_id)?.name ||
      "Subject",
    type,
    publishedAt: material.created_at,
    downloadUrl: material.download_url,
    fileType: material.file_type,
    fileName: material.file_name,
    fileSizeBytes: material.file_size_bytes,
  };
}
function toLearnerRow(learner: LearnerSignal): LearnerRow {
  return {
    id: learner.id,
    name: learner.name,
    latestResult: learner.latest_result,
    attendedSessions: learner.attended,
    scheduledSessions: learner.scheduled_sessions,
    lastActivityLabel: learner.last_activity
      ? activityFormat.format(new Date(learner.last_activity))
      : "No activity yet",
    attention:
      learner.attention === "Needs attention"
        ? "needs_attention"
        : learner.attention === "On track"
          ? "on_track"
          : "no_signal",
    attentionReason: attentionReason(learner),
  };
}
function ClassPerformance({
  insights,
  learnerDetail,
  learnerDetailLoading,
  learnerDetailError,
  onRetryLearnerDetail,
  onOpenLearner,
}: {
  insights: Insights | null;
  learnerDetail: LearnerDetail | null;
  learnerDetailLoading: boolean;
  learnerDetailError: string | null;
  onRetryLearnerDetail: () => void;
  onOpenLearner?: (learnerId: string) => void;
}) {
  if (!insights)
    return (
      <section className="mt-6 rounded-2xl border border-dashboard-outline bg-white p-6 text-sm text-dashboard-muted">
        Performance signals are not available yet.
      </section>
    );
  if (insights.learners.length === 1) {
    if (learnerDetailLoading) return <div className="mt-6"><WorkspaceSectionLoading cards={3} /></div>;
    if (learnerDetailError) return <section className="mt-6 rounded-2xl border border-[#f0c7c1] bg-[#fff8f7] p-6 text-sm text-[#8d2f22]"><p>{learnerDetailError}</p><button type="button" onClick={onRetryLearnerDetail} className="mt-3 rounded-lg border border-[#8d2f22] px-3 py-2 font-semibold">Try again</button></section>;
    const learner = learnerDetail || insights.learners[0];
    return (
      <div className="mt-6">
        <LearnerPerformancePanel
          data={{
            name: learner.name,
            recentScore: learner.latest_result,
            previousScore: learnerDetail?.previous_score,
            attendanceLabel: learner.scheduled_sessions
              ? `${learner.attended}/${learner.scheduled_sessions}`
              : null,
            trend: learnerDetail?.trend || "no_signal",
            topics: (learnerDetail?.topics || []).map((topic) => ({
              topic: topic.topic,
              state: topic.state,
              detail: `${topic.score}% across ${topic.questions} marked ${topic.questions === 1 ? "question" : "questions"}`,
            })),
            assessments: (learnerDetail?.assessments || []).map((assessment) => ({
              id: assessment.id,
              title: assessment.title,
              score: assessment.score,
              dateLabel: assessment.submitted_at ? activityFormat.format(new Date(assessment.submitted_at)) : null,
            })),
            insightSummary: learnerDetail?.insight_summary,
            recommendedAction: learnerDetail?.recommended_action,
          }}
        />
      </div>
    );
  }
  return (
    <div className="mt-6">
      <ClassPerformancePanel
        data={{
          attendanceLabel:
            insights.class_health.attendance === null
              ? null
              : `${insights.class_health.attendance}%`,
          learnersNeedingAttention: insights.class_health.needs_attention,
          topics: (insights.topics || []).map((topic) => ({
            topic: topic.topic,
            state: topic.state,
            detail: `${topic.score}% across ${topic.questions} marked ${topic.questions === 1 ? "question" : "questions"}`,
          })),
          attention: insights.learners
            .filter((learner) => learner.attention === "Needs attention")
            .map((learner) => ({
              learnerId: learner.id,
              learnerName: learner.name,
              kind:
                learner.latest_result !== null && learner.latest_result < 50
                  ? "repeated_errors"
                  : "low_participation",
              detail: attentionReason(learner),
            })),
        }}
        onOpenLearner={onOpenLearner}
      />
    </div>
  );
}

function SubjectChip({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${active ? "bg-[#2e2877] text-white shadow-sm" : "border border-[#d8d3d0] bg-white text-[#474551] hover:border-[#2e2877]/40 hover:text-[#180d62]"}`}
    >
      {children}
    </button>
  );
}
function Metric({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-xl border border-dashboard-outline bg-[#fbf9f8] p-3.5">
      <div className="flex items-center gap-2 text-[#994704]">
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="mt-3 text-xl font-bold tracking-tight text-[#180d62]">
        {value}
      </p>
      <p className="mt-1 text-xs text-dashboard-muted">{detail}</p>
    </article>
  );
}

function Overview({
  upcoming,
  sessions,
  mocks,
  insights,
  needsAttention,
  selectedName,
  subjects,
  onSelectSubject,
  onCreateAssessment,
  onOpenSchedule,
  onAddMaterial,
}: {
  upcoming?: LiveClass;
  sessions: LiveClass[];
  mocks: Array<Mock | ClassAssessmentItem>;
  insights: Insights | null;
  needsAttention: LearnerSignal[];
  selectedName: string;
  subjects: Subject[];
  onSelectSubject: (id: string) => void;
  onCreateAssessment: () => void;
  onOpenSchedule: () => void;
  onAddMaterial: () => void;
}) {
  const upcomingCount = sessions.filter(
    (session) => {
      const scheduledTime = new Date(session.scheduled_at).getTime();
      const nowTime = Date.now();
      const oneWeek = nowTime + 7 * 24 * 60 * 60 * 1000;
      return session.status === "live" || (scheduledTime >= nowTime && scheduledTime <= oneWeek);
    }
  ).length;
  const now = new Date();
  const activities = [
    ...sessions
      .filter((session) =>
        session.status === "completed" ||
        session.status === "live" ||
        session.status === "cancelled" ||
        new Date(session.scheduled_at) <= now,
      )
      .map((session) => ({
      id: `session-${session.id}`,
      kind: "Session",
      title: session.title,
      detail: `${session.course?.name || selectedName} · ${dateFormat.format(new Date(session.scheduled_at))}`,
      date: session.scheduled_at,
      tone: "session" as const,
    })),
    ...mocks.map((assessment) => {
      const item: ClassAssessmentItem =
        "is_published" in assessment
          ? toAssignmentAsAssessment(assessment as Assignment)
          : toAssessmentItem(
              assessment as Mock,
              { courses: subjects } as ClassData,
            );
      return {
        id: `assessment-${item.id}`,
        kind: item.type === "assignment" ? "Assignment" : "Assessment",
        title: item.title,
        detail: item.subject || selectedName,
        date: "",
        tone: "assessment" as const,
      };
    }),
  ].sort((a, b) => +new Date(b.date || 0) - +new Date(a.date || 0));

  return (
    <section className="mt-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <WorkspaceMetric
          icon={<UsersRound size={18} />}
          label="Total students"
          value={String(insights?.learners.length ?? 0)}
          detail="Enrolled in this class"
        />
        <WorkspaceMetric
          icon={<CalendarDays size={18} />}
          label="Upcoming sessions"
          value={String(upcomingCount)}
          detail={
            upcoming
              ? dateFormat.format(new Date(upcoming.scheduled_at))
              : "Nothing scheduled"
          }
        />
        <WorkspaceMetric
          icon={<ClipboardCheck size={18} />}
          label="Assessments"
          value={String(mocks.length)}
          detail="Assigned to this class"
        />
        <WorkspaceMetric
          icon={<GraduationCap size={18} />}
          label="Avg. performance"
          value={
            insights?.class_health.average_assessment_score === null ||
            insights?.class_health.average_assessment_score === undefined
              ? "—"
              : `${insights.class_health.average_assessment_score}%`
          }
          detail="From marked assessments"
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="overflow-hidden rounded-xl border border-dashboard-outline bg-white shadow-dashboard-card">
          <header className="flex items-center justify-between border-b border-dashboard-outline px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-base font-bold text-[#180d62]">
                Recent activity
              </h2>
              <p className="mt-0.5 text-sm text-dashboard-muted">
                What has happened in this class.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenSchedule}
              className="text-sm font-bold text-[#312783] hover:underline"
            >
              View schedule
            </button>
          </header>
          {activities.length ? (
            <div className="divide-y divide-dashboard-outline">
              {activities.slice(0, 5).map((activity) => (
                <article
                  key={activity.id}
                  className="flex items-center gap-3 px-5 py-4 sm:px-6"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${activity.tone === "session" ? "bg-[#eef0ff] text-[#312783]" : "bg-[#fff3d7] text-[#765a13]"}`}
                  >
                    {activity.tone === "session" ? (
                      <CalendarDays size={17} />
                    ) : (
                      <ClipboardCheck size={17} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#27242d]">
                      {activity.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-dashboard-muted">
                      {activity.kind} · {activity.detail}
                    </p>
                  </div>
                  {activity.date ? (
                    <time className="hidden shrink-0 text-xs text-[#79727c] sm:block">
                      {activityFormat.format(new Date(activity.date))}
                    </time>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="px-5 py-10 text-center sm:px-6">
              <p className="font-bold text-[#27242d]">No activity yet</p>
              <p className="mt-1 text-sm text-dashboard-muted">
                Schedule a session or create an assessment to start this class.
              </p>
            </div>
          )}
        </section>
        <aside className="rounded-xl border border-dashboard-outline bg-white p-5 shadow-dashboard-card">
          <h2 className="text-base font-bold text-[#180d62]">Quick actions</h2>
          <div className="mt-4 space-y-2.5">
            <WorkspaceAction
              icon={<CalendarDays size={17} />}
              title="Schedule live class"
              description="Choose a date and time"
              onClick={onOpenSchedule}
              primary
            />
            <WorkspaceAction
              icon={<FilePlus2 size={17} />}
              title="Create assessment"
              description="Create a mock or assignment for this class"
              onClick={onCreateAssessment}
            />
            <WorkspaceAction
              icon={<BookOpen size={17} />}
              title="Add material"
              description="Share a class resource"
              onClick={onAddMaterial}
            />
            {subjects.length > 1 ? (
              <button
                type="button"
                onClick={() => onSelectSubject("all")}
                className="flex w-full items-center justify-between px-1 pt-1 text-sm font-bold text-[#312783] hover:underline"
              >
                View all subjects <ChevronRight size={16} />
              </button>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  );
}

function WorkspaceMetric({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-xl border border-dashboard-outline bg-white px-4 py-4 shadow-dashboard-card">
      <div className="flex items-center gap-2 text-[#6b63a9]">
        {icon}
        <p className="text-xs font-bold text-[#625e69]">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-[#180d62]">
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-dashboard-muted">{detail}</p>
    </article>
  );
}

function WorkspaceAction({
  icon,
  title,
  description,
  onClick,
  primary = false,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition ${primary ? "border-[#312783] bg-[#312783] text-white hover:bg-[#241c70]" : "border-dashboard-outline bg-white text-[#27242d] hover:border-[#8e87bd] hover:bg-[#fbfaff]"}`}
    >
      <span className={primary ? "text-white" : "text-[#312783]"}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-bold">{title}</span>
        <span
          className={`mt-0.5 block text-xs ${primary ? "text-[#e1ddff]" : "text-dashboard-muted"}`}
        >
          {description}
        </span>
      </span>
      <ChevronRight className="ml-auto shrink-0" size={16} />
    </button>
  );
}

function WorkspaceList({
  title,
  description,
  empty,
  items,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  empty: string;
  items: Array<{
    id: string;
    title: string;
    detail: string;
    href: string;
    live?: boolean;
  }>;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-dashboard-outline bg-white p-5 shadow-dashboard-card sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#180d62]">{title}</h2>
          <p className="mt-1 text-sm text-dashboard-muted">{description}</p>
        </div>
        <Link
          href={actionHref}
          className="w-fit text-sm font-semibold text-[#994704] hover:underline"
        >
          {actionLabel}
        </Link>
      </div>
      {items.length ? (
        <div className="mt-5 divide-y divide-dashboard-outline">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="group flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0 hover:bg-[#fbf9f8]"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold text-[#1b1c1c]">
                    {item.title}
                  </p>
                  {item.live && (
                    <span className="rounded-full bg-[#ffdad6] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#8d2f22]">
                      Live
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-dashboard-muted">
                  {item.detail}
                </p>
              </div>
              <ChevronRight
                className="shrink-0 text-[#625e69] transition-transform group-hover:translate-x-0.5"
                size={18}
              />
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-5 rounded-xl bg-[#fbf9f8] p-5 text-sm leading-6 text-dashboard-muted">
          {empty}
        </p>
      )}
    </section>
  );
}
function WorkspaceLink({
  title,
  text,
  href,
  label,
  icon,
}: {
  title: string;
  text: string;
  href: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-dashboard-outline bg-white p-6 shadow-dashboard-card">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f7f6ff] text-[#2e2877]">
        {icon}
      </div>
      <h2 className="mt-4 text-xl font-bold text-[#180d62]">{title}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-dashboard-muted">
        {text}
      </p>
      <Link
        href={href}
        className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[#2e2877] px-4 py-2.5 text-sm font-semibold text-[#2e2877] hover:bg-[#f7f6ff]"
      >
        {label}
        <ChevronRight size={16} />
      </Link>
    </section>
  );
}
function LearnerRoster({ learners }: { learners: LearnerSignal[] }) {
  return (
    <section className="mt-6 rounded-2xl border border-dashboard-outline bg-white p-5 shadow-dashboard-card sm:p-6">
      <h2 className="text-xl font-bold text-[#180d62]">Learners</h2>
      <p className="mt-1 text-sm text-dashboard-muted">
        Latest learning and participation signals for this class.
      </p>
      {learners.length ? (
        <>
          <div className="mt-5 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-dashboard-outline text-[11px] uppercase tracking-[.1em] text-dashboard-muted">
                <tr>
                  <th className="pb-3 font-semibold">Learner</th>
                  <th className="pb-3 font-semibold">Latest result</th>
                  <th className="pb-3 font-semibold">Attendance</th>
                  <th className="pb-3 font-semibold">Last activity</th>
                  <th className="pb-3 font-semibold">Attention</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashboard-outline">
                {learners.map((learner) => (
                  <tr key={learner.id}>
                    <td className="py-4 font-semibold text-[#1b1c1c]">
                      {learner.name}
                    </td>
                    <td className="py-4">
                      {learner.latest_result === null
                        ? "—"
                        : `${learner.latest_result}%`}
                    </td>
                    <td className="py-4">
                      {learner.scheduled_sessions
                        ? `${learner.attended}/${learner.scheduled_sessions}`
                        : "—"}
                    </td>
                    <td className="py-4">
                      {learner.last_activity
                        ? activityFormat.format(new Date(learner.last_activity))
                        : "No activity yet"}
                    </td>
                    <td className="py-4">
                      <AttentionBadge attention={learner.attention} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5 space-y-3 md:hidden">
            {learners.map((learner) => (
              <article
                key={learner.id}
                className="rounded-xl border border-dashboard-outline p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-[#1b1c1c]">{learner.name}</p>
                  <AttentionBadge attention={learner.attention} />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <Signal
                    label="Latest result"
                    value={
                      learner.latest_result === null
                        ? "—"
                        : `${learner.latest_result}%`
                    }
                  />
                  <Signal
                    label="Attendance"
                    value={
                      learner.scheduled_sessions
                        ? `${learner.attended}/${learner.scheduled_sessions}`
                        : "—"
                    }
                  />
                  <Signal
                    label="Last activity"
                    value={
                      learner.last_activity
                        ? activityFormat.format(new Date(learner.last_activity))
                        : "No activity yet"
                    }
                  />
                </dl>
              </article>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-5 rounded-xl bg-[#fbf9f8] p-5 text-sm text-dashboard-muted">
          No learner signals yet.
        </p>
      )}
    </section>
  );
}
function PerformancePanel({
  insights,
  learnerCount,
}: {
  insights: Insights | null;
  learnerCount: number;
}) {
  if (!insights)
    return (
      <section className="mt-6 rounded-2xl border border-dashboard-outline bg-white p-6 text-sm text-dashboard-muted">
        Performance signals are not available yet.
      </section>
    );
  if (learnerCount === 1) {
    const learner = insights.learners[0];
    return (
      <section className="mt-6 rounded-2xl border border-dashboard-outline bg-white p-5 shadow-dashboard-card sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-dashboard-accent">
          Learner performance
        </p>
        <h2 className="mt-1 text-2xl font-bold text-[#180d62]">
          {learner.name}
        </h2>
        <p className="mt-2 text-sm text-dashboard-muted">
          This view stays focused on the learner, rather than meaningless class
          comparisons.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Metric
            label="Recent result"
            value={
              learner.latest_result === null ? "—" : `${learner.latest_result}%`
            }
            detail="Most recent assessment"
            icon={<ClipboardCheck size={19} />}
          />
          <Metric
            label="Attendance"
            value={
              learner.scheduled_sessions
                ? `${learner.attended}/${learner.scheduled_sessions}`
                : "—"
            }
            detail="Sessions attended"
            icon={<CalendarDays size={19} />}
          />
          <Metric
            label="Attention"
            value={learner.attention}
            detail="Current signal"
            icon={<UsersRound size={19} />}
          />
        </div>
      </section>
    );
  }
  const attention = insights.learners.filter(
    (learner) => learner.attention === "Needs attention",
  );
  return (
    <section className="mt-6 space-y-5">
      <div className="rounded-2xl border border-dashboard-outline bg-white p-5 shadow-dashboard-card sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-dashboard-accent">
          Class health
        </p>
        <h2 className="mt-1 text-2xl font-bold text-[#180d62]">
          Understand what is happening
        </h2>
        <p className="mt-2 text-sm text-dashboard-muted">
          Use the signals to decide where your teaching attention goes next.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Metric
            label="Assessment signal"
            value={
              insights.class_health.average_assessment_score === null
                ? "—"
                : `${insights.class_health.average_assessment_score}%`
            }
            detail="Across assessed learners"
            icon={<ClipboardCheck size={19} />}
          />
          <Metric
            label="Attendance"
            value={
              insights.class_health.attendance === null
                ? "—"
                : `${insights.class_health.attendance}%`
            }
            detail="Across scheduled sessions"
            icon={<CalendarDays size={19} />}
          />
          <Metric
            label="Needs attention"
            value={String(insights.class_health.needs_attention)}
            detail="Learners with a signal"
            icon={<UsersRound size={19} />}
          />
        </div>
      </div>
      <div className="rounded-2xl border border-dashboard-outline bg-white p-5 shadow-dashboard-card sm:p-6">
        <h2 className="text-xl font-bold text-[#180d62]">Needs attention</h2>
        <div className="mt-4 divide-y divide-dashboard-outline">
          {attention.map((learner) => (
            <div
              key={learner.id}
              className="flex items-center justify-between gap-4 py-3"
            >
              <div>
                <p className="font-semibold text-[#1b1c1c]">{learner.name}</p>
                <p className="mt-1 text-sm text-[#8d2f22]">
                  {attentionReason(learner)}
                </p>
              </div>
              <AttentionBadge attention={learner.attention} />
            </div>
          ))}
          {!attention.length && (
            <p className="py-3 text-sm text-dashboard-muted">
              No learners need attention from the available signals.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
function AttentionBadge({
  attention,
}: {
  attention: LearnerSignal["attention"];
}) {
  const tone =
    attention === "Needs attention"
      ? "bg-[#ffdad6] text-[#8d2f22]"
      : attention === "On track"
        ? "bg-[#e7f5eb] text-[#14532d]"
        : "bg-[#f5f3f2] text-[#625e69]";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}
    >
      {attention}
    </span>
  );
}
function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-dashboard-muted">{label}</dt>
      <dd className="mt-1 font-semibold text-[#1b1c1c]">{value}</dd>
    </div>
  );
}
function attentionReason(learner: LearnerSignal) {
  if (learner.latest_result !== null && learner.latest_result < 50)
    return "Low recent result";
  if (
    learner.scheduled_sessions &&
    learner.attendance_rate !== null &&
    learner.attendance_rate < 70
  )
    return "Low attendance";
  return "Follow up on learning signals";
}
function formatStatus(status: string) {
  return status
    ? status.charAt(0).toUpperCase() + status.slice(1)
    : "Assessment";
}
function WorkspaceLoading() {
  return (
    <main className="w-full animate-pulse">
      <div className="h-4 w-24 rounded bg-[#e9e6e5]" />
      <section className="mt-5 rounded-2xl border border-dashboard-outline bg-white p-6">
        <div className="h-3 w-14 rounded bg-[#e9e6e5]" />
        <div className="mt-3 h-9 w-64 max-w-full rounded bg-[#e9e6e5]" />
        <div className="mt-8 h-11 w-full rounded bg-[#f1eeee]" />
      </section>
      <section className="mt-6 grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
        <div className="h-60 rounded-2xl border border-dashboard-outline bg-white" />
        <div className="h-60 rounded-2xl border border-dashboard-outline bg-white" />
      </section>
    </main>
  );
}
function WorkspaceSectionLoading({ cards }: { cards: number }) {
  return (
    <section
      className="mt-6 animate-pulse rounded-2xl border border-dashboard-outline bg-white shadow-dashboard-card"
      aria-busy="true"
      aria-label="Loading class information"
    >
      <div className="border-b border-dashboard-outline px-5 py-5 sm:px-6">
        <div className="h-3 w-24 rounded bg-[#e9e6e5]" />
        <div className="mt-3 h-6 w-48 max-w-full rounded bg-[#e9e6e5]" />
        <div className="mt-3 h-4 w-80 max-w-full rounded bg-[#f1eeee]" />
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
        {Array.from({ length: cards }, (_, index) => (
          <div key={index} className="h-28 rounded-xl bg-[#f7f5f4]" />
        ))}
      </div>
    </section>
  );
}
