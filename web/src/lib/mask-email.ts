export function maskEmail(email: string) {
  const [local, domain] = email.trim().split('@')
  if (!local || !domain) return email
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2)
  return `${visible}${'•'.repeat(Math.max(3, Math.min(6, local.length - visible.length)))}@${domain}`
}
