"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { dashboardQueryKeys } from "@/lib/dashboard-session";
import { authenticatedApiFetch } from "@/lib/authenticated-fetch";

type Tutor = { id: string; first_name: string; last_name: string };
type Course = { id: string; name: string };
type TimetableSlot = {
  id: string;
  title: string;
  weekday: number;
  start_time: string;
  duration_minutes: number;
  course_id: string;
  tutor_id: string;
  starts_on?: string | null;
  ends_on?: string | null;
  course?: Course | null;
  tutor?: Tutor | null;
};
type TimetableOccurrence = TimetableSlot & {
  scheduled_at: string;
  status: "scheduled";
};

type Props = Record<string, never>;

const weekdayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const startHour = 7;
// The grid is vertically scrollable so a full teaching day is available
// without forcing every centre to stare at an oversized page.
const endHour = 24;

function startOfWeek(value: Date) {
  const next = new Date(value);
  const day = next.getDay() || 7;
  next.setDate(next.getDate() - day + 1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function keyForDay(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function sameDay(a: Date, b: Date) {
  return keyForDay(a) === keyForDay(b);
}

function fullName(tutor?: Tutor | null) {
  return (
    `${tutor?.first_name || ""} ${tutor?.last_name || ""}`.trim() ||
    "Unassigned tutor"
  );
}

function timeLabel(value: Date) {
  return value.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function durationLabel(minutes: number) {
  if (minutes % 60 === 0) return `${minutes / 60} hr`;
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
}

function hueFor(value: string) {
  let total = 0;
  for (let index = 0; index < value.length; index += 1)
    total = (total + value.charCodeAt(index)) % 360;
  return total;
}

export function CentreTimetableClient(_: Props) {
  const api = process.env.NEXT_PUBLIC_API_URL;
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [courseFilter, setCourseFilter] = useState("all");
  const [tutorFilter, setTutorFilter] = useState("all");
  const timetableGridRef = useRef<HTMLDivElement>(null);
  const lastScrollKey = useRef("");

  const timetableQuery = useQuery({
    queryKey: dashboardQueryKeys.timetable,
    staleTime: 30_000,
    queryFn: async (): Promise<TimetableSlot[]> => {
      const response = await authenticatedApiFetch(`${api}/classes/timetable`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.error || "Could not load timetable");
      return body.data || [];
    },
  });
  const slots = timetableQuery.data || [];
  const loading = timetableQuery.isPending;

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(week, index)),
    [week],
  );
  const courses = useMemo(
    () =>
      Array.from(
        new Map(
          slots
            .filter((item) => item.course)
            .map((item) => [item.course!.id, item.course!]),
        ).values(),
      ),
    [slots],
  );
  const tutors = useMemo(
    () =>
      Array.from(
        new Map(
          slots
            .filter((item) => item.tutor)
            .map((item) => [item.tutor!.id, item.tutor!]),
        ).values(),
      ),
    [slots],
  );
  const filtered = useMemo(
    () =>
      slots.filter(
        (item) =>
          (courseFilter === "all" || item.course_id === courseFilter) &&
          (tutorFilter === "all" || item.tutor_id === tutorFilter),
      ),
    [slots, courseFilter, tutorFilter],
  );
  const weekEvents = useMemo<TimetableOccurrence[]>(
    () =>
      filtered.flatMap((slot) => {
        const eventDay = addDays(week, Math.max(0, slot.weekday - 1));
        const start = new Date(`${keyForDay(eventDay)}T${slot.start_time}`);
        const startsOn = slot.starts_on
          ? new Date(`${slot.starts_on}T00:00:00`)
          : null;
        const endsOn = slot.ends_on
          ? new Date(`${slot.ends_on}T23:59:59`)
          : null;
        if ((startsOn && start < startsOn) || (endsOn && start > endsOn))
          return [];
        return [
          { ...slot, scheduled_at: start.toISOString(), status: "scheduled" },
        ];
      }),
    [filtered, week],
  );
  const selectedEvents = useMemo(
    () =>
      weekEvents
        .filter((item) => sameDay(new Date(item.scheduled_at), selectedDay))
        .sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at)),
    [weekEvents, selectedDay],
  );
  const nextTeachingSlot = useMemo(
    () =>
      weekEvents
        .filter((item) => new Date(item.scheduled_at) >= new Date())
        .sort(
          (a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at),
        )[0],
    [weekEvents],
  );

  useEffect(() => {
    if (loading || !weekEvents.length) return;
    const firstSlot = [...weekEvents].sort(
      (a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at),
    )[0];
    const scrollKey = `${keyForDay(week)}:${courseFilter}:${tutorFilter}:${firstSlot.id}`;
    if (lastScrollKey.current === scrollKey) return;
    lastScrollKey.current = scrollKey;
    const top = Math.max(
      0,
      (new Date(firstSlot.scheduled_at).getHours() - startHour - 1) * 76,
    );
    requestAnimationFrame(() =>
      timetableGridRef.current?.scrollTo({ top, behavior: "auto" }),
    );
  }, [courseFilter, loading, tutorFilter, week, weekEvents]);

  function moveWeek(offset: number) {
    const next = addDays(week, offset * 7);
    setWeek(next);
    setSelectedDay(next);
  }

  function resetToToday() {
    const today = new Date();
    setWeek(startOfWeek(today));
    setSelectedDay(today);
  }

  return (
    <main className="mx-auto max-w-[1680px] px-4 py-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-[#e5e1dd] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#994704]">
            Centre operations
          </p>
          <h1 className="mt-1 text-3xl font-bold text-[#180d62]">Timetable</h1>
          <p className="mt-2 text-sm text-[#66616c]">
            Your recurring teaching rhythm, across every class.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs font-semibold text-[#474551]">
            Subject
            <select
              value={courseFilter}
              onChange={(event) => setCourseFilter(event.target.value)}
              className="mt-1 block min-h-10 w-full rounded-lg border border-[#d8d3d0] bg-white px-3 text-sm font-normal text-[#180d62]"
            >
              <option value="all">All subjects</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-[#474551]">
            Tutor
            <select
              value={tutorFilter}
              onChange={(event) => setTutorFilter(event.target.value)}
              className="mt-1 block min-h-10 w-full rounded-lg border border-[#d8d3d0] bg-white px-3 text-sm font-normal text-[#180d62]"
            >
              <option value="all">All tutors</option>
              {tutors.map((tutor) => (
                <option key={tutor.id} value={tutor.id}>
                  {fullName(tutor)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <section className="mt-6 overflow-hidden rounded-2xl border border-[#e5e1dd] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e1dd] p-4">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              aria-label="Previous week"
              onClick={() => moveWeek(-1)}
              className="rounded-lg p-2 text-[#180d62] hover:bg-[#f5f3f2]"
            >
              <ChevronLeft size={19} />
            </button>
            <button
              onClick={resetToToday}
              className="rounded-lg border border-[#d8d3d0] px-3 py-2 text-sm font-semibold text-[#180d62]"
            >
              Today
            </button>
            <button
              aria-label="Next week"
              onClick={() => moveWeek(1)}
              className="rounded-lg p-2 text-[#180d62] hover:bg-[#f5f3f2]"
            >
              <ChevronRight size={19} />
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
          <div className="flex flex-wrap items-center justify-end gap-3">
            <p className="text-sm text-[#66616c]">
              {weekEvents.length} session{weekEvents.length === 1 ? "" : "s"}{" "}
              this week
            </p>
            {nextTeachingSlot && (
              <p className="rounded-full bg-[#fff0e3] px-3 py-1.5 text-xs font-semibold text-[#7a3903]">
                Next:{" "}
                {
                  weekdayNames[
                    new Date(nextTeachingSlot.scheduled_at).getDay() === 0
                      ? 6
                      : new Date(nextTeachingSlot.scheduled_at).getDay() - 1
                  ]
                }{" "}
                {timeLabel(new Date(nextTeachingSlot.scheduled_at))} ·{" "}
                {nextTeachingSlot.course?.name || nextTeachingSlot.title}
              </p>
            )}
            <Link
              href="/dashboard/schedule"
              className="rounded-lg border border-[#2e2877] px-3 py-2 text-sm font-semibold text-[#2e2877]"
            >
              View calendar
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex h-96 items-center justify-center text-sm text-[#66616c]">
            <Loader2 className="mr-2 animate-spin" size={18} />
            Loading timetable…
          </div>
        ) : timetableQuery.isError ? (
          <div className="flex h-96 flex-col items-center justify-center gap-3 text-sm text-[#66616c]">
            <p>
              {timetableQuery.error instanceof Error
                ? timetableQuery.error.message
                : "Could not load timetable."}
            </p>
            <button
              type="button"
              onClick={() => void timetableQuery.refetch()}
              className="font-semibold text-[#2e2877] underline"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            <div
              ref={timetableGridRef}
              className="hidden max-h-[calc(100vh-300px)] overflow-auto lg:block"
            >
              <div className="grid min-w-[1080px] grid-cols-[72px_repeat(7,minmax(0,1fr))]">
                <div className="border-b border-r border-[#eeeae6]" />
                {days.map((day, index) => (
                  <div
                    key={keyForDay(day)}
                    className="border-b border-r border-[#eeeae6] px-3 py-3 text-center last:border-r-0"
                  >
                    <p className="text-xs font-semibold text-[#66616c]">
                      {weekdayNames[index]}
                    </p>
                    <p
                      className={`mt-1 text-lg font-bold ${sameDay(day, new Date()) ? "text-[#994704]" : "text-[#180d62]"}`}
                    >
                      {day.getDate()}
                    </p>
                  </div>
                ))}
                {Array.from({ length: endHour - startHour }, (_, index) => {
                  const hour = startHour + index;
                  return (
                    <div key={hour} className="contents">
                      <div className="min-h-[76px] border-b border-r border-[#eeeae6] px-2 pt-2 text-right text-xs font-semibold text-[#8b8580]">
                        {String(hour).padStart(2, "0")}:00
                      </div>
                      {days.map((day) => {
                        const events = weekEvents.filter((item) => {
                          const scheduled = new Date(item.scheduled_at);
                          return (
                            sameDay(scheduled, day) &&
                            scheduled.getHours() === hour
                          );
                        });
                        return (
                          <div
                            key={`${keyForDay(day)}-${hour}`}
                            className="min-h-[76px] border-b border-r border-[#eeeae6] p-1.5 last:border-r-0"
                          >
                            {events.map((item) => {
                              const hue = hueFor(
                                item.course?.name || item.title,
                              );
                              const scheduled = new Date(item.scheduled_at);
                              return (
                                <article
                                  key={item.id}
                                  title={`${item.title} · ${fullName(item.tutor)}`}
                                  className="mb-1 rounded-md border-l-4 px-2 py-1.5 text-left"
                                  style={{
                                    borderLeftColor: `hsl(${hue} 55% 43%)`,
                                    backgroundColor: `hsl(${hue} 80% 96%)`,
                                  }}
                                >
                                  <p className="truncate text-xs font-bold text-[#180d62]">
                                    {item.course?.name || item.title}
                                  </p>
                                  <p className="mt-0.5 truncate text-[11px] text-[#474551]">
                                    {timeLabel(scheduled)} ·{" "}
                                    {fullName(item.tutor)}
                                  </p>
                                </article>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="lg:hidden">
              <div className="flex gap-2 overflow-x-auto border-b border-[#eeeae6] p-3">
                {days.map((day, index) => (
                  <button
                    key={keyForDay(day)}
                    onClick={() => setSelectedDay(day)}
                    className={`min-w-14 rounded-xl px-2 py-2 text-center text-xs font-semibold ${sameDay(day, selectedDay) ? "bg-[#180d62] text-white" : "bg-[#f5f3f2] text-[#474551]"}`}
                  >
                    <span className="block">{weekdayNames[index]}</span>
                    <span className="mt-1 block text-base">
                      {day.getDate()}
                    </span>
                  </button>
                ))}
              </div>
              <div className="divide-y divide-[#eeeae6]">
                {selectedEvents.map((item) => {
                  const hue = hueFor(item.course?.name || item.title);
                  return (
                    <article key={item.id} className="flex gap-3 p-4">
                      <div className="w-16 shrink-0 text-xs font-bold text-[#994704]">
                        <p>{timeLabel(new Date(item.scheduled_at))}</p>
                        <p className="mt-1 font-normal text-[#8b8580]">
                          {durationLabel(item.duration_minutes)}
                        </p>
                      </div>
                      <div
                        className="min-w-0 border-l-4 pl-3"
                        style={{ borderColor: `hsl(${hue} 55% 43%)` }}
                      >
                        <p className="truncate font-semibold text-[#180d62]">
                          {item.course?.name || item.title}
                        </p>
                        <p className="mt-1 text-sm text-[#474551]">
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs text-[#66616c]">
                          {fullName(item.tutor)}
                        </p>
                      </div>
                    </article>
                  );
                })}
                {!selectedEvents.length && (
                  <p className="p-10 text-center text-sm text-[#66616c]">
                    No sessions match these filters on this day.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </section>
      <p className="mt-4 text-xs leading-5 text-[#66616c]">
        This view reflects recurring teaching slots across the centre. Scroll to
        see evening sessions; manage a dated session from Calendar.
      </p>
    </main>
  );
}
