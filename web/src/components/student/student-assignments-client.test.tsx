import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { assignmentStatus, StudentAssignmentsClient } from "./student-assignments-client";
import type { StudentAssignment } from "@/lib/student-assignments";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { authenticatedApiFetch } = vi.hoisted(() => ({ authenticatedApiFetch: vi.fn() }));
vi.mock("@/lib/authenticated-fetch", () => ({ authenticatedApiFetch }));
vi.mock("@/config/api", () => ({ getApiUrl: () => "https://api.test" }));

const base: StudentAssignment = { id: "a1", title: "Essay", description: "Write", deadline_at: "2026-07-23T12:00:00Z", created_at: "2026-07-20T12:00:00Z", attachment_file_name: null, attachment_download_url: null, course: null, submission: null };
const now = new Date("2026-07-22T12:00:00Z").getTime();

describe("assignmentStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticatedApiFetch.mockResolvedValue(new Response(JSON.stringify({ data: [base] }), { status: 200 }));
  });

  function renderAssignments(assignments?: StudentAssignment[]) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={queryClient}><StudentAssignmentsClient assignments={assignments} /></QueryClientProvider>);
  }
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
    renderAssignments([base]);

    expect(screen.getByText("Choose an assignment")).toBeInTheDocument();
    expect(screen.queryByLabelText("Close assignment")).not.toBeInTheDocument();
  });

  it("shows every status without a horizontally scrolling filter strip", () => {
    renderAssignments([base]);

    const filters = screen.getByRole("group", { name: "Filter assignments by status" });
    expect(filters).toHaveClass("grid", "grid-cols-3");
    expect(filters).not.toHaveClass("overflow-x-auto");
    for (const label of ["all", "pending", "submitted", "graded", "overdue"]) {
      expect(screen.getByRole("button", { name: label })).toBeVisible();
    }
  });

  it("keeps cached assignments visible when a background refresh fails", async () => {
    authenticatedApiFetch.mockRejectedValueOnce(new Error("Network unavailable"));
    renderAssignments([base]);

    expect(screen.getByText("Essay")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Refresh failed"));
    expect(screen.getByText("Essay")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows an initial failure with a retry action", async () => {
    authenticatedApiFetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Your session has ended. Please sign in again." }), { status: 401 }));
    renderAssignments();

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Your session has ended"));
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("flips pending work to overdue when the deadline passes on an open page", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    try {
      vi.setSystemTime(new Date("2026-07-23T11:59:50Z"));
      renderAssignments([base]);
      expect(screen.getByText("pending", { selector: "span" })).toBeInTheDocument();
      act(() => { vi.advanceTimersByTime(11_000); });
      expect(screen.getByText("overdue", { selector: "span" })).toBeInTheDocument();
    } finally { vi.useRealTimers(); }
  });
});
