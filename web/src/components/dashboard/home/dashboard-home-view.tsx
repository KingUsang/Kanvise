'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Panel } from '@/components/ui/card'
import { CourseSwatch, courseColorFor } from '@/components/ui/course-swatch'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton'
import { StatusChip } from '@/components/ui/status-chip'
import {
  dayOfMonth,
  formatDateLine,
  formatNextLesson,
  formatTime,
  greetingFor,
  lessonEnd,
  localHour,
  pluralLessons,
  pluralStudents,
  weekdayName,
  weekRangeLabel,
  type DashboardOverview,
  type OverviewLesson,
} from '@/lib/dashboard-overview'

// Links to screens from later steps (Schedule lesson, Needs attention,
// Suggestions, Join, Live now, Sample course banner, lesson pages) are not
// rendered at all until those steps ship (HANDOFF, hidden-links table).

function LessonSecondLine({ lesson, showTutor }: { lesson: OverviewLesson; showTutor: boolean }) {
  const parts = [
    lesson.student_count === null ? null : pluralStudents(lesson.student_count),
    lesson.course_name,
  ].filter(Boolean)
  return (
    <p className="truncate text-dashboard-small text-dashboard-muted">
      {parts.join(' · ')}
      {showTutor && lesson.tutor_name ? ` · with ${lesson.tutor_name}` : ''}
    </p>
  )
}

function TodayRow({ lesson, timezone, showTutor }: { lesson: OverviewLesson; timezone: string; showTutor: boolean }) {
  return (
    // Phones: time beside the title, status chip on its own line under it, so the
    // title is never cut to a few letters. Wider screens: one row.
    <li className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0 sm:flex sm:items-center sm:gap-4">
      <div className="w-[4.5rem] shrink-0 text-dashboard-small">
        <p className="font-semibold text-dashboard-foreground">{formatTime(lesson.scheduled_at, timezone)}</p>
        <p className="text-dashboard-secondary text-dashboard-muted">
          <span className="sr-only">to </span>
          {formatTime(lessonEnd(lesson), timezone)}
        </p>
      </div>
      {/* The wrappers own display: CourseSwatch sets inline-block, which beat a plain `hidden`. */}
      <span className="hidden sm:inline-flex"><CourseSwatch color={courseColorFor(lesson.course_id ?? lesson.id)} size="lg" /></span>
      <div className="min-w-0 flex-1">
        <p className={`flex items-center gap-2 truncate font-semibold text-dashboard-foreground ${lesson.status === 'cancelled' ? 'line-through' : ''}`}>
          <span className="inline-flex sm:hidden"><CourseSwatch color={courseColorFor(lesson.course_id ?? lesson.id)} size="sm" /></span>
          <span className="truncate">{lesson.title}</span>
        </p>
        <LessonSecondLine lesson={lesson} showTutor={showTutor} />
      </div>
      <div className="col-start-2 justify-self-start sm:shrink-0">
        <StatusChip status={lesson.status} />
      </div>
    </li>
  )
}

function TodayPanel({ overview, timezone, showTutor, toggle }: {
  overview: DashboardOverview
  timezone: string
  showTutor: boolean
  toggle: React.ReactNode
}) {
  const { today, next_lesson: next, has_any_lesson: hasAny } = overview
  return (
    <Panel
      aria-labelledby="dashboard-today"
      title={<span id="dashboard-today">Today{today.length ? <span className="ml-2 text-dashboard-small font-normal text-dashboard-muted">{pluralLessons(today.length)}</span> : null}</span>}
      actions={
        <>
          {toggle}
          <Link href="/dashboard/schedule" className="text-dashboard-small font-semibold text-dashboard-primary hover:underline">
            Open calendar ›
          </Link>
        </>
      }
    >
      {today.length ? (
        <ul>
          {today.map((lesson) => <TodayRow key={lesson.id} lesson={lesson} timezone={timezone} showTutor={showTutor} />)}
        </ul>
      ) : hasAny ? (
        <div>
          <p className="font-semibold text-dashboard-foreground">No lessons today.</p>
          {next ? (
            <p className="mt-1 text-dashboard-small text-dashboard-muted">
              Your next lesson is {formatNextLesson(next.scheduled_at, timezone)}{next.course_name ? ` · ${next.course_name}` : ''}.
            </p>
          ) : null}
        </div>
      ) : (
        <div>
          <p className="font-semibold text-dashboard-foreground">Nothing scheduled yet.</p>
          <p className="mt-1 text-dashboard-small text-dashboard-muted">Lessons you schedule will show here.</p>
        </div>
      )}
    </Panel>
  )
}

