import { describe, expect, it } from "vitest";
import { filterStudentClasses, groupTutorLabel } from "./student-classes-client";
import type { StudentClass } from "@/lib/student-classes";

const now = new Date("2026-07-22T12:00:00Z").getTime();
const classes: StudentClass[] = [
  { id: "live", title: "Live", scheduled_at: "2026-07-22T11:00:00Z", duration_minutes: 60, status: "live", started_at: null, ended_at: null, course_id: "maths", course: null, tutor: null },
  { id: "future", title: "Future", scheduled_at: "2026-07-23T11:00:00Z", duration_minutes: 60, status: "scheduled", started_at: null, ended_at: null, course_id: "physics", course: null, tutor: null },
  { id: "stale", title: "Stale", scheduled_at: "2026-07-21T11:00:00Z", duration_minutes: 60, status: "scheduled", started_at: null, ended_at: null, course_id: "maths", course: null, tutor: null },
  { id: "done", title: "Done", scheduled_at: "2026-07-20T11:00:00Z", duration_minutes: 60, status: "completed", started_at: null, ended_at: null, course_id: "physics", course: null, tutor: null },
];

describe("filterStudentClasses", () => {
  it("keeps live and future sessions in the upcoming view", () => {
    expect(filterStudentClasses(classes, "upcoming", "all", now).map((item) => item.id)).toEqual(["live", "future"]);
  });

  it("treats a scheduled session whose time passed as history", () => {
    expect(filterStudentClasses(classes, "past", "all", now).map((item) => item.id)).toEqual(["stale", "done"]);
  });

  it("filters sessions by course", () => {
    expect(filterStudentClasses(classes, "all", "maths", now).map((item) => item.id)).toEqual(["live", "stale"]);
  });
});

describe("ended sessions and tutors", () => {
  it("treats an end timestamp as past even when the status is stale", () => {
    const ended: StudentClass[] = [
      { ...classes[0], id: "ended-live", ended_at: "2026-07-22T11:55:00Z" },
      { ...classes[1], id: "ended-scheduled", ended_at: "2026-07-23T12:00:00Z" },
    ];
    expect(filterStudentClasses(ended, "upcoming", "all", now)).toEqual([]);
    expect(filterStudentClasses(ended, "past", "all", now).map((item) => item.id)).toEqual(["ended-live", "ended-scheduled"]);
  });

  it("lists every distinct tutor in a subject group", () => {
    const sessions: StudentClass[] = [
      { ...classes[0], tutor: { id: "t1", first_name: "Ada", last_name: "Obi" } },
      { ...classes[1], tutor: { id: "t2", first_name: "Tunde", last_name: "Bello" } },
      { ...classes[2], tutor: { id: "t1", first_name: "Ada", last_name: "Obi" } },
    ];
    expect(groupTutorLabel(sessions)).toBe("Ada Obi, Tunde Bello");
  });
});
