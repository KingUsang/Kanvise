import { describe, expect, it } from "vitest";
import { resolvePaymentReference } from "./reference";

describe("resolvePaymentReference", () => {
  it("prefers the explicit reference and ignores duplicate params", () => {
    expect(resolvePaymentReference({
      reference: ["KAN-1", "KAN-2"],
      trxref: ["PAY-1"],
    })).toBe("KAN-1");
  });

  it("falls back to trxref when reference is missing", () => {
    expect(resolvePaymentReference({
      trxref: "PAY-1",
    })).toBe("PAY-1");
  });
});
