export function buildWhatsAppHref(phone: string | null | undefined) {
  const digits = String(phone ?? '').replace(/\D/g, '')
  return digits ? `https://wa.me/${digits}` : null
}
