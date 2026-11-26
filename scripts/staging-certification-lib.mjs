export const REQUIRED_JOURNEYS = ['D00', 'J01', 'J02', 'J03', 'J04', 'J05', 'J06', 'J07', 'J08', 'UX01']

// BrowserStack real-device journeys are optional until the project has a
// BrowserStack account. They run, and become required, only when both
// credentials are present or E2E_REQUIRE_REAL_DEVICES=true.
export const REAL_DEVICE_JOURNEYS = ['BS01']
export const REAL_DEVICE_CREDENTIALS = ['BROWSERSTACK_USERNAME', 'BROWSERSTACK_ACCESS_KEY']

export function realDeviceMode(env = process.env) {
  const flag = env.E2E_REQUIRE_REAL_DEVICES?.trim() || ''
  const problems = []
  if (!['', 'true', 'false'].includes(flag)) problems.push(`E2E_REQUIRE_REAL_DEVICES must be true or false, not ${flag}`)
  const required = flag === 'true'
  const missing = REAL_DEVICE_CREDENTIALS.filter((name) => !env[name]?.trim())
  const enabled = missing.length === 0
  // A single credential is a misconfiguration, not an opt-out.
  if (missing.length && (required || missing.length < REAL_DEVICE_CREDENTIALS.length)) {
    problems.push(`Missing real-device configuration: ${missing.join(', ')}`)
  }
  return { enabled, required, problems }
}

export function requiredJourneys(env = process.env) {
  const { enabled, required } = realDeviceMode(env)
  return enabled || required
    ? [...REQUIRED_JOURNEYS, ...REAL_DEVICE_JOURNEYS]
    : [...REQUIRED_JOURNEYS]
}

export function collectTests(report) {
  const tests = []
  const visit = (suite) => {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) tests.push({ title: spec.title, ...test })
    }
    for (const child of suite.suites || []) visit(child)
  }
  for (const suite of report.suites || []) visit(suite)
  return tests
}

export function certificationProblems(report, manifest, env = process.env) {
  const tests = collectTests(report)
  const problems = [...realDeviceMode(env).problems]
  for (const id of requiredJourneys(env)) {
    if (!tests.some((test) => test.title.includes(`[${id}]`))) problems.push(`missing required journey ${id}`)
  }
  for (const test of tests) {
    if (test.status !== 'expected') problems.push(`${test.title}: status ${test.status}`)
    if ((test.results || []).length !== 1 || test.results[0]?.status !== 'passed') {
      problems.push(`${test.title}: did not pass once on its first attempt`)
    }
  }
  if (manifest.status !== 'cleaned') problems.push(`run manifest status is ${manifest.status}, not cleaned`)
  if (!(manifest.events || []).some((event) => event.action === 'zero-residue-verified')) problems.push('cleanup has no zero-residue evidence')
  return [...new Set(problems)]
}
