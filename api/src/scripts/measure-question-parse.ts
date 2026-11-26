import fs from 'node:fs'
import path from 'node:path'
import 'dotenv/config'
import { importQuestionsFromDocumentText, importQuestionsFromPdf } from '../domain/mock-pdf-import'

const DEFAULT_TEXT = `1. An object is thrown vertically upwards with velocity 20 m/s. Neglecting air resistance, calculate the maximum height reached. (Take g = 10 m/s²)

A. 10 m
B. 20 m
C. 30 m
D. 40 m

2. The function y = 3x² - 5x + 2 crosses the x-axis at:

A. x = 1 and x = 2/3
B. x = 1 and x = 3/2
C. x = 2 and x = 1/3
D. x = 3 and x = 2/3

3. Explain the difference between osmosis and diffusion in a living cell.`

function parseArgs(argv: string[]) {
  const args: Record<string, string | number | boolean> = {}
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      args[key] = next
      i += 1
    } else {
      args[key] = true
    }
  }
  return args
}

function readInputFromCli(args: Record<string, string | number | boolean>) {
  if (typeof args.file === 'string') {
    return { kind: 'file', value: path.resolve(args.file as string) }
  }
  if (typeof args.pdf === 'string') {
    return { kind: 'pdf', value: path.resolve(args.pdf as string) }
  }
  if (typeof args.text === 'string') {
    return { kind: 'text', value: args.text }
  }
  return { kind: 'text', value: DEFAULT_TEXT }
}

async function measureOne(label: string, fn: () => Promise<unknown>) {
  const startedAt = Date.now()
  const result = await fn()
  const elapsedMs = Date.now() - startedAt
  return { label, elapsedMs, result }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const runs = Number(args.runs ?? 1)
  const input = readInputFromCli(args)

  if (!Number.isFinite(runs) || runs <= 0) {
    throw new Error('The --runs flag must be a positive integer.')
  }

  const tasks: Array<() => Promise<unknown>> = []
  for (let i = 0; i < runs; i += 1) {
    tasks.push(async () => {
      if (input.kind === 'pdf') {
        const buffer = fs.readFileSync(input.value as string)
        return importQuestionsFromPdf(new Uint8Array(buffer))
      }
      if (input.kind === 'file') {
        const text = fs.readFileSync(input.value as string, 'utf8')
        return importQuestionsFromDocumentText(text, path.basename(input.value as string))
      }
      return importQuestionsFromDocumentText(input.value as string, 'benchmark-text')
    })
  }

  console.log('Parsing benchmark started')
  console.log(JSON.stringify({
    inputKind: input.kind,
    runs,
    source: typeof input.value === 'string' ? input.value : (input.value as string),
    geminiModel: process.env.GEMINI_MOCK_IMPORT_MODEL || 'gemini-2.5-flash',
  }, null, 2))

  const measurements: Array<{ label: string; elapsedMs: number; result: any }> = []
  for (let i = 0; i < tasks.length; i += 1) {
    const { label, elapsedMs, result } = await measureOne(`run-${i + 1}`, tasks[i])
    measurements.push({ label, elapsedMs, result })
    console.log(JSON.stringify({
      label,
      elapsedMs,
      questionCount: Array.isArray(result?.questions) ? result.questions.length : 0,
      warnings: Array.isArray(result?.warnings) ? result.warnings.length : 0,
      pageCount: result?.page_count ?? null,
    }, null, 2))
  }

  const averageMs = measurements.reduce((sum, item) => sum + item.elapsedMs, 0) / measurements.length
  const minMs = Math.min(...measurements.map((item) => item.elapsedMs))
  const maxMs = Math.max(...measurements.map((item) => item.elapsedMs))

  console.log(JSON.stringify({
    summary: {
      runs: measurements.length,
      averageMs: Number(averageMs.toFixed(2)),
      minMs,
      maxMs,
      totalMs: measurements.reduce((sum, item) => sum + item.elapsedMs, 0),
    },
  }, null, 2))
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error('Question parse benchmark failed:', message)
  process.exitCode = 1
})
