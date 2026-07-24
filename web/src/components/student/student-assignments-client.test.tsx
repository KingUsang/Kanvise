import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { assignmentStatus, StudentAssignmentsClient } from "./student-assignments-client";
import type { StudentAssignment } from "@/lib/student-assignments";

const base: StudentAssignment = { id: "a1", title: "Essay", description: "Write", deadline_at: "2026-07-23T12:00:00Z", created_at: "2026-07-20T12:00:00Z", attachment_file_name: null, attachment_download_url: null, course: null, submission: null };
const now = new Date("2026-07-22T12:00:00Z").getTime();

describe("assignmentStatus", () => {
  it("distinguishes pending and overdue work", () => {
    expect(assignmentStatus(base, now)).toBe("pending");
    expect(assignmentStatus({ ...base, deadline_at: "2026-07-21T12:00:00Z" }, now)).toBe("overdue");
  });

  it("distinguishes submitted and graded work", () => {
    const submission = { id: "s1", file_name: "work.pdf", submitted_at: "2026-07-21T10:00:00Z", is_late: false, score: null, feedback: null, reviewed_at: null, download_url: "" };
    expect(assignmentStatus({ ...base, submission }, now)).toBe("submitted");
    expect(assignmentStatus({ ...base, submission: { ...submission, score: 0 } }, now)).toBe("graded");
  });

  it("does not open an assignment when the page first loads", () => {
    render(<StudentAssignmentsClient assignments={[base]} />);

    expect(screen.getByText("Choose an assignment")).toBeInTheDocument();
    expect(screen.queryByLabelText("Close assignment")).not.toBeInTheDocument();
  });
});
