import { describe, expect, it } from "vitest";
import { filterStudentClasses } from "./student-classes-client";
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
