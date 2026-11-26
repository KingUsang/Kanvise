import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { retiredQuizRouter } from './retired-quiz'

const app = new Hono()
app.route('/', retiredQuizRouter)
app.get('/mocks/:mockId/questions', c => c.json({ ok: true }))

describe('retired Quiz routes', () => {
  const cases: Array<[string, string]> = [
    ['GET', '/mock/some-slug'],
    ['POST', '/mock/offer-1/claim'],
    ['POST', '/mock/offer-1/checkout'],
    ['GET', '/mock/orders/ref'],
    ['GET', '/my-mocks'],
    ['POST', '/guest/mock/offer-1/attempts'],
    ['GET', '/guest/attempts/a1/result'],
    ['POST', '/guest/attempts/a1/transfer'],
    ['GET', '/mocks/m1/offers'],
    ['POST', '/mocks/m1/offers'],
    ['PATCH', '/mocks/m1/offers/o1'],
  ]
  it.each(cases)('%s %s returns 410 with a clear message', async (method, path) => {
    const res = await app.request(path, { method })
    expect(res.status).toBe(410)
    const json = await res.json()
    expect(json.code).toBe('QUIZ_ROUTE_RETIRED')
    expect(json.error).toMatch(/retired/i)
  })

  it('leaves in-Class Quiz routes alone', async () => {
    const res = await app.request('/mocks/m1/questions')
    expect(res.status).toBe(200)
  })
})
