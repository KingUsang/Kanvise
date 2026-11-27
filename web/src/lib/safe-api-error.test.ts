import { describe, expect, it } from 'vitest'
import { readApiBody, responseErrorMessage, safeApiErrorMessage, SESSION_ENDED_MESSAGE } from './safe-api-error'

describe('safe API error boundary', () => {
  it('maps an empty unauthorized response to the sign-in continuation', () => {
    expect(responseErrorMessage(new Response(null, { status: 401 }), 'fallback')).toBe(SESSION_ENDED_MESSAGE)
  })

  it('does not surface arbitrary Error.message values', () => {
    expect(safeApiErrorMessage(new Error('provider secret and stack details'), 'Try again.')).toBe('Try again.')
    expect(safeApiErrorMessage(new Error(SESSION_ENDED_MESSAGE), 'Try again.')).toBe(SESSION_ENDED_MESSAGE)
  })

  it('preserves explicitly allow-listed safe feature messages', () => {
    const missingTutorMessage = 'Assign tutors to: Chemistry, Biology'
    const activeEnrolmentMessage = 'This programme has enrolled learners, so it cannot be deleted. Unpublish it instead to remove it from the learner page.'

    expect(safeApiErrorMessage(new Error(missingTutorMessage), 'Review the class setup.', [missingTutorMessage])).toBe(missingTutorMessage)
    expect(safeApiErrorMessage(new Error(activeEnrolmentMessage), 'Try again.', [activeEnrolmentMessage])).toBe(activeEnrolmentMessage)
    expect(safeApiErrorMessage(new Error('provider secret and stack details'), 'Try again.', [activeEnrolmentMessage])).toBe('Try again.')
  })

  it('reads structured bodies without consuming the response', async () => {
    const response = new Response(JSON.stringify({ code: 'CLASS_NAME_TAKEN' }), { status: 409 })
    await expect(readApiBody<{ code: string }>(response)).resolves.toEqual({ code: 'CLASS_NAME_TAKEN' })
    await expect(response.json()).resolves.toEqual({ code: 'CLASS_NAME_TAKEN' })
  })
})
