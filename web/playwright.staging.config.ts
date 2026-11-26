import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL
if (!baseURL) throw new Error('E2E_BASE_URL is required')
if (!/^https:\/\/staging\./.test(baseURL)) throw new Error(`Refusing non-staging E2E_BASE_URL: ${baseURL}`)
const authState = process.env.E2E_AUTH_STATE_PATH || `/tmp/${process.env.E2E_RUN_ID || 'kanvise-staging'}.admin-state.json`
// BrowserStack real-device projects are optional until an account exists. They
// run when both credentials are present, or when E2E_REQUIRE_REAL_DEVICES=true
// (the spec then fails on missing credentials). See scripts/staging-certification-lib.mjs.
const realDevices =
  process.env.E2E_REQUIRE_REAL_DEVICES?.trim() === 'true' ||
  Boolean(process.env.BROWSERSTACK_USERNAME?.trim() && process.env.BROWSERSTACK_ACCESS_KEY?.trim())
const realDeviceProjects = realDevices
  ? [
      { name: 'browserstack-pixel', dependencies: ['materials-assignments'], testMatch: '**/browserstack-real.spec.ts', use: { browserName: 'chromium' as const } },
      { name: 'browserstack-samsung', dependencies: ['materials-assignments'], testMatch: '**/browserstack-real.spec.ts', use: { browserName: 'chromium' as const } },
    ]
  : []

export default defineConfig({
  testDir: './e2e/staging',
  testMatch: '**/*.spec.ts',
  globalSetup: './e2e/staging/global-setup.ts',
  timeout: 120_000,
  globalTimeout: 55 * 60_000,
  workers: 1,
  fullyParallel: false,
  retries: 1,
  forbidOnly: true,
  reporter: [
    ['line'],
    ['json', { outputFile: 'test-results/staging-report.json' }],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL,
    trace: 'on',
    video: 'on',
    screenshot: 'on',
  },
  projects: [
    { name: 'setup', testMatch: '**/auth-activation.journey.spec.ts', use: { ...devices['Desktop Chrome'], trace: 'off', video: 'off', screenshot: 'off' } },
    { name: 'class-setup', dependencies: ['setup'], testMatch: '**/class-creation.journey.spec.ts', use: { ...devices['Desktop Chrome'], storageState: authState } },
    { name: 'student-handoff', dependencies: ['class-setup'], testMatch: '**/student-handoff.journey.spec.ts', use: { ...devices['Desktop Chrome'], storageState: authState } },
    { name: 'tutor-handoff', dependencies: ['class-setup'], testMatch: '**/tutor-handoff.journey.spec.ts', use: { ...devices['Desktop Chrome'], storageState: authState } },
    { name: 'materials-assignments', dependencies: ['student-handoff', 'tutor-handoff'], testMatch: '**/materials-assignments.journey.spec.ts', use: { ...devices['Desktop Chrome'], storageState: authState } },
    ...realDeviceProjects,
    { name: 'desktop', testMatch: ['**/deployment-identity.spec.ts', '**/*.device.spec.ts'], use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-360', testMatch: ['**/deployment-identity.spec.ts', '**/*.device.spec.ts'], use: { ...devices['Galaxy S9+'], viewport: { width: 360, height: 740 } } },
    { name: 'tablet', testMatch: ['**/deployment-identity.spec.ts', '**/*.device.spec.ts'], use: { ...devices['iPad (gen 7)'] } },
  ],
})
