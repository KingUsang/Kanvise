"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Loader2,
  Plus,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dashboardQueryKeys } from "@/lib/dashboard-session";

type Tutor = { id: string; first_name: string; last_name: string };
type Course = { id: string; name: string };
type TeachingClass = { id: string; name: string; courses: Course[] };
type LiveClass = {
  id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  status: "scheduled" | "live" | "completed" | "cancelled";
  tutor_id: string;
  access_mode: "anyone_with_link" | "enrolled_learners";
  course?: Course | null;
  tutor?: Tutor | null;
  series?: { id: string; recurrence_group_id?: string | null } | null;
};
type Props = {
  token: string;
  capabilities: { isAdmin: boolean; isTutor: boolean };
  user: Tutor;
};
type Composer = { date: Date; hour: number; existing?: LiveClass } | null;

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// A centre can teach well into the evening. Keep the complete day available in
// a scrollable grid rather than silently clipping sessions after office hours.
const startHour = 7;
const endHour = 24;
const startOfWeek = (value: Date) => {
  const next = new Date(value);
  const day = next.getDay() || 7;
  next.setDate(next.getDate() - day + 1);
  next.setHours(0, 0, 0, 0);
  return next;
};
const addDays = (value: Date, days: number) => {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
};
const startOfMonth = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), 1);
const addMonths = (value: Date, months: number) =>
  new Date(value.getFullYear(), value.getMonth() + months, 1);
const dateInput = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
const sameDay = (a: Date, b: Date) => dateInput(a) === dateInput(b);
const clock = (value: Date) =>
  value.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const fullName = (person?: Tutor | null) =>
  `${person?.first_name || ""} ${person?.last_name || ""}`.trim() || "Tutor";

function overlaps(
  candidate: { date: string; time: string; duration: number; tutorId: string },
  classes: LiveClass[],
  except?: string,
) {
  const start = new Date(`${candidate.date}T${candidate.time}:00`).getTime();
  const end = start + candidate.duration * 60_000;
  return classes.some((item) => {
    if (
      item.id === except ||
      item.tutor_id !== candidate.tutorId ||
      !["scheduled", "live"].includes(item.status)
    )
      return false;
    const itemStart = new Date(item.scheduled_at).getTime();
    return (
      start < itemStart + item.duration_minutes * 60_000 && itemStart < end
    );
  });
}

