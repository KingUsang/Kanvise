import assert from 'node:assert/strict'
import test from 'node:test'
import { REQUIRED_JOURNEYS, certificationProblems } from './staging-certification-lib.mjs'

function reportFor(ids, overrides = {}) {
  return { suites: [{ specs: ids.map((id) => ({
    title: `[${id}] journey`,
    tests: [{ status: overrides[id] || 'expected', results: [{ status: 'passed' }] }],
  })) }] }
}

const cleaned = { status: 'cleaned', events: [{ action: 'zero-residue-verified' }] }

test('accepts complete first-attempt coverage after verified cleanup', () => {
  assert.deepEqual(certificationProblems(reportFor(REQUIRED_JOURNEYS), cleaned), [])
})

test('rejects missing, skipped, retried, and unclean runs', () => {
  const report = reportFor(REQUIRED_JOURNEYS.slice(1), { J01: 'skipped' })
  report.suites[0].specs[0].tests[0].results.push({ status: 'passed' })
  const problems = certificationProblems(report, { status: 'failed', events: [] })
  assert(problems.some((value) => value.includes('missing required journey D00')))
  assert(problems.some((value) => value.includes('first attempt')))
  assert(problems.some((value) => value.includes('not cleaned')))
})
