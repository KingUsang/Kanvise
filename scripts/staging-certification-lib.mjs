export const REQUIRED_JOURNEYS = ['D00', 'J01', 'J02', 'J03', 'J04', 'J05', 'J06', 'J07', 'J08', 'UX01', 'BS01']

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

export function certificationProblems(report, manifest) {
  const tests = collectTests(report)
  const problems = []
  for (const id of REQUIRED_JOURNEYS) {
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
