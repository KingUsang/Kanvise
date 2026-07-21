import { describe, expect, it } from "vitest";
import {
  calculatePaymentBreakdown,
  checkoutCallbackUrl,
  createPaystackReference,
  isUuid,
  parseCheckoutTarget,
} from "./checkout";

describe("payment checkout helpers", () => {
  it("accepts exactly one enrolment target", () => {
    expect(parseCheckoutTarget({ programme_id: "programme-1" })).toEqual({
      column: "programme_id", table: "programmes", id: "programme-1",
    });
    expect(parseCheckoutTarget({})).toBeNull();
    expect(parseCheckoutTarget({ programme_id: "one", course_id: "two" })).toBeNull();
  });

  it("calculates the split in kobo before converting back to naira", () => {
    expect(calculatePaymentBreakdown(10_000.01, 10)).toEqual({
      amountInKobo: 1_000_001,
      kanviseFee: 1000,
      centreAmount: 9000.01,
    });
  });

  it("rejects invalid prices and percentages", () => {
    expect(() => calculatePaymentBreakdown(0, 10)).toThrow("INVALID_PRICE");
    expect(() => calculatePaymentBreakdown(1000, 101)).toThrow("INVALID_PERCENTAGE_CHARGE");
  });

  it("creates an unguessable Paystack reference", () => {
    const reference = createPaystackReference();
    expect(reference).toMatch(/^KAN-[0-9a-f-]{36}$/);
    expect(isUuid(reference.slice(4))).toBe(true);
  });

  it("builds a callback URL without trusting client input", () => {
    expect(checkoutCallbackUrl("https://kanvise.com/", "KAN-123")).toBe(
      "https://kanvise.com/payment/return?reference=KAN-123",
    );
  });
});
