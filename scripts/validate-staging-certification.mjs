import { readFile } from 'node:fs/promises'
import { certificationProblems } from './staging-certification-lib.mjs'

const [reportPath, manifestPath] = process.argv.slice(2)
if (!reportPath || !manifestPath) throw new Error('Usage: node scripts/validate-staging-certification.mjs <playwright-report.json> <run.manifest.json>')
const [report, manifest] = await Promise.all([
  readFile(reportPath, 'utf8').then(JSON.parse),
  readFile(manifestPath, 'utf8').then(JSON.parse),
])
const problems = certificationProblems(report, manifest)
if (problems.length) {
  console.error(`Staging certification rejected:\n- ${problems.join('\n- ')}`)
  process.exit(1)
}
console.log(`Staging certification passed for ${manifest.runId} at ${manifest.releaseSha}`)
