import crypto from "node:crypto";

export type CheckoutTarget = {
  column: "programme_id" | "sub_programme_id" | "course_id";
  table: "programmes" | "sub_programmes" | "courses";
  id: string;
};

const TARGETS = [
  ["programme_id", "programmes"],
  ["sub_programme_id", "sub_programmes"],
  ["course_id", "courses"],
] as const;

export function parseCheckoutTarget(body: Record<string, unknown>): CheckoutTarget | null {
  const supplied = TARGETS.filter(([column]) => typeof body[column] === "string" && body[column]);
  if (supplied.length !== 1) return null;
  const [column, table] = supplied[0];
  return { column, table, id: body[column] as string };
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function createPaystackReference(): string {
  return `KAN-${crypto.randomUUID()}`;
}

export function calculatePaymentBreakdown(price: number, percentageCharge: number) {
  if (!Number.isFinite(price) || price <= 0) throw new Error("INVALID_PRICE");
  if (!Number.isFinite(percentageCharge) || percentageCharge < 0 || percentageCharge > 100) {
    throw new Error("INVALID_PERCENTAGE_CHARGE");
  }
  const amountInKobo = Math.round(price * 100);
  const kanviseFeeInKobo = Math.round(amountInKobo * (percentageCharge / 100));
  return {
    amountInKobo,
    kanviseFee: kanviseFeeInKobo / 100,
    centreAmount: (amountInKobo - kanviseFeeInKobo) / 100,
  };
}

export function checkoutCallbackUrl(frontendUrl: string): string {
  const url = new URL("/payment/return", frontendUrl);
  return url.toString();
}
