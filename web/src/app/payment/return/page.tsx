import PaymentReturnStatus from "./payment-return-status";
import { resolvePaymentReference } from "./reference";

export default async function PaymentReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string | string[]; trxref?: string | string[] }>;
}) {
  const params = await searchParams;
  const reference = resolvePaymentReference(params);
  return <PaymentReturnStatus reference={reference} />;
}
