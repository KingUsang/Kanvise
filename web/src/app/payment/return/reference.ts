export type PaymentReturnSearchParams = {
  reference?: string | string[];
  trxref?: string | string[];
};

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value || "";
}

export function resolvePaymentReference(searchParams: PaymentReturnSearchParams): string {
  return firstValue(searchParams.reference) || firstValue(searchParams.trxref);
}