export function ClassesWorkspace({ token, capabilities, user }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = process.env.NEXT_PUBLIC_API_URL;
  const headers = { Authorization: `Bearer ${token}` };
  const queryClient = useQueryClient();
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const [mobileDay, setMobileDay] = useState(new Date());
  const [mobileMonth, setMobileMonth] = useState(() =>
    startOfMonth(new Date()),
  );
  const [composer, setComposer] = useState<Composer>(null);
  const [saving, setSaving] = useState(false);
  const handledLaunch = useRef(false);
  const calendarGridRef = useRef<HTMLDivElement>(null);
  const lastScrolledWeek = useRef("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState("60");
  const [access, setAccess] = useState<
    "anyone_with_link" | "enrolled_learners"
  >("anyone_with_link");
  const [classId, setClassId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [tutorId, setTutorId] = useState(user.id);
  const [eligibleTutorIds, setEligibleTutorIds] = useState<string[]>([]);
  const [repeat, setRepeat] = useState(false);
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const scheduleQuery = useQuery({
    queryKey: dashboardQueryKeys.schedule,
    staleTime: 30_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    queryFn: async () => {
      const requests: Promise<Response>[] = [
        fetch(`${api}/live-classes`, { headers }),
        fetch(`${api}/classes`, { headers }),
      ];
      if (capabilities.isAdmin)
        requests.push(fetch(`${api}/users/tutors`, { headers }));
      const [classResponse, courseResponse, tutorResponse] =
        await Promise.all(requests);
      const classBody = await classResponse.json().catch(() => null);
      if (!classResponse.ok)
        throw new Error(classBody?.error || "Could not load live classes");
      const courseBody = courseResponse.ok
        ? await courseResponse.json()
        : { data: [] };
      const tutorBody = tutorResponse?.ok
        ? await tutorResponse.json()
        : { data: [] };
      const team = (tutorBody.data || []) as Tutor[];
      return {
        classes: (classBody?.data || []) as LiveClass[],
        teachingClasses: (courseBody.data || []) as TeachingClass[],
        tutors: team.some((item) => item.id === user.id)
          ? team
          : [user, ...team],
      };
    },
  });
  const classes = scheduleQuery.data?.classes || [];
  const teachingClasses = scheduleQuery.data?.teachingClasses || [];
  const tutors = scheduleQuery.data?.tutors || [user];
  const loading = scheduleQuery.isPending;
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(week, index)),
    [week],
  );
  const visible = classes.filter((item) =>
    ["scheduled", "live"].includes(item.status),
  );
  const mobileMonthDays = useMemo(() => {
    const firstWeekday = (mobileMonth.getDay() + 6) % 7;
    const numberOfDays = new Date(
      mobileMonth.getFullYear(),
      mobileMonth.getMonth() + 1,
      0,
    ).getDate();
    return Array.from({ length: firstWeekday + numberOfDays }, (_, index) =>
      index < firstWeekday
        ? null
        : new Date(
            mobileMonth.getFullYear(),
            mobileMonth.getMonth(),
            index - firstWeekday + 1,
          ),
    );
  }, [mobileMonth]);
  const weekSessions = useMemo(
    () =>
      visible.filter((item) => {
        const scheduled = new Date(item.scheduled_at);
        return scheduled >= week && scheduled < addDays(week, 7);
      }),
    [visible, week],
  );
  const nextSession = useMemo(
    () =>
      visible
        .filter((item) => new Date(item.scheduled_at) >= new Date())
        .sort(
          (a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at),
        )[0],
    [visible],
  );
  const selectedClass = teachingClasses.find((item) => item.id === classId);
  const selectedClassSubjects = selectedClass?.courses || [];
  const existingSessionLocked = Boolean(
    composer?.existing && composer.existing.status !== "scheduled",
  );
  const conflict = Boolean(
    date &&
    time &&
    tutorId &&
    overlaps(
      { date, time, duration: Number(duration), tutorId },
      visible,
      composer?.existing?.id,
    ),
  );

  useEffect(() => {
    if (handledLaunch.current || loading || searchParams.get("new") !== "1")
      return;
    handledLaunch.current = true;
    const selectedCourse = searchParams.get("course_id");
    open(new Date());
    setAccess("enrolled_learners");
    const parentClass = teachingClasses.find((item) =>
      item.courses.some((course) => course.id === selectedCourse),
    );
    if (selectedCourse && parentClass) {
      setClassId(parentClass.id);
      setCourseId(selectedCourse);
    }
  }, [teachingClasses, loading, searchParams]);
  useEffect(() => {
    if (access !== "enrolled_learners" || !courseId || composer?.existing) {
      setEligibleTutorIds([]);
      return;
    }
    let active = true;
    void fetch(`${api}/courses/${courseId}/tutors`, { headers })
      .then(async (response) => (response.ok ? response.json() : { data: [] }))
      .then((body) => {
        if (!active) return;
        const ids = (body.data || []).map(
          (assignment: { tutor_id: string }) => assignment.tutor_id,
        );
        setEligibleTutorIds(ids);
        if (ids.length === 1) setTutorId(ids[0]);
      })
      .catch(() => {
        if (active) setEligibleTutorIds([]);
      });
    return () => {
      active = false;
    };
  }, [access, courseId, composer?.existing?.id]);
  useEffect(() => {
    if (loading || !weekSessions.length) return;
    const firstSession = [...weekSessions].sort(
      (a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at),
    )[0];
    const scrollKey = `${dateInput(week)}:${firstSession.id}`;
    if (lastScrolledWeek.current === scrollKey) return;
    lastScrolledWeek.current = scrollKey;
    const top = Math.max(
      0,
      (new Date(firstSession.scheduled_at).getHours() - startHour - 1) * 74,
    );
    requestAnimationFrame(() =>
      calendarGridRef.current?.scrollTo({ top, behavior: "auto" }),
    );
  }, [loading, week, weekSessions]);
  function open(day: Date, hour = 10, existing?: LiveClass) {
    const scheduled = existing ? new Date(existing.scheduled_at) : day;
    const parentClass = teachingClasses.find((item) =>
      item.courses.some((course) => course.id === existing?.course?.id),
    );
    setComposer({ date: day, hour, existing });
    setDate(dateInput(scheduled));
    setTime(
      existing
        ? scheduled.toTimeString().slice(0, 5)
        : `${String(hour).padStart(2, "0")}:00`,
    );
    setTitle(existing?.title || "");
    setDuration(String(existing?.duration_minutes || 60));
    setAccess(existing?.access_mode || "anyone_with_link");
    setClassId(parentClass?.id || "");
    setCourseId(existing?.course?.id || "");
    setTutorId(existing?.tutor_id || user.id);
    setRepeat(false);
    setRepeatDays([]);
  }
  function toggleDay(day: number) {
    setRepeatDays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day].sort(),
    );
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (
      !composer ||
      !title.trim() ||
      !date ||
      !time ||
      conflict ||
      (access === "enrolled_learners" && !courseId)
    )
      return;
    setSaving(true);
    try {
      const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
      let response: Response;
      if (composer.existing)
        response = await fetch(`${api}/live-classes/${composer.existing.id}`, {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            scheduled_at: scheduledAt,
            duration_minutes: Number(duration),
          }),
        });
      else
        response = await fetch(`${api}/live-classes`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            tutor_id: tutorId,
            course_id: access === "enrolled_learners" ? courseId : undefined,
            scheduled_at: scheduledAt,
            duration_minutes: Number(duration),
            access_mode: access,
            recurrence: repeat ? "weekly" : "once",
            recurrence_days: repeat ? repeatDays : undefined,
            starts_on: repeat ? date : undefined,
            start_time: repeat ? time : undefined,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not save this live class");
      setComposer(null);
      toast.success(
        composer.existing
          ? "Live class updated"
          : repeat
            ? "Recurring live classes scheduled"
            : "Live class scheduled",
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.schedule,
        }),
        queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.timetable,
        }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.summary }),
        ...(classId
          ? [
              queryClient.invalidateQueries({
                queryKey: ["class-schedule", classId],
              }),
            ]
          : []),
      ]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save this live class",
      );
    } finally {
      setSaving(false);
    }
  }
  async function cancel(item: LiveClass) {
    if (!window.confirm(`Cancel “${item.title}”?`)) return;
    const response = await fetch(`${api}/live-classes/${item.id}`, {
      method: "DELETE",
      headers,
    });
    const body = await response.json();
    if (!response.ok)
      return toast.error(body.error || "Could not cancel this live class");
    setComposer(null);
    toast.success("Live class cancelled");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.schedule }),
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.timetable }),
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.summary }),
    ]);
  }
  async function endSeries(item: LiveClass) {
    const seriesId = item.series?.recurrence_group_id || item.series?.id;
    if (
      !seriesId ||
      !window.confirm("End this recurring series and remove future sessions?")
    )
      return;
    const response = await fetch(`${api}/live-classes/series/${seriesId}`, {
      method: "DELETE",
      headers,
    });
    const body = await response.json();
    if (!response.ok) return toast.error(body.error || "Could not end series");
    setComposer(null);
    toast.success("Recurring series ended");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.schedule }),
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.timetable }),
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.summary }),
    ]);
  }
  async function start(item: LiveClass) {
    const response = await fetch(`${api}/live-classes/${item.id}/start`, {
      method: "POST",
      headers,
    });
    const body = await response.json();
    if (!response.ok) return toast.error(body.error || "Could not start this live class");
    window.open(`/class/${item.id}?start=true`, "_blank", "noopener,noreferrer");
  }
  async function copyClassroomLink(value: string) {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
      else {
        const input = document.createElement('textarea');
        input.value = value;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        const copied = document.execCommand('copy');
        input.remove();
        if (!copied) throw new Error('Copy was blocked')
      }
      toast.success('Classroom link copied')
    } catch {
      toast.error('Could not copy the classroom link')
    }
  }
  function selectMobileMonth(month: Date) {
    setMobileMonth(month);
    const selected = new Date(month.getFullYear(), month.getMonth(), 1);
    setMobileDay(selected);
    setWeek(startOfWeek(selected));
  }

  const availableTutors = eligibleTutorIds.length
    ? tutors.filter((item) => eligibleTutorIds.includes(item.id))
    : tutors;
  // DashboardShell owns the page gutter. Calendar must not add another layer
  // of horizontal padding or it visibly drifts from the other workspace pages.
  return (
    <main className="w-full md:-mt-3">
      <header className="flex flex-col gap-4 border-b border-[#e5e1dd] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#994704]">
            Teaching calendar
          </p>
          <h1 className="mt-1 text-3xl font-bold text-[#180d62]">Calendar</h1>
          <p className="mt-2 text-sm text-[#66616c]">
            Every dated live teaching session across the teaching groups you can manage.
          </p>
        </div>
        <button
          onClick={() => open(mobileDay)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#994704] px-4 text-sm font-semibold text-white"
        >
          <Plus size={18} />
          Schedule live class
        </button>
      </header>
      <section className="mt-6 rounded-2xl border border-[#e5e1dd] bg-white shadow-sm">
        <div className="hidden flex-wrap items-center justify-between gap-3 border-b border-[#e5e1dd] p-4 md:flex">
          <div className="flex items-center gap-2">
            <button
              aria-label="Previous week"
              onClick={() => setWeek(addDays(week, -7))}
              className="rounded-lg p-2 hover:bg-[#f5f3f2]"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => {
                const today = new Date();
                setWeek(startOfWeek(today));
                setMobileDay(today);
                setMobileMonth(startOfMonth(today));
              }}
              className="rounded-lg border border-[#d8d3d0] px-3 py-2 text-sm font-semibold"
            >
              Today
            </button>
            <button
              aria-label="Next week"
              onClick={() => setWeek(addDays(week, 7))}
              className="rounded-lg p-2 hover:bg-[#f5f3f2]"
            >
              <ChevronRight size={18} />
            </button>
            <p className="ml-1 text-sm font-semibold text-[#180d62]">
              {week.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}{" "}
              –{" "}
              {addDays(week, 6).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#66616c]">
              {weekSessions.length} this week
            </span>
            {nextSession && (
              <span className="rounded-full bg-[#fff0e3] px-3 py-1.5 text-xs font-semibold text-[#7a3903]">
                Next: {clock(new Date(nextSession.scheduled_at))} ·{" "}
                {nextSession.title}
              </span>
            )}
          </div>
        </div>
        {loading ? (
          <div className="flex h-96 items-center justify-center text-sm text-[#66616c]">
            <Loader2 className="mr-2 animate-spin" size={18} />
            Loading schedule…
          </div>
        ) : scheduleQuery.isError ? (
          <div className="flex h-96 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-[#66616c]">
            <p>{scheduleQuery.error instanceof Error ? scheduleQuery.error.message : "Could not load the calendar."}</p>
            <button type="button" onClick={() => void scheduleQuery.refetch()} className="font-semibold text-[#2e2877] underline">Try again</button>
          </div>
        ) : (
          <>
            <div
              ref={calendarGridRef}
              className="hidden overflow-auto md:block md:max-h-[calc(100vh-260px)]"
            >
              <div className="grid min-w-[1020px] grid-cols-[72px_repeat(7,minmax(132px,1fr))]">
                <div className="sticky left-0 top-0 z-30 border-b border-r border-[#eeeae6] bg-white" />
                {days.map((day, index) => (
                  <div
                    key={dateInput(day)}
                    className="sticky top-0 z-20 border-b border-r border-[#eeeae6] bg-white px-2 py-3 text-center last:border-r-0"
                  >
                    <p className="text-xs font-semibold text-[#66616c]">
                      {weekdays[index]}
                    </p>
                    <p
                      className={`mt-1 text-lg font-bold ${sameDay(day, new Date()) ? "text-[#994704]" : "text-[#180d62]"}`}
                    >
                      {day.getDate()}
                    </p>
                  </div>
                ))}
                {Array.from({ length: endHour - startHour }, (_, offset) => {
                  const hour = startHour + offset;
                  return (
                    <div key={hour} className="contents">
                      <div className="sticky left-0 z-10 min-h-[74px] border-b border-r border-[#eeeae6] bg-white px-2 pt-2 text-right text-xs font-semibold text-[#8b8580]">
                        {String(hour).padStart(2, "0")}:00
                      </div>
                      {days.map((day) => {
                        const events = visible.filter(
                          (item) =>
                            sameDay(new Date(item.scheduled_at), day) &&
                            new Date(item.scheduled_at).getHours() === hour,
                        );
                        return (
                          <div
                            key={`${dateInput(day)}-${hour}`}
                            className="relative min-h-[74px] border-b border-r border-[#f0eded] p-1.5 last:border-r-0"
                          >
                            <button
                              onClick={() => open(day, hour)}
                              aria-label={`Add a session at ${String(hour).padStart(2, "0")}:00`}
                              className="absolute inset-0 z-0 opacity-0 transition-opacity hover:bg-[#f7f4ff] hover:opacity-100 focus:opacity-100"
                            >
                              <span className="sr-only">Add a session</span>
                            </button>
                            {events.map((item) => (
                              <button
                                key={item.id}
                                onClick={() => open(day, hour, item)}
                                style={{
                                  height: `${Math.max(56, item.duration_minutes * 1.18)}px`,
                                }}
                                className={`relative z-10 block w-full overflow-hidden rounded-md border-l-4 px-2 py-1.5 text-left text-xs shadow-sm ${item.status === "live" ? "border-[#21834a] bg-[#e7f5eb] text-[#14532d]" : item.access_mode === "anyone_with_link" ? "border-[#c26627] bg-[#fff0e3] text-[#7a3903]" : "border-[#2e2877] bg-[#eeeaff] text-[#180d62]"}`}
                              >
                                <span className="block truncate font-bold">
                                  {item.title}
                                </span>
                                <span className="mt-0.5 block">
                                  {clock(new Date(item.scheduled_at))} ·{" "}
                                  {item.duration_minutes} min
                                </span>
                                <span className="mt-1 block truncate opacity-75">
                                  {item.course?.name || "Private link"}
                                </span>
                              </button>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="p-4 md:hidden">
              <div className="rounded-2xl border border-[#eeeae6] bg-[#fcfbff] p-4">
                <div className="flex items-center justify-between">
                  <button
                    aria-label="Previous month"
                    onClick={() =>
                      selectMobileMonth(addMonths(mobileMonth, -1))
                    }
                    className="rounded-lg p-2 text-[#474551] hover:bg-white"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => {
                      const today = new Date();
                      setMobileMonth(startOfMonth(today));
                      setMobileDay(today);
                      setWeek(startOfWeek(today));
                    }}
                    className="text-sm font-bold text-[#180d62]"
                  >
                    {mobileMonth.toLocaleDateString(undefined, {
                      month: "long",
                      year: "numeric",
                    })}
                  </button>
                  <button
                    aria-label="Next month"
                    onClick={() => selectMobileMonth(addMonths(mobileMonth, 1))}
                    className="rounded-lg p-2 text-[#474551] hover:bg-white"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-7 text-center text-[11px] font-semibold text-[#77747e]">
                  {weekdays.map((name) => (
                    <span key={name}>{name.slice(0, 1)}</span>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-7 gap-y-1">
                  {mobileMonthDays.map((day, index) =>
                    day ? (
                      <button
                        key={dateInput(day)}
                        onClick={() => {
                          setMobileDay(day);
                          setWeek(startOfWeek(day));
                        }}
                        className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${sameDay(day, mobileDay) ? "bg-[#180d62] text-white shadow-sm" : sameDay(day, new Date()) ? "bg-[#fff0e3] text-[#994704]" : "text-[#383443] hover:bg-white"}`}
                      >
                        {day.getDate()}
                      </button>
                    ) : (
                      <span key={`blank-${index}`} />
                    ),
                  )}
                </div>
              </div>
              <div className="mt-6">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[.14em] text-[#994704]">
                      Selected day
                    </p>
                    <h2 className="mt-1 text-xl font-bold text-[#180d62]">
                      {mobileDay.toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                    </h2>
                  </div>
                  <span className="text-xs font-semibold text-[#77747e]">
                    {
                      visible.filter((item) =>
                        sameDay(new Date(item.scheduled_at), mobileDay),
                      ).length
                    }{" "}
                    sessions
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {visible
                    .filter((item) =>
                      sameDay(new Date(item.scheduled_at), mobileDay),
                    )
                    .map((item) => (
                      <article
                        key={item.id}
                        className="rounded-xl border border-[#e8e3ee] bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.status === "live" ? "bg-[#e7f5eb] text-[#21834a]" : "bg-[#eeeaff] text-[#2e2877]"}`}
                          >
                            <Video size={17} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="truncate text-sm font-bold text-[#180d62]">
                                {item.title}
                              </h3>
                              <span
                                className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${item.status === "live" ? "bg-[#e7f5eb] text-[#167440]" : "bg-[#fff0e3] text-[#994704]"}`}
                              >
                                {item.status === "live" ? "LIVE" : "SCHEDULED"}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-[#66616c]">
                              {item.course?.name || "Private link"} ·{" "}
                              {clock(new Date(item.scheduled_at))} ·{" "}
                              {item.duration_minutes} min
                            </p>
                            <button
                              onClick={() =>
                                item.status === "live"
                                  ? void start(item)
                                  : open(
                                      mobileDay,
                                      new Date(item.scheduled_at).getHours(),
                                      item,
                                    )
                              }
                              className="mt-3 text-xs font-bold text-[#2e2877]"
                            >
                              {item.status === "live"
                                ? "Join as host"
                                : "View session details"}
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  {!visible.some((item) =>
                    sameDay(new Date(item.scheduled_at), mobileDay),
                  ) && (
                    <button
                      onClick={() => open(mobileDay)}
                      className="w-full rounded-xl border border-dashed border-[#c8c0d3] px-4 py-7 text-center text-sm font-semibold text-[#2e2877]"
                    >
                      Schedule a live class on this day
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </section>
      {composer && (
        <div className="fixed inset-0 z-50 bg-black/40">
          <form
            onSubmit={save}
            className="absolute bottom-0 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:inset-x-0 sm:bottom-auto sm:top-1/2 sm:mx-auto sm:max-w-lg sm:-translate-y-1/2 sm:rounded-2xl sm:p-7"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.14em] text-[#994704]">
                  {composer.existing ? "Live session details" : "Add to schedule"}
                </p>
                <h2 className="mt-1 text-2xl font-bold text-[#180d62]">
                  {composer.existing ? "Edit live session" : "New live class"}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setComposer(null)}
                className="rounded-full p-2 text-[#66616c]"
              >
                <X size={20} />
              </button>
            </div>
            <div className="mt-6 space-y-4">
              <label className="block text-sm font-semibold">
                Live class title
                <input
                  required
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  disabled={existingSessionLocked}
                  className="mt-1.5 min-h-12 w-full rounded-lg border border-[#8b8580] px-3 font-normal"
                />
              </label>
              {composer.existing && existingSessionLocked && (
                <p
                  role="status"
                  className="rounded-lg border border-[#c8c0d3] bg-[#f8f7ff] p-3 text-sm leading-6 text-[#514b5b]"
                >
                  {composer.existing.status === "live"
                    ? "This live class has already started. It cannot be edited or cancelled here. Join as host to end it."
                    : composer.existing.status === "completed"
                      ? "This live class has already ended. Its details are read-only."
                      : "This live class has already been cancelled. Its details are read-only."}
                </p>
              )}
              {!composer.existing && (
                <fieldset>
                  <legend className="text-sm font-semibold">
                    Who can join?
                  </legend>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAccess("anyone_with_link");
                        setRepeat(false);
                      }}
                      className={`rounded-lg border p-3 text-left text-sm ${access === "anyone_with_link" ? "border-[#2e2877] bg-[#eeeaff] text-[#180d62]" : "border-[#d8d3d0]"}`}
                    >
                      Private link
                      <span className="mt-1 block text-xs font-normal">
                        No learner login
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccess("enrolled_learners")}
                      className={`rounded-lg border p-3 text-left text-sm ${access === "enrolled_learners" ? "border-[#2e2877] bg-[#eeeaff] text-[#180d62]" : "border-[#d8d3d0]"}`}
                    >
                      Enrolled learners
                      <span className="mt-1 block text-xs font-normal">
                        Subject group
                      </span>
                    </button>
                  </div>
                </fieldset>
              )}
              {access === "enrolled_learners" && !composer.existing && (
                <>
                  <label className="block text-sm font-semibold">
                    Teaching group
                    <select
                      required
                      value={classId}
                      onChange={(event) => {
                        const nextClassId = event.target.value;
                        const nextClass = teachingClasses.find(
                          (item) => item.id === nextClassId,
                        );
                        setClassId(nextClassId);
                        setCourseId(
                          nextClass?.courses.length === 1
                            ? nextClass.courses[0].id
                            : "",
                        );
                      }}
                      className="mt-1.5 min-h-12 w-full rounded-lg border border-[#8b8580] bg-white px-3 font-normal"
                    >
                      <option value="">Choose a teaching group</option>
                      {teachingClasses.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!teachingClasses.length && (
                    <p className="rounded-lg border border-dashed border-[#c8c0d3] bg-[#f8f7ff] px-3 py-3 text-sm leading-6 text-[#514b5b]">
                      You have not created a teaching group yet.{" "}
                      <Link
                        href="/dashboard/classes"
                        className="font-semibold text-[#2e2877] underline"
                      >
                        Go to Classes to create one.
                      </Link>
                    </p>
                  )}
                  {selectedClass && selectedClassSubjects.length === 1 && (
                    <p className="rounded-lg bg-[#f8f7ff] px-3 py-3 text-sm text-[#514b5b]">
                      <strong>{selectedClassSubjects[0].name}</strong> is the
                      subject for this teaching group.
                    </p>
                  )}
                  {selectedClass && selectedClassSubjects.length > 1 && (
                    <label className="block text-sm font-semibold">
                      Subject
                      <select
                        required
                        value={courseId}
                        onChange={(event) => setCourseId(event.target.value)}
                        className="mt-1.5 min-h-12 w-full rounded-lg border border-[#8b8580] bg-white px-3 font-normal"
                      >
                        <option value="">Choose a subject</option>
                        {selectedClassSubjects.map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </>
              )}
              {capabilities.isAdmin && !composer.existing && (
                <label className="block text-sm font-semibold">
                  Tutor
                  <select
                    value={tutorId}
                    onChange={(event) => setTutorId(event.target.value)}
                    className="mt-1.5 min-h-12 w-full rounded-lg border border-[#8b8580] bg-white px-3 font-normal"
                  >
                    {availableTutors.map((tutor) => (
                      <option key={tutor.id} value={tutor.id}>
                        {fullName(tutor)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-semibold">
                  Date
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    disabled={existingSessionLocked}
                    className="mt-1.5 min-h-12 w-full rounded-lg border border-[#8b8580] px-3 font-normal"
                  />
                </label>
                <label className="text-sm font-semibold">
                  Time
                  <input
                    type="time"
                    required
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                    disabled={existingSessionLocked}
                    className="mt-1.5 min-h-12 w-full rounded-lg border border-[#8b8580] px-3 font-normal"
                  />
                </label>
              </div>
              <label className="block text-sm font-semibold">
                Duration
                <select
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                  disabled={existingSessionLocked}
                  className="mt-1.5 min-h-12 w-full rounded-lg border border-[#8b8580] bg-white px-3 font-normal"
                >
                  <option value="45">45 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="90">1½ hours</option>
                  <option value="120">2 hours</option>
                </select>
              </label>
              {!composer.existing && access === "enrolled_learners" && (
                <fieldset>
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={repeat}
                      onChange={(event) => {
                        setRepeat(event.target.checked);
                        if (event.target.checked && !repeatDays.length)
                          setRepeatDays([
                            new Date(`${date}T12:00:00`).getDay() || 7,
                          ]);
                      }}
                    />
                    Repeat weekly
                  </label>
                  {repeat && (
                    <div className="mt-3 flex gap-1">
                      {weekdays.map((name, index) => (
                        <button
                          type="button"
                          key={name}
                          onClick={() => toggleDay(index + 1)}
                          className={`min-h-10 flex-1 rounded-lg text-xs font-bold ${repeatDays.includes(index + 1) ? "bg-[#180d62] text-white" : "bg-[#f0eded] text-[#474551]"}`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                </fieldset>
              )}
              {access === "anyone_with_link" && !composer.existing && (
                <p className="rounded-lg bg-[#fff0e3] p-3 text-xs text-[#7a3903]">
                  Private-link sessions are one-off so each live class has its own
                  secure learner link.
                </p>
              )}
              {conflict && (
                <p
                  role="alert"
                  className="rounded-lg bg-[#fff0ed] p-3 text-sm font-semibold text-[#8d2f22]"
                >
                  This tutor already has a live class at that time.
                </p>
              )}
              {!existingSessionLocked && (
                <button
                  disabled={
                    saving ||
                    conflict ||
                    (repeat && !repeatDays.length) ||
                    (access === "enrolled_learners" && !courseId)
                  }
                  className="min-h-12 w-full rounded-xl bg-[#994704] text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving
                    ? "Saving…"
                    : composer.existing
                      ? "Save changes"
                      : "Schedule live class"}
                </button>
              )}
              {composer.existing && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void copyClassroomLink(`${window.location.origin}/class/${composer.existing!.id}`)}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#2e2877] text-sm font-semibold text-[#2e2877]"
                  >
                    <Copy size={16} />
                    Copy link
                  </button>
                  {['scheduled', 'live'].includes(composer.existing.status) && (
                    <a
                      target="_blank"
                      rel="noopener noreferrer"
                      href={`/class/${composer.existing!.id}?start=true`}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#2e2877] text-sm font-semibold text-white hover:bg-[#1a1555]"
                    >
                      <Video size={16} />
                      {composer.existing.status === 'live' ? 'Join as host' : 'Open live class'}
                    </a>
                  )}
                  {composer.existing.status === "scheduled" && (
                    <button
                      type="button"
                      onClick={() => void cancel(composer.existing!)}
                      className="min-h-11 rounded-xl border border-[#c44b3b] text-sm font-semibold text-[#a43a2a]"
                    >
                      Cancel live class
                    </button>
                  )}
                  {composer.existing.series && (
                    <button
                      type="button"
                      onClick={() => void endSeries(composer.existing!)}
                      className="col-span-2 min-h-11 rounded-xl border border-[#8b8580] text-sm font-semibold text-[#474551]"
                    >
                      End recurring series
                    </button>
                  )}
                </div>
              )}
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
