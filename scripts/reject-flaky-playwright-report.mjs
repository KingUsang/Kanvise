import { readFile } from 'node:fs/promises'

const reportPath = process.argv[2]
if (!reportPath) throw new Error('Usage: node scripts/reject-flaky-playwright-report.mjs <report.json>')

const report = JSON.parse(await readFile(reportPath, 'utf8'))
const flaky = []
const visit = (suite) => {
  for (const spec of suite.specs || []) {
    for (const test of spec.tests || []) {
      if (test.status === 'flaky' || (test.results || []).some((result, index) => index > 0 && result.status === 'passed')) {
        flaky.push(spec.title)
      }
    }
  }
  for (const child of suite.suites || []) visit(child)
}
for (const suite of report.suites || []) visit(suite)
if (flaky.length) {
  console.error(`Release certification rejected because tests were flaky: ${[...new Set(flaky)].join(', ')}`)
  process.exit(1)
}
console.log('No flaky Playwright tests detected')
