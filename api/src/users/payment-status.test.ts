import { describe, expect, it } from "vitest";
import { summarizeStudentPayments } from "./payment-status";

describe("summarizeStudentPayments", () => {
  it("returns none when a student has no payment", () => {
    expect(summarizeStudentPayments([])).toBe("none");
  });

  it("reports the most recent payment instead of hiding a new pending checkout", () => {
    expect(summarizeStudentPayments([
      { status: "successful", created_at: "2026-07-01T10:00:00Z" },
      { status: "pending", created_at: "2026-07-21T10:00:00Z" },
    ])).toBe("pending");
  });

  it("reports a later successful retry after a failed payment", () => {
    expect(summarizeStudentPayments([
      { status: "failed", created_at: "2026-07-20T10:00:00Z" },
      { status: "successful", created_at: "2026-07-20T10:05:00Z" },
    ])).toBe("successful");
  });
});
