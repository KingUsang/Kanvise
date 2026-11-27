import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ others: [] as any[], error: null as any }))
vi.mock('../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ in: () => ({ neq: () => ({ limit: async () => ({ data: db.others, error: db.error }) }) }) }) }) }) },
}))

import { recordingAdmission, RECORDING_CAPACITY_EXCEEDED } from './recorder-fleet'

describe('recording admission (DEV-REC-002)', () => {
  beforeEach(() => {
    db.others = []; db.error = null
    process.env.RECORDER_FLEET_ENABLED = 'true'
    process.env.RECORDER_FLEET_CONTROLLER_URL = 'https://controller.example'
    process.env.RECORDER_FLEET_CONTROLLER_SECRET = 's'
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('admits recording while a capture slot is free', async () => {
    db.others = [{ id: 'a' }]
    expect(await recordingAdmission('c')).toEqual({ admitted: true })
  })

  it('denies recording when two other classes already hold the capture slots', async () => {
    db.others = [{ id: 'a' }, { id: 'b' }]
    expect(await recordingAdmission('c')).toMatchObject({ admitted: false, code: RECORDING_CAPACITY_EXCEEDED })
  })

  it('fails open when the lookup errors so the class is never blocked', async () => {
    db.error = new Error('db down')
    expect(await recordingAdmission('c')).toEqual({ admitted: true })
  })

  it('does not gate when the recorder fleet is not configured', async () => {
    process.env.RECORDER_FLEET_ENABLED = 'false'
    db.others = [{ id: 'a' }, { id: 'b' }]
    expect(await recordingAdmission('c')).toEqual({ admitted: true })
  })
})
