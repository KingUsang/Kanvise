import { describe, expect, it } from 'vitest'
import {
  addSubject,
  buildOnboardingPayload,
  initialOnboardingState,
  onboardingReducer,
  replyFor,
  validateAgencyName,
  type OnboardingEvent,
  type OnboardingState,
} from './onboarding-script'

function run(events: OnboardingEvent[], from: OnboardingState = initialOnboardingState) {
  return events.reduce(onboardingReducer, from)
}

const solo: OnboardingEvent[] = [
  { type: 'start' },
  { type: 'answer', id: 'teaching_mode', value: 'solo' },
  { type: 'answer', id: 'audience', value: 'children_teens' },
  { type: 'answer', id: 'class_format', value: 'small_groups' },
  { type: 'subjects', subjects: ['Mathematics', 'Physics'] },
  { type: 'answer', id: 'has_students', value: true },
]

describe('onboarding state machine', () => {
  it('goes hello, five questions, then saves (independent tutor)', () => {
    expect(run([{ type: 'start' }]).step).toBe('teaching_mode')
    const done = run(solo)
    expect(done.step).toBe('saving')
    expect(buildOnboardingPayload(done.answers)).toEqual({
      teaching_mode: 'solo', audience: 'children_teens', class_format: 'small_groups', subjects: ['Mathematics', 'Physics'], has_students: true,
    })
  })

  it('asks for the agency name after the last question when teaching with a team (ONB-07)', () => {
    const team = run([{ type: 'start' }, { type: 'answer', id: 'teaching_mode', value: 'team' }, ...solo.slice(2)])
    expect(team.step).toBe('agency')
    expect(run([{ type: 'agency', name: 'A' }], team).step).toBe('agency')
    const saved = run([{ type: 'agency', name: '  Science Students Academy ' }], team)
    expect(saved.step).toBe('saving')
    expect(buildOnboardingPayload(saved.answers)).toMatchObject({ teaching_mode: 'team', agency_name: 'Science Students Academy' })
  })

  it('never sends an agency name for someone on their own', () => {
    expect(buildOnboardingPayload({ teaching_mode: 'solo', agency_name: 'Leftover' })).not.toHaveProperty('agency_name')
    const switched = run([{ type: 'answer', id: 'teaching_mode', value: 'solo' }], { step: 'teaching_mode', skipped: [], answers: { teaching_mode: 'team', agency_name: 'Old' } })
    expect(switched.answers.agency_name).toBeUndefined()
  })

  it('leaves skipped questions out so the API applies ONB-09 defaults', () => {
    const skipAll = run([{ type: 'start' }, ...Array.from({ length: 5 }, () => ({ type: 'skip-question' }) as OnboardingEvent)])
    expect(skipAll.step).toBe('saving')
    expect(skipAll.skipped).toHaveLength(5)
    expect(buildOnboardingPayload(skipAll.answers)).toEqual({})
  })

  it('counts Continue with no subjects as skipping the subjects question', () => {
    const state = run([{ type: 'start' }, { type: 'answer', id: 'teaching_mode', value: 'solo' }, { type: 'answer', id: 'audience', value: 'both' }, { type: 'answer', id: 'class_format', value: 'both' }, { type: 'subjects', subjects: [] }])
    expect(state.skipped).toEqual(['subjects'])
    expect(state.step).toBe('has_students')
  })

  it('goes back and keeps the earlier answer', () => {
    const state = run([{ type: 'start' }, { type: 'answer', id: 'teaching_mode', value: 'team' }, { type: 'back' }])
    expect(state.step).toBe('teaching_mode')
    expect(state.answers.teaching_mode).toBe('team')
    expect(run([{ type: 'back' }], initialOnboardingState).step).toBe('hello')
  })

  it('ignores an answer to a question that is not showing', () => {
    expect(run([{ type: 'start' }, { type: 'answer', id: 'audience', value: 'adults' }]).answers).toEqual({})
  })

  it('caps subjects at ten', () => {
    let subjects: string[] = []
    for (let i = 0; i < 12; i++) subjects = addSubject(subjects, `Subject ${i}`)
    expect(subjects).toHaveLength(10)
    expect(addSubject(['Music'], ' music ')).toEqual(['Music'])
    expect(addSubject(['Music'], '   ')).toEqual(['Music'])
  })

  it('validates the agency name length', () => {
    expect(validateAgencyName(' ')).toBe("Add your agency's name.")
    expect(validateAgencyName('A'.repeat(81))).not.toBeNull()
    expect(validateAgencyName('Ab')).toBeNull()
  })

  it('has a reply for every answer', () => {
    expect(replyFor('audience', { audience: 'children_teens' })).toContain('45 minutes')
    expect(replyFor('teaching_mode', { teaching_mode: 'team' })).toContain('inviting your tutors')
    expect(replyFor('has_students', { has_students: false })).toContain('sample course')
    expect(replyFor('class_format', {})).toBeNull()
  })
})
