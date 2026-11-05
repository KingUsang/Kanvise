import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const REQUIRED_PROTECTED_MIDDLEWARE = [
  'jwtVerificationMiddleware',
  'profileResolutionMiddleware',
  'tenantMiddleware',
] as const

export type RoutePolicy =
  | 'protected-account'
  | 'authenticated-pre-account'
  | 'public'
  | 'webhook'
  | 'internal-service'
  | 'mixed'

export type RoutePolicyFamily = {
  policy: RoutePolicy
  paths: readonly string[]
  observedMiddleware: readonly string[]
  knownGap?: string
  exception?: string
}

export type RoutePolicyEntry = {
  key: string
  kind: 'router' | 'inline'
  mount: string
  router?: string
  source: string
  policy: RoutePolicy
  observedMiddleware: readonly string[]
  knownGap?: string
  exception?: string
  families?: readonly RoutePolicyFamily[]
}

const router = (
  mount: string,
  routerName: string,
  source: string,
  policy: RoutePolicy,
  observedMiddleware: readonly string[],
  details: Pick<RoutePolicyEntry, 'knownGap' | 'exception' | 'families'> = {},
): RoutePolicyEntry => ({
  key: `router:${mount}|${routerName}`,
  kind: 'router',
  mount,
  router: routerName,
  source,
  policy,
  observedMiddleware,
  ...details,
})

const inline = (method: string, path: string, source = 'src/index.ts'): RoutePolicyEntry => ({
  key: `inline:${method} ${path}`,
  kind: 'inline',
  mount: path,
  source,
  policy: 'public',
  observedMiddleware: [],
})

const fullSequence = REQUIRED_PROTECTED_MIDDLEWARE
const jwtAndProfile = ['jwtVerificationMiddleware', 'profileResolutionMiddleware'] as const
const membershipSequence = ['jwtVerificationMiddleware', 'profileResolutionMiddleware', 'accountContextMiddleware'] as const

/**
 * Source-of-truth inventory for every API route mount in src/index.ts.
 *
 * Existing route-specific gaps are recorded instead of repaired here. The
 * conformance test makes those exceptions visible and prevents an unrecorded
 * omission from entering the assembly.
 */
