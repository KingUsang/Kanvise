import assert from 'node:assert/strict'
import test from 'node:test'
import {
  REAL_DEVICE_JOURNEYS,
  REQUIRED_JOURNEYS,
  certificationProblems,
  realDeviceMode,
  requiredJourneys,
} from './staging-certification-lib.mjs'

function reportFor(ids, overrides = {}) {
  return { suites: [{ specs: ids.map((id) => ({
    title: `[${id}] journey`,
    tests: [{ status: overrides[id] || 'expected', results: [{ status: 'passed' }] }],
  })) }] }
}

const cleaned = { status: 'cleaned', events: [{ action: 'zero-residue-verified' }] }
const noDevices = {}
const withDevices = { BROWSERSTACK_USERNAME: 'user', BROWSERSTACK_ACCESS_KEY: 'key' }

test('accepts complete first-attempt coverage after verified cleanup without real devices', () => {
  assert.deepEqual(certificationProblems(reportFor(REQUIRED_JOURNEYS), cleaned, noDevices), [])
})

test('rejects missing, skipped, retried, and unclean runs', () => {
  const report = reportFor(REQUIRED_JOURNEYS.slice(1), { J01: 'skipped' })
  report.suites[0].specs[0].tests[0].results.push({ status: 'passed' })
  const problems = certificationProblems(report, { status: 'failed', events: [] }, noDevices)
  assert(problems.some((value) => value.includes('missing required journey D00')))
  assert(problems.some((value) => value.includes('first attempt')))
  assert(problems.some((value) => value.includes('not cleaned')))
})

test('every non-device journey stays required without real devices', () => {
  for (const id of REQUIRED_JOURNEYS) {
    const report = reportFor(REQUIRED_JOURNEYS.filter((value) => value !== id))
    assert.deepEqual(certificationProblems(report, cleaned, noDevices), [`missing required journey ${id}`])
  }
})

test('real-device journeys are optional and off by default', () => {
  assert.deepEqual(realDeviceMode(noDevices), { enabled: false, required: false, problems: [] })
  assert.deepEqual(realDeviceMode({ E2E_REQUIRE_REAL_DEVICES: 'false' }).problems, [])
  assert.deepEqual(requiredJourneys(noDevices), REQUIRED_JOURNEYS)
})

test('real-device journeys are required when both credentials are present', () => {
  assert.equal(realDeviceMode(withDevices).enabled, true)
  assert.deepEqual(requiredJourneys(withDevices), [...REQUIRED_JOURNEYS, ...REAL_DEVICE_JOURNEYS])
  assert.deepEqual(certificationProblems(reportFor(REQUIRED_JOURNEYS), cleaned, withDevices), ['missing required journey BS01'])
  assert.deepEqual(certificationProblems(reportFor([...REQUIRED_JOURNEYS, 'BS01']), cleaned, withDevices), [])
})

test('E2E_REQUIRE_REAL_DEVICES=true fails without credentials', () => {
  const env = { E2E_REQUIRE_REAL_DEVICES: 'true' }
  assert.deepEqual(realDeviceMode(env).problems, ['Missing real-device configuration: BROWSERSTACK_USERNAME, BROWSERSTACK_ACCESS_KEY'])
  const problems = certificationProblems(reportFor(REQUIRED_JOURNEYS), cleaned, env)
  assert(problems.includes('missing required journey BS01'))
  assert(problems.some((value) => value.startsWith('Missing real-device configuration')))
})

test('a single BrowserStack credential is a misconfiguration', () => {
  assert.deepEqual(realDeviceMode({ BROWSERSTACK_USERNAME: 'user' }).problems, ['Missing real-device configuration: BROWSERSTACK_ACCESS_KEY'])
  assert.deepEqual(realDeviceMode({ BROWSERSTACK_ACCESS_KEY: 'key' }).problems, ['Missing real-device configuration: BROWSERSTACK_USERNAME'])
})

test('rejects an invalid E2E_REQUIRE_REAL_DEVICES value', () => {
  assert.deepEqual(realDeviceMode({ E2E_REQUIRE_REAL_DEVICES: 'yes' }).problems, ['E2E_REQUIRE_REAL_DEVICES must be true or false, not yes'])
})

test('a failing real-device test still fails certification when it ran', () => {
  const report = reportFor([...REQUIRED_JOURNEYS, 'BS01'], { BS01: 'unexpected' })
  assert(certificationProblems(report, cleaned, noDevices).some((value) => value.includes('[BS01] journey: status unexpected')))
})
