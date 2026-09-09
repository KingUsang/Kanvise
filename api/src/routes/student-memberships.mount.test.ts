import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { studentMembershipsRouter } from './student-memberships'

describe('student memberships router mounting', () => {
  it('does not require student authentication on unrelated guest routes', async () => {
    const app = new Hono()
    app.route('/students/me', studentMembershipsRouter)
    app.get('/guest/attempts/:attemptId', c => c.json({ data: 'guest attempt' }))

    const response = await app.request('/guest/attempts/attempt-1')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: 'guest attempt' })
  })
})