export const routePolicyInventory: readonly RoutePolicyEntry[] = [
  router('/auth', 'publicRegistrationRouter', 'src/routes/public-registration.ts', 'public', []),
  router('/auth', 'authRouter', 'src/routes/auth.ts', 'mixed', fullSequence, {
    families: [
      {
        policy: 'public',
        paths: ['/tutor-invite/preview', '/invitation/preview', '/invitation/start'],
        observedMiddleware: [],
        exception: 'Signed invitation-token flows intentionally precede router authentication.',
      },
      {
        policy: 'authenticated-pre-account',
        paths: ['/profile/init'],
        observedMiddleware: fullSequence,
      },
    ],
  }),
  router('/avatars', 'avatarsRouter', 'src/routes/avatars.ts', 'protected-account', jwtAndProfile, {
    knownGap: 'DEV-SEC-006: router-wide tenantMiddleware is not yet attached.',
  }),
  router('/schools', 'schoolsRouter', 'src/routes/schools.ts', 'protected-account', fullSequence),
  router('/live-classes', 'liveClassesRouter', 'src/routes/live-classes.ts', 'protected-account', fullSequence),
  router('/public/live-classes', 'publicLiveClassesRouter', 'src/routes/public-live-classes.ts', 'public', []),
  router('/live-classes', 'slidesRouter', 'src/routes/slides.ts', 'protected-account', fullSequence),
  router('/webhooks', 'webhooksRouter', 'src/routes/webhooks.ts', 'webhook', [], {
    exception: 'Provider signatures and webhook-specific verification own this boundary.',
  }),
  router('/dashboard', 'dashboardRouter', 'src/routes/dashboard.ts', 'protected-account', jwtAndProfile, {
    knownGap: 'DEV-SEC-006: dashboard resolves tenant through route-local middleware.',
  }),
  router('/programmes', 'programmesRouter', 'src/routes/programmes.ts', 'protected-account', membershipSequence),
  router('/classes', 'classesRouter', 'src/routes/classes.ts', 'protected-account', membershipSequence),
  router('/sub-programmes', 'subProgrammesRouter', 'src/routes/sub-programmes.ts', 'protected-account', jwtAndProfile, {
    knownGap: 'DEV-SEC-006: router-wide tenantMiddleware is not yet attached.',
  }),
  router('/courses', 'coursesRouter', 'src/routes/courses.ts', 'protected-account', membershipSequence),
  router('/courses', 'courseAssignmentsRouter', 'src/routes/assignments.ts', 'protected-account', membershipSequence),
  router('/assignments', 'assignmentsRouter', 'src/routes/assignments.ts', 'protected-account', membershipSequence),
  router('/direct-assignments', 'directAssignmentsRouter', 'src/routes/direct-assignments.ts', 'protected-account', fullSequence),
  router('/public/direct-assignments', 'publicDirectAssignmentsRouter', 'src/routes/direct-assignments.ts', 'public', []),
  router('/users', 'usersRouter', 'src/routes/users.ts', 'protected-account', membershipSequence),
  router('/mocks', 'mocksRouter', 'src/routes/mocks.ts', 'protected-account', fullSequence),
  router('/mocks', 'mockOfferAdminRouter', 'src/routes/mock-access.ts', 'protected-account', fullSequence),
  router('/question-banks', 'questionBanksRouter', 'src/routes/question-banks.ts', 'protected-account', fullSequence),
  router('/enrolments', 'enrolmentsRouter', 'src/routes/enrolments.ts', 'protected-account', jwtAndProfile, {
    knownGap: 'DEV-SEC-006: router-wide tenantMiddleware is not yet attached.',
  }),
  router('/payments', 'paymentsRouter', 'src/routes/payments.ts', 'protected-account', jwtAndProfile, {
    knownGap: 'DEV-SEC-006: router-wide tenantMiddleware is not yet attached.',
  }),
  router('/attendance', 'attendanceRouter', 'src/routes/attendance.ts', 'protected-account', fullSequence),
  router('/public', 'publicRouter', 'src/routes/public.ts', 'public', []),
  router('/storage', 'storageRouter', 'src/routes/storage.ts', 'protected-account', jwtAndProfile, {
    knownGap: 'DEV-SEC-006: router-wide tenantMiddleware is not yet attached.',
  }),
  router('/notes', 'notesRouter', 'src/routes/notes.ts', 'protected-account', jwtAndProfile, {
    knownGap: 'DEV-SEC-006: router-wide tenantMiddleware is not yet attached.',
  }),
  router('/internal/payments', 'internalPaymentsRouter', 'src/routes/internal-payments.ts', 'internal-service', [], {
    exception: 'Shared-secret verification owns this service-to-service boundary.',
  }),
  router('/submissions', 'submissionsRouter', 'src/routes/submissions.ts', 'protected-account', membershipSequence),
  router('/mock-answers', 'mockAnswersRouter', 'src/routes/mock-answers.ts', 'protected-account', fullSequence),
  router('/health', 'healthRouter', 'src/routes/health.ts', 'public', []),
  router('/feedback', 'feedbackRouter', 'src/routes/feedback.ts', 'protected-account', jwtAndProfile, {
    knownGap: 'DEV-SEC-006: router-wide tenantMiddleware is not yet attached.',
  }),
  router('/support/feedback', 'feedbackResolutionRouter', 'src/routes/feedback.ts', 'public', [], {
    exception: 'Signed support-token verification owns this public resolution boundary.',
  }),
  router('/users/me/push', 'pushRouter', 'src/routes/push.ts', 'protected-account', fullSequence),
  router('/demo/analyze', 'demoAnalysisRouter', 'src/routes/demo-analysis.ts', 'protected-account', jwtAndProfile, {
    knownGap: 'DEV-SEC-006: router-wide tenantMiddleware is not yet attached.',
  }),
  router('/', 'waitlistRouter', 'src/routes/waitlist.ts', 'public', []),
  router('/telegram', 'telegramRouter', 'src/routes/telegram.ts', 'protected-account', fullSequence),
  router('/telegram', 'telegramWebhookRouter', 'src/routes/telegram.ts', 'webhook', [], {
    exception: 'Telegram secret verification owns this webhook boundary.',
  }),
  router('/schools/me/promos', 'promosRouter', 'src/routes/promos.ts', 'protected-account', fullSequence),
  router('/', 'mockAccessRouter', 'src/routes/mock-access.ts', 'mixed', jwtAndProfile, {
    families: [
      {
        policy: 'public',
        paths: ['/mock/:slug'],
        observedMiddleware: [],
      },
      {
        policy: 'protected-account',
        paths: ['/mock/*', '/my-mocks'],
        observedMiddleware: jwtAndProfile,
        knownGap: 'DEV-SEC-006: student mock access has no tenantMiddleware on its authenticated families.',
      },
    ],
  }),
  router('/students/me', 'studentMembershipsRouter', 'src/routes/student-memberships.ts', 'protected-account', jwtAndProfile, {
    knownGap: 'DEV-SEC-006: membership selection predates canonical tenantMiddleware.',
  }),
  router('/', 'guestMocksRouter', 'src/routes/guest-mocks.ts', 'mixed', [], {
    families: [
      {
        policy: 'public',
        paths: ['/guest/*'],
        observedMiddleware: [],
      },
      {
        policy: 'protected-account',
        paths: ['/guest/attempts/:attemptId/transfer'],
        observedMiddleware: jwtAndProfile,
        knownGap: 'DEV-SEC-006: authenticated guest-transfer route has no tenantMiddleware.',
      },
    ],
  }),
  router('/', 'studentMocksRouter', 'src/routes/student-mocks.ts', 'protected-account', jwtAndProfile, {
    knownGap: 'DEV-SEC-006: student mock endpoints attach JWT/profile per route but omit tenantMiddleware.',
  }),
  router('/', 'studentSettingsRouter', 'src/routes/student-settings.ts', 'protected-account', fullSequence),
  inline('POST', '/analytics/landing-events'),
  inline('GET', '/waitlist/count'),
  inline('POST', '/suggestions'),
]

