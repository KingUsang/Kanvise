import { readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourceRoot = join(process.cwd(), 'src')
const dataApiPattern = /\bsupabase\s*\.\s*(?:from|rpc|storage|functions)\b/
const fileMutationPattern = /\b(?:appendFile|appendFileSync|mkdir|mkdirSync|rename|renameSync|rm|rmSync|rmdir|rmdirSync|unlink|unlinkSync|writeFile|writeFileSync)\s*\(/
const credentialPropPattern = /\b(?:accessToken|access_token|session|token)\s*=\s*\{/
const dashboardBusinessFetchPattern = /\b(?:fetch|authenticatedFetch|authenticatedApiFetch)\s*\(/
const clientModulePattern = /^\s*['"]use client['"];?/m

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

  it('does not mutate the filesystem from Next route handlers', () => {
    const violations = sourceFiles(sourceRoot)
      .filter((path) => /[/\\]route\.tsx?$/.test(path))
      .filter((path) => fileMutationPattern.test(readFileSync(path, 'utf8')))
      .map((path) => path.replace(`${process.cwd()}/`, ''))

    expect(violations, 'Remove filesystem mutation from Next route handlers')
      .toEqual([])
  })

  it('does not pass auth credentials from dashboard Server Components into client props', () => {
    const dashboardRoot = join(sourceRoot, 'app', 'dashboard')
    const violations = sourceFiles(dashboardRoot)
      .filter((path) => /[/\\](?:page|layout)\.tsx?$/.test(path))
      .filter((path) => {
        const source = readFileSync(path, 'utf8')
        return !clientModulePattern.test(source) && credentialPropPattern.test(source)
      })
      .map((path) => path.replace(`${process.cwd()}/`, ''))

    expect(violations, 'Obtain browser API credentials at request time through authenticatedApiFetch')
      .toEqual([])
  })

  it('does not fetch Hono business data from dashboard Server Components', () => {
    const dashboardRoot = join(sourceRoot, 'app', 'dashboard')
    const violations = sourceFiles(dashboardRoot)
      .filter((path) => /[/\\](?:page|layout)\.tsx?$/.test(path))
      .filter((path) => {
        const source = readFileSync(path, 'utf8')
        return !clientModulePattern.test(source) && dashboardBusinessFetchPattern.test(source)
      })
      .map((path) => path.replace(`${process.cwd()}/`, ''))

    expect(violations, 'Move dashboard business-data reads into Client Components through TanStack Query and authenticatedApiFetch')
      .toEqual([])
  })
})
