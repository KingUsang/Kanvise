export type DashboardPersona = 'admin' | 'tutor' | 'admin-tutor'

export function resolveDashboardPersona(capabilities: { isAdmin: boolean; isTutor: boolean }): DashboardPersona {
  if (capabilities.isAdmin && capabilities.isTutor) return 'admin-tutor'
  if (capabilities.isAdmin) return 'admin'
  return 'tutor'
}
