import { Hono } from 'hono'

// Standalone, public, paid, marketplace and guest Quizzes were retired
// (DEV-DOM-007, DOM-009, DOM-010). Quizzes now exist only inside a Class. The old
// public URLs answer 410 Gone with a stable code so old links and cached clients
// get a clear message instead of a 404 or an auth challenge. No data is touched.
export const retiredQuizRouter = new Hono()

const body = {
  error: 'Standalone, public and paid Quizzes have been retired. Quizzes are now taken inside your Class.',
  code: 'QUIZ_ROUTE_RETIRED',
}

const gone = (c: any) => c.json(body, 410)

retiredQuizRouter.all('/mock', gone)
retiredQuizRouter.all('/mock/*', gone)
retiredQuizRouter.all('/my-mocks', gone)
retiredQuizRouter.all('/guest', gone)
retiredQuizRouter.all('/guest/*', gone)
retiredQuizRouter.all('/mocks/:mockId/offers', gone)
retiredQuizRouter.all('/mocks/:mockId/offers/*', gone)