function WeekPanel({ overview, timezone, showTutor, onWeekChange }: {
  overview: DashboardOverview
  timezone: string
  showTutor: boolean
  onWeekChange: (offset: number) => void
}) {
  const { week } = overview
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const visibleLessons = week.lessons.filter((lesson) => selectedDay === null || lesson.day_index === selectedDay)
  const move = (delta: number) => {
    setSelectedDay(null)
    onWeekChange(week.offset + delta)
  }
  const days = week.days
  return (
    <Panel
      aria-labelledby="dashboard-week"
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span id="dashboard-week">This week</span>
          <span className="flex items-center gap-1">
            <button type="button" aria-label="Previous week" onClick={() => move(-1)} className="inline-flex size-11 items-center justify-center rounded-dashboard-control text-dashboard-muted hover:bg-dashboard-surface-subtle focus-visible:outline-2 focus-visible:outline-dashboard-focus">
              <ChevronLeft aria-hidden="true" className="size-5" />
            </button>
            <button type="button" aria-label="Next week" onClick={() => move(1)} className="inline-flex size-11 items-center justify-center rounded-dashboard-control text-dashboard-muted hover:bg-dashboard-surface-subtle focus-visible:outline-2 focus-visible:outline-dashboard-focus">
              <ChevronRight aria-hidden="true" className="size-5" />
            </button>
          </span>
          <span className="text-dashboard-small font-normal text-dashboard-muted">{weekRangeLabel(days[0].date, days[6].date)}</span>
        </span>
      }
    >
      <div role="group" aria-label="Days of the week" className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {days.map((day, index) => {
          const isToday = index === week.today_index
          const selected = selectedDay === index
          const name = `${weekdayName(day.date)}, ${pluralLessons(day.lesson_count)}`
          return (
            <button
              key={day.date}
              type="button"
              aria-pressed={selected}
              aria-label={name}
              aria-current={isToday ? 'date' : undefined}
              onClick={() => setSelectedDay(selected ? null : index)}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-dashboard-control border px-1 py-2 focus-visible:outline-2 focus-visible:outline-dashboard-focus ${isToday ? 'border-2 border-dashboard-location' : 'border-dashboard-outline'} ${selected ? 'bg-dashboard-surface-hover' : 'bg-dashboard-surface hover:bg-dashboard-surface-subtle'}`}
            >
              <span aria-hidden="true" className="text-dashboard-secondary text-dashboard-muted">{weekdayName(day.date, 'short')}</span>
              <span aria-hidden="true" className="text-dashboard-small font-semibold text-dashboard-foreground">{dayOfMonth(day.date)}</span>
              <span aria-hidden="true" className={`size-1.5 rounded-full ${day.lesson_count ? 'bg-dashboard-outline-strong' : ''}`} />
            </button>
          )
        })}
      </div>
      {visibleLessons.length ? (
        <div className="mt-4 space-y-4">
          {days.map((day, index) => {
            const lessons = visibleLessons.filter((lesson) => lesson.day_index === index)
            if (!lessons.length) return null
            return (
              <section key={day.date} aria-label={weekdayName(day.date)}>
                <h3 className="mb-1 text-dashboard-secondary font-semibold text-dashboard-muted">{weekdayName(day.date)} {dayOfMonth(day.date)}</h3>
                <ul className="divide-y divide-dashboard-outline">
                  {lessons.map((lesson) => (
                    <li key={lesson.id} className="flex items-center gap-3 py-2.5">
                      <span className="w-[4.5rem] shrink-0 text-dashboard-small font-semibold text-dashboard-foreground">{formatTime(lesson.scheduled_at, timezone)}</span>
                      <CourseSwatch color={courseColorFor(lesson.course_id ?? lesson.id)} />
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-dashboard-small text-dashboard-foreground ${lesson.status === 'cancelled' ? 'line-through' : ''}`}>{lesson.title}</span>
                        {showTutor && lesson.tutor_name ? <span className="block truncate text-dashboard-secondary text-dashboard-muted">with {lesson.tutor_name}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      ) : (
        <p className="mt-4 font-semibold text-dashboard-foreground">
          {selectedDay === null ? 'Nothing scheduled this week.' : 'Nothing scheduled this day.'}
        </p>
      )}
    </Panel>
  )
}

export function DashboardHomeView({ overview, firstName, now, mineOnly, onMineOnlyChange, onWeekChange }: {
  overview: DashboardOverview
  firstName: string
  now: Date
  mineOnly: boolean
  onMineOnlyChange: (value: boolean) => void
  onWeekChange: (offset: number) => void
}) {
  const timezone = overview.timezone
  const showTutor = overview.scope === 'all'
  const canToggleMine = overview.view === 'agency_admin' && overview.teaches
  const greeting = greetingFor(localHour(now, timezone))
  const toggle = canToggleMine ? (
    <button
      type="button"
      aria-pressed={mineOnly}
      onClick={() => onMineOnlyChange(!mineOnly)}
      className={`inline-flex min-h-11 items-center rounded-dashboard-control border px-3 text-dashboard-small font-semibold focus-visible:outline-2 focus-visible:outline-dashboard-focus ${mineOnly ? 'border-dashboard-primary bg-dashboard-surface-hover text-dashboard-primary' : 'border-dashboard-outline text-dashboard-foreground hover:bg-dashboard-surface-subtle'}`}
    >
      Mine only
    </button>
  ) : null
  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting}${firstName ? `, ${firstName}` : ''}`}
        description={formatDateLine(now, timezone)}
      />
      <TodayPanel overview={overview} timezone={timezone} showTutor={showTutor} toggle={toggle} />
      <WeekPanel key={overview.week.offset} overview={overview} timezone={timezone} showTutor={showTutor} onWeekChange={onWeekChange} />
    </div>
  )
}

/** Shown from the first paint, before any data arrives (16 R-08). */
export function DashboardHomeSkeleton() {
  return (
    <SkeletonGroup label="Loading your dashboard" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-5 w-48 max-w-full" />
      </div>
      <Skeleton className="h-52 w-full rounded-dashboard-panel" />
      <Skeleton className="h-72 w-full rounded-dashboard-panel" />
    </SkeletonGroup>
  )
}
