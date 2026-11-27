/**
 * Single registry of the web destinations notifications may link to (DEV-NTF-002).
 * Every pattern must exist as a page under web/src/app; routes.test.ts checks
 * this against the web route inventory so a renamed page fails the build.
 */
export const notificationRoutes = {
  learnerMock: '/dashboard/student/mocks/:id',
  learnerMockResult: '/dashboard/student/mocks/result/:id',
  learnerAssignments: '/dashboard/student/assignments',
  learnerClasses: '/dashboard/student/classes',
  learnerRecap: '/dashboard/student/classes/:id/recording',
  classroom: '/class/:id',
} as const

export type NotificationRouteName = keyof typeof notificationRoutes

export function notificationPath(name: NotificationRouteName, id?: string): string {
  const pattern: string = notificationRoutes[name]
  if (!pattern.includes(':id')) return pattern
  if (!id) throw new Error(`Notification route ${name} requires an id`)
  return pattern.replace(':id', encodeURIComponent(id))
}
