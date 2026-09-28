import { expect, test } from '@playwright/test'

const tutor = { email: 'tutor@demo.com', password: 'Password123!' }
const students = [
  { email: 'ada@demo.com', outcome: 'strong' },
  { email: 'tobi@demo.com', outcome: 'average' },
  { email: 'emeka@demo.com', outcome: 'struggling' },
]

test.use({ viewport: { width: 1920, height: 1080 } })

test('records the Kanvise tutor insight story', async ({ browser }, testInfo) => {
  // Recording runs can be slower on a laptop, but prerequisite failures below
  // remain short and explicit rather than consuming the whole recording window.
  test.setTimeout(10 * 60_000)
  const baseURL = process.env.E2E_BASE_URL
  if (!baseURL) throw new Error('E2E_BASE_URL must point to the prepared Kanvise demo deployment')

  async function open(page: import('@playwright/test').Page, path: string) {
    // A Vercel-served route can occasionally abort its first navigation while
    // the browser establishes the document request. Retry only that transport
    // condition; all UI assertions still verify the actual page afterwards.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await page.goto(path, { waitUntil: 'domcontentloaded' })
        return
      } catch (error) {
        if (!String(error).includes('net::ERR_ABORTED') || attempt === 1) throw error
        await page.waitForTimeout(750)
      }
    }
  }

  async function signIn(email: string, password: string, stateName: string) {
    const context = await browser.newContext({ baseURL, viewport: { width: 1920, height: 1080 } })
    const page = await context.newPage()
    await open(page, '/auth/login')
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 20_000 })
    // The login handler is client-side. Let its hydration complete before
    // submitting, otherwise a dev server can perform the form's native GET.
    await page.waitForTimeout(1_000)
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[type="password"]').fill(password)
    await page.locator('form button[type="submit"]').click()
    await page.waitForURL(/\/dashboard(?:\/|$)/, { timeout: 20_000 })
    const statePath = testInfo.outputPath('storage', `${stateName}.json`)
    await context.storageState({ path: statePath })
    await context.close()
    return statePath
  }

  async function enterPlugNmeet(page: import('@playwright/test').Page, showDeviceSetup = false) {
    // These selectors are taken from the deployed PlugNmeet UI, rather than
    // from Kanvise's surrounding page. Every participant enters the real room.
    await expect(page.locator('#plugNmeet-app > .landscape-device')).toBeVisible({ timeout: 45_000 })
    const preJoin = page.locator('#startupJoinModal')
    await expect(preJoin).toBeVisible({ timeout: 30_000 })
    if (showDeviceSetup) {
      await preJoin.getByRole('button', { name: 'Enable Microphone and Camera' }).click()
      await page.waitForTimeout(1_500)
    }
    await preJoin.getByRole('button', { name: 'Join as a listener' }).click()
    await expect(preJoin).toBeHidden({ timeout: 30_000 })
  }

  // Authenticate before the recording context opens so no login/setup footage is captured.
  const tutorState = await signIn(tutor.email, tutor.password, 'tutor')
  const studentStates: string[] = []
  for (const student of students) {
    studentStates.push(await signIn(student.email, tutor.password, student.email.split('@')[0]))
  }

  const tutorContext = await browser.newContext({
    baseURL,
    storageState: tutorState,
    viewport: { width: 1920, height: 1080 },
    permissions: ['camera', 'microphone'],
    recordVideo: { dir: testInfo.outputPath('videos'), size: { width: 1920, height: 1080 } },
  })
  const tutorPage = await tutorContext.newPage()
  tutorPage.setDefaultTimeout(30_000)
  const tutorVideo = tutorPage.video()
  const studentContexts = await Promise.all(studentStates.map(async (storageState, index) => {
    const context = await browser.newContext({ baseURL, storageState, viewport: { width: 1920, height: 1080 } })
    const page = await context.newPage()
    page.setDefaultTimeout(30_000)
    return { ...students[index], context, page }
  }))

  try {
    // Scene 1 — enter a real enrolled-learner classroom.
    await tutorPage.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    await tutorPage.getByRole('button', { name: 'Start live class' }).click()
    await tutorPage.getByRole('button', { name: /enrolled learners/i }).click()
    const subjectSelect = tutorPage.getByLabel('Subject')
    await expect(subjectSelect.locator('option', { hasText: 'Physics' })).toHaveCount(1, { timeout: 20_000 })
    await subjectSelect.selectOption({ label: 'Physics' })
    await tutorPage.getByRole('button', { name: /start class now/i }).click()
    await tutorPage.waitForURL(/\/class\/[^?]+\?start=true/, { timeout: 30_000 })
    const classURL = new URL(tutorPage.url())
    classURL.search = ''

    // The host must enter the provider room before learners join it. This is
    // both the natural classroom sequence and the readiness requirement of
    // the staged PlugNmeet provider.
    await enterPlugNmeet(tutorPage, true)

    await Promise.all(studentContexts.map(async ({ page }, index) => {
      // Stagger the external classroom bootstrap slightly; starting every
      // browser's module download in the same instant can starve a laptop.
      await page.waitForTimeout(index * 750)
      await page.goto(classURL.toString(), { waitUntil: 'domcontentloaded' })
      await enterPlugNmeet(page)
    }))

    // Scene 1 — enrolled learners have now joined the tutor's live room.
    await expect(tutorPage.locator('#plugNmeet-app')).toContainText('Participants (4)', { timeout: 30_000 })
    await expect(tutorPage.getByRole('button', { name: 'Check understanding' })).toBeVisible({ timeout: 30_000 })
    await tutorPage.waitForTimeout(2_000)

    // Scene 2 — the tutor genuinely teaches in PlugNmeet's native whiteboard.
    await tutorPage.getByRole('button', { name: 'Show Whiteboard' }).click()
    const whiteboard = tutorPage.locator('#plugNmeet-app canvas.interactive')
    await expect(whiteboard).toBeVisible({ timeout: 15_000 })
    await tutorPage.getByRole('button', { name: 'Text' }).click()
    await whiteboard.click({ position: { x: 230, y: 180 } })
    await tutorPage.keyboard.type("Newton's Third Law")
    await tutorPage.keyboard.press('Control+Enter')
    await tutorPage.waitForTimeout(4_000)

    // Scene 3 — the tutor authors and sends a check based on the lesson.
    await tutorPage.getByRole('button', { name: 'Check understanding' }).click({ force: true })
    await tutorPage.getByLabel('Knowledge check question').fill("Which situation best demonstrates Newton's Third Law?")
    await tutorPage.getByRole('button', { name: 'Send to learners' }).click()
    await expect(tutorPage.getByText("Which situation best demonstrates Newton's Third Law?")).toBeVisible()
    await tutorPage.waitForTimeout(3_000)

    await Promise.all(studentContexts.map(async ({ page, outcome }) => {
      await expect(page.getByText("Which situation best demonstrates Newton's Third Law?")).toBeVisible({ timeout: 20_000 })
      const answer = outcome === 'struggling'
        ? 'A car accelerating forward when the driver presses the gas pedal.'
        : 'A block resting on a table experiencing a normal force equal to its weight.'
      await page.getByRole('button', { name: answer }).click()
    }))
    await expect(tutorPage.getByText('✗ Incorrect')).toBeVisible({ timeout: 15_000 })
    await expect(tutorPage.getByText('✓ Correct')).toBeVisible({ timeout: 15_000 })
    await tutorPage.waitForTimeout(4_000)

    // Scene 4 — the tutor closes the check and returns to the live lesson.
    await tutorPage.getByRole('button', { name: 'Close' }).click()
    await tutorPage.waitForTimeout(1_500)

    // Scene 5 — establish the assessment from the tutor's workflow, then let students submit in the background.
    await tutorPage.goto('/dashboard/mocks', { waitUntil: 'domcontentloaded' })
    const todayMock = tutorPage.getByRole('row', { name: /Today's Physics Mock/i })
    await expect(todayMock).toBeVisible({ timeout: 20_000 })
    await tutorPage.waitForTimeout(2_000)

    await Promise.all(studentContexts.map(async ({ page, outcome }) => {
      await page.goto('/dashboard/student/mocks', { waitUntil: 'domcontentloaded' })
      const mockCard = page.locator('article', { has: page.getByRole('heading', { name: "Today's Physics Mock", exact: true }) })
      await mockCard.getByRole('link', { name: 'View instructions' }).click()
      await page.getByLabel(/starting begins my attempt/i).check()
      await page.getByRole('button', { name: 'Start mock' }).click()
      await expect(page.getByText(/Question 1 of/)).toBeVisible({ timeout: 20_000 })

      // The prepared mock alternates easy/correct A and hard/correct B questions.
      for (let question = 0; question < 8; question += 1) {
        if (outcome === 'strong' || (outcome === 'average' && question % 2 === 0)) {
          await page.keyboard.press(question % 2 === 0 ? 'a' : 'b')
        } else if (outcome === 'struggling') {
          // Emeka gets only the 41-mark Newton's Laws easy question correct,
          // matching the prepared cross-signal insight's current score.
          await page.keyboard.press(question === 0 ? 'a' : question % 2 === 0 ? 'b' : 'a')
        }
        if (question < 7) await page.keyboard.press('ArrowRight')
      }
      await page.getByRole('button', { name: 'Review' }).last().click()
      await page.getByRole('button', { name: 'Submit final answers' }).click()
      await page.waitForURL(/\/dashboard\/student\/mocks\/result\//, { timeout: 20_000 })
    }))

    // Scene 6 and 7 — show automatic scores and the class-level signal before opening Emeka's insight.
    await todayMock.getByRole('button', { name: /view results/i }).click()
    await expect(tutorPage.getByRole('heading', { name: 'Mock results' })).toBeVisible({ timeout: 20_000 })
    await expect(tutorPage.getByText('Emeka Okafor')).toBeVisible({ timeout: 20_000 })
    await tutorPage.waitForTimeout(3_000)

    // Scene 8 — the hero shot: the cross-signal interpretation stays visible long enough to read.
    await tutorPage.getByRole('button', { name: 'AI Analyze' }).click()
    await expect(tutorPage.getByRole('heading', { name: 'Emeka Okafor needs attention' })).toBeVisible({ timeout: 15_000 })
    await tutorPage.waitForTimeout(5_000)

    // Scene 9 and ending — record the available follow-up, then leave the class performance visible.
    await tutorPage.getByRole('button', { name: 'Send Support' }).click()
    await expect(tutorPage.getByRole('heading', { name: 'Mock results' })).toBeVisible()
    await tutorPage.waitForTimeout(3_000)
  } finally {
    await Promise.all(studentContexts.map(({ context }) => context.close()))
    await tutorContext.close()
    if (tutorVideo) {
      const recordingPath = testInfo.outputPath('kanvise-pitch-demo.webm')
      await tutorVideo.saveAs(recordingPath)
      await testInfo.attach('kanvise-pitch-demo', { path: recordingPath, contentType: 'video/webm' })
    }
  }
})
