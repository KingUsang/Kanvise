import { describe, expect, it } from 'vitest'
import { createManifest, requireRunId, taggedValue, validateManifest } from './run-manifest'

const sha = '0123456789012345678901234567890123456789'

describe('staging run manifest', () => {
  it('creates an isolated manifest with a full release identity', () => {
    const manifest = createManifest({ E2E_RUN_ID: 'E2E-42-1', E2E_EXPECTED_SHA: sha } as NodeJS.ProcessEnv)
    expect(manifest).toMatchObject({ version: 1, runId: 'E2E-42-1', releaseSha: sha, status: 'running' })
    expect(manifest.tenants).toEqual([])
  })

  it('rejects unsafe run identifiers and unsupported manifests', () => {
    expect(() => requireRunId('production')).toThrow(/must start with E2E-/)
    expect(() => validateManifest({ version: 2, runId: 'E2E-x' })).toThrow(/Unsupported manifest/)
  })

  it('normalizes generated labels while preserving the run tag', () => {
    expect(taggedValue('E2E-42-1', 'Physics / Evening')).toBe('E2E-42-1-Physics-Evening')
  })
})
