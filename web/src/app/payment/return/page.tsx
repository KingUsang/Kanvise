import PaymentReturnStatus from "./payment-return-status";

export default async function PaymentReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string | string[]; trxref?: string | string[] }>;
}) {
  const params = await searchParams;
  const pickFirst = (value?: string | string[]) => Array.isArray(value) ? value[0] : value || "";
  const reference = pickFirst(params.reference) || pickFirst(params.trxref);
  return <PaymentReturnStatus reference={reference} />;
}
