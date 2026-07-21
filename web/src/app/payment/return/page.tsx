import PaymentReturnStatus from "./payment-return-status";

export default async function PaymentReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>;
}) {
  const { reference = "" } = await searchParams;
  return <PaymentReturnStatus reference={reference} />;
}
