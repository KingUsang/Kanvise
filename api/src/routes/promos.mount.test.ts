import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { promosRouter } from './promos'

describe('promotions router mounting', () => {
  it('does not apply its admin middleware to unrelated student routes', async () => {
    const app = new Hono()
    app.route('/schools/me/promos', promosRouter)
    app.get('/students/me/settings', c => c.json({ data: 'student settings' }))

    const response = await app.request('/students/me/settings')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: 'student settings' })
  })
})