export function discoverMountedRouteKeys(source: string): string[] {
  const keys: string[] = []
  const routerMountPattern = /^\s*app\.route\(\s*(['"])([^'"]+)\1\s*,\s*([A-Za-z_$][\w$]*)\s*\)/gm
  for (const match of source.matchAll(routerMountPattern)) {
    keys.push(`router:${match[2]}|${match[3]}`)
  }

  const inlineRoutePattern = /^\s*app\.(get|post|put|patch|delete)\(\s*(['"])([^'"]+)\2/gim
  for (const match of source.matchAll(inlineRoutePattern)) {
    keys.push(`inline:${match[1].toUpperCase()} ${match[3]}`)
  }
  return keys
}

function hasRequiredMiddleware(observed: readonly string[]): boolean {
  const hasJwtAndProfile = REQUIRED_PROTECTED_MIDDLEWARE.slice(0, 2).every((middleware) => observed.includes(middleware))
  return hasJwtAndProfile && (observed.includes('tenantMiddleware') || observed.includes('accountContextMiddleware'))
}

function validateProtectedEntry(entry: RoutePolicyEntry, label: string, errors: string[]): void {
  if (entry.policy === 'protected-account' && !hasRequiredMiddleware(entry.observedMiddleware) && !entry.knownGap) {
    errors.push(`${label} is protected-account but lacks the required JWT/profile plus tenant or account-context sequence or a recorded knownGap`)
  }
  for (const [index, family] of (entry.families || []).entries()) {
    if (family.policy !== 'protected-account') continue
    if (!hasRequiredMiddleware(family.observedMiddleware) && !family.knownGap) {
      errors.push(`${label} family ${index} is protected-account but lacks the required JWT/profile plus tenant or account-context sequence or a recorded knownGap`)
    }
  }
}

export function validateRoutePolicyInventory(
  discoveredKeys: readonly string[],
  inventory: readonly RoutePolicyEntry[] = routePolicyInventory,
): string[] {
  const errors: string[] = []
  const discovered = new Set<string>()
  const registered = new Map<string, RoutePolicyEntry>()

  for (const key of discoveredKeys) {
    if (discovered.has(key)) errors.push(`duplicate mounted route: ${key}`)
    discovered.add(key)
  }
  for (const entry of inventory) {
    if (registered.has(entry.key)) errors.push(`duplicate inventory entry: ${entry.key}`)
    registered.set(entry.key, entry)
    if (!entry.policy) errors.push(`missing policy: ${entry.key}`)
    validateProtectedEntry(entry, entry.key, errors)
  }

  for (const key of discovered) {
    if (!registered.has(key)) errors.push(`unclassified mounted route: ${key}`)
  }
  for (const key of registered.keys()) {
    if (!discovered.has(key)) errors.push(`stale inventory entry: ${key}`)
  }
  return errors
}

export function validateCurrentRoutePolicyInventory(indexSource = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf8')): string[] {
  return validateRoutePolicyInventory(discoverMountedRouteKeys(indexSource))
}
