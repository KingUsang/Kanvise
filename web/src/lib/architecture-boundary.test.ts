import { readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourceRoot = join(process.cwd(), 'src')
const dataApiPattern = /\bsupabase\s*\.\s*(?:from|rpc|storage|functions)\b/

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    if (!['.ts', '.tsx'].includes(extname(entry.name)) || entry.name.endsWith('.test.ts')) return []
    return [path]
  })
}

describe('frontend architecture boundary', () => {
  it('uses Supabase only for Auth and sends application data through Hono', () => {
    const violations = sourceFiles(sourceRoot)
      .filter((path) => dataApiPattern.test(readFileSync(path, 'utf8')))
      .map((path) => path.replace(`${process.cwd()}/`, ''))

    expect(violations, 'Move Supabase table, RPC, Storage, or Function calls into the Hono API')
      .toEqual([])
  })
})
