export type DashboardPersona = 'admin' | 'tutor' | 'solo-tutor'

export function resolveDashboardPersona(capabilities: { isAdmin: boolean; isTutor: boolean }): DashboardPersona {
  if (capabilities.isAdmin && capabilities.isTutor) return 'solo-tutor'
  if (capabilities.isAdmin) return 'admin'
  return 'tutor'
}
