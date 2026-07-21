export type StudentPaymentStatus = "successful" | "pending" | "failed" | "none";

type PaymentRow = { status: string; paid_at?: string | null; created_at?: string | null };

export function summarizeStudentPayments(payments: PaymentRow[]): StudentPaymentStatus {
  if (!payments.length) return "none";
  const latest = [...payments].sort((left, right) => {
    const leftTime = Date.parse(left.created_at || left.paid_at || "") || 0;
    const rightTime = Date.parse(right.created_at || right.paid_at || "") || 0;
    return rightTime - leftTime;
  })[0];
  return latest.status === "successful" || latest.status === "pending" || latest.status === "failed"
    ? latest.status
    : "none";
}
