import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const tutor = { email: 'tutor@demo.com', password: 'Password123!' }
const students = [
  { email: 'ada@demo.com', outcome: 'strong' },
  { email: 'tobi@demo.com', outcome: 'average' },
  { email: 'emeka@demo.com', outcome: 'struggling' },
]
const mobileRecording = process.env.KANVISE_MOBILE_RECORDING === '1'
const recordingViewport = mobileRecording ? { width: 393, height: 851 } : { width: 1920, height: 1080 }

function webEnv(name: string) {
  const match = readFileSync('web/.env.local', 'utf8').match(new RegExp(`^${name}=(.+)$`, 'm'))
  if (!match) throw new Error(`Missing ${name} in web/.env.local`)
  return match[1].trim().replace(/^['"]|['"]$/g, '')
}

test.use({ viewport: { width: 1920, height: 1080 } })

test('records the Kanvise tutor insight story', async ({ browser }, testInfo) => {
  // Recording runs can be slower on a laptop, but prerequisite failures below
  // remain short and explicit rather than consuming the whole recording window.
  test.setTimeout(10 * 60_000)
  const baseURL = process.env.E2E_BASE_URL
  if (!baseURL) throw new Error('E2E_BASE_URL must point to the prepared Kanvise demo deployment')

  async function addRecordingClickCue(context: import('@playwright/test').BrowserContext) {
    // Recording-only affordance: a restrained pulse makes each intentional
    // tutor/learner action legible in the pitch edit without altering Kanvise.
    await context.addInitScript(() => {
      document.addEventListener('pointerdown', event => {
        const cue = document.createElement('span')
        cue.setAttribute('aria-hidden', 'true')
        cue.style.cssText = `position:fixed;left:${event.clientX - 18}px;top:${event.clientY - 18}px;width:36px;height:36px;border:3px solid #7c3aed;border-radius:9999px;background:rgba(124,58,237,.14);pointer-events:none;z-index:2147483647;animation:kanvise-recording-click .5s ease-out forwards;`
        document.body.appendChild(cue)
        window.setTimeout(() => cue.remove(), 520)
      }, true)
      const style = document.createElement('style')
      style.textContent = '@keyframes kanvise-recording-click { from { transform:scale(.45); opacity:1 } to { transform:scale(1.45); opacity:0 } }'
      document.documentElement.appendChild(style)
    })
  }

  async function open(page: import('@playwright/test').Page, path: string) {
    // A Vercel-served route can occasionally abort its first navigation while
    // the browser establishes the document request. Retry only that transport
    // condition; all UI assertions still verify the actual page afterwards.
    const preJoin = page.locator('#startupJoinModal')
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
    if (mobileRecording) {
      // Staging's mobile login transport can briefly create an anonymous
      // browser session. Use the same Supabase session cookie the app creates
      // after login, before recording begins, so this remains an authenticated
      // real UI flow without login footage.
      const supabaseUrl = webEnv('NEXT_PUBLIC_SUPABASE_URL')
      const auth = createClient(supabaseUrl, webEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
      const { data, error } = await auth.auth.signInWithPassword({ email, password })
      if (error || !data.session) throw error ?? new Error(`Could not sign in ${email}`)
      const context = await browser.newContext({ baseURL, viewport: recordingViewport, hasTouch: true })
      const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
      const value = `base64-${Buffer.from(JSON.stringify(data.session)).toString('base64url')}`
      await context.addCookies(Array.from({ length: Math.ceil(value.length / 3000) }, (_, index) => ({
        name: `sb-${projectRef}-auth-token.${index}`,
        value: value.slice(index * 3000, (index + 1) * 3000),
        url: baseURL!, sameSite: 'Lax' as const,
      })))
      const statePath = testInfo.outputPath('storage', `${stateName}.json`)
      await context.storageState({ path: statePath })
      await context.close()
      return statePath
    }
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
    const preJoin = page.locator('#startupJoinModal')
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        // The provider renders a portrait pre-join surface on phones and its
        // landscape wrapper only on desktop.
        if (!mobileRecording) await expect(page.locator('#plugNmeet-app > .landscape-device')).toBeVisible({ timeout: 45_000 })
        await expect(preJoin).toBeVisible({ timeout: 30_000 })
        break
      } catch (error) {
        if (attempt === 1) throw error
        // The external room bundle can miss its first mount under local CPU
        // pressure. Reload once and still verify the actual native room.
        // We only need the document to restart; the provider bundle mounts
        // afterwards and is verified by the next visibility assertion.
        if (mobileRecording) await page.waitForTimeout(2_000)
        else await page.reload({ waitUntil: 'commit', timeout: 15_000 })
      }
    }
    if (showDeviceSetup) {
      await preJoin.getByRole('button', { name: 'Enable Microphone and Camera' }).click()
      await page.waitForTimeout(1_500)
    }
    await preJoin.getByRole('button', { name: 'Join as a listener' }).click()
    // The portrait provider keeps this node in the DOM after joining; the
    // classroom participant-count assertion below is the reliable proof that
    // the learner actually entered.
    if (mobileRecording) await page.waitForTimeout(1_500)
    else await expect(preJoin).toBeHidden({ timeout: 30_000 })
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
    viewport: recordingViewport,
    permissions: ['camera', 'microphone'],
    hasTouch: mobileRecording,
    recordVideo: { dir: testInfo.outputPath('videos'), size: recordingViewport },
  })
  await addRecordingClickCue(tutorContext)
  const tutorPage = await tutorContext.newPage()
  tutorPage.setDefaultTimeout(30_000)
  const tutorVideo = tutorPage.video()
  const studentContexts = await Promise.all(studentStates.map(async (storageState, index) => {
    const student = students[index]
    const context = await browser.newContext({
      baseURL,
      storageState,
      viewport: recordingViewport,
      hasTouch: mobileRecording,
      // Emeka is the hero learner: record his actual question and mock flow
      // so the pitch edit can cut to the learner interface, not only tutor UI.
      ...(student.outcome === 'struggling'
        ? { recordVideo: { dir: testInfo.outputPath('student-videos'), size: recordingViewport } }
        : {}),
    })
    if (student.outcome === 'struggling') await addRecordingClickCue(context)
    const page = await context.newPage()
    page.setDefaultTimeout(30_000)
    return { ...student, context, page, video: page.video() }
  }))

  try {
    // Scene 1 — enter a real enrolled-learner classroom.
    await tutorPage.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    if (mobileRecording) await tutorPage.waitForTimeout(1_000)
    await tutorPage.getByRole('button', { name: 'Start live class' }).click()
    await expect(tutorPage.getByRole('heading', { name: 'Start a live class' })).toBeVisible({ timeout: 20_000 })
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

    for (const { page } of studentContexts) {
      // PlugNmeet is an external bundle. Joining one learner at a time avoids
      // starving a slower laptop while still showing all four participants.
      await page.goto(classURL.toString(), { waitUntil: 'domcontentloaded' })
      await enterPlugNmeet(page)
      await page.waitForTimeout(750)
    }

    // Scene 1 — enrolled learners have now joined the tutor's live room.
    if (mobileRecording) await expect(tutorPage.locator('#plugNmeet-app')).toContainText(/Show Participant List\s*4/, { timeout: 30_000 })
    else await expect(tutorPage.locator('#plugNmeet-app')).toContainText('Participants (4)', { timeout: 30_000 })
    await expect(tutorPage.getByRole('button', { name: 'Generate knowledge check' })).toBeVisible({ timeout: 30_000 })
    await tutorPage.waitForTimeout(2_000)

    // Scene 2 — the tutor genuinely teaches in PlugNmeet's native whiteboard.
    await tutorPage.getByRole('button', { name: 'Show Whiteboard' }).click()
    const whiteboard = tutorPage.locator('#plugNmeet-app canvas.interactive')
    await expect(whiteboard).toBeVisible({ timeout: 15_000 })
    for (const lesson of [
      { text: "Newton's Third Law", x: 180, y: 130 },
      { text: 'Every action has an equal and opposite reaction.', x: 180, y: 210 },
      { text: 'Example: a book pushes the table; the table pushes the book.', x: 180, y: 290 },
    ]) {
      await tutorPage.getByTestId('toolbar-text').click()
      await whiteboard.click({ position: { x: lesson.x, y: lesson.y } })
      await tutorPage.keyboard.type(lesson.text)
      await tutorPage.keyboard.press('Control+Enter')
      await tutorPage.waitForTimeout(900)
    }
    await tutorPage.waitForTimeout(2_500)

    // Scene 3 — the tutor authors and sends a check based on the lesson.
    await Promise.all(studentContexts.map(async ({ page }) => {
      if (!page.url().includes('/class/')) {
        await page.goto(classURL.toString(), { waitUntil: 'domcontentloaded' })
        await enterPlugNmeet(page)
      }
    }))
    await tutorPage.getByRole('button', { name: 'Generate knowledge check' }).click({ force: true })
    await expect(tutorPage.getByText('Generating a question from today’s lesson…')).toBeVisible()
    // Kanvise generates this from the lesson the tutor has just delivered.
    // The tutor only triggers and reviews it; no question text is authored here.
    await expect(tutorPage.getByLabel('Knowledge check question')).toHaveValue("Which situation best demonstrates Newton's Third Law?", { timeout: 10_000 })
    await tutorPage.waitForTimeout(2_000)
    await tutorPage.getByRole('button', { name: 'Send to learners' }).click()
    await expect(tutorPage.getByText("Which situation best demonstrates Newton's Third Law?")).toBeVisible()
    await tutorPage.waitForTimeout(3_000)

    for (const [index, { page, outcome }] of studentContexts.entries()) {
      await tutorPage.waitForTimeout(350)
      await expect(page.getByText("Which situation best demonstrates Newton's Third Law?")).toBeVisible({ timeout: 20_000 })
      if (outcome === 'struggling') {
        // A headed Chromium only paints the foreground window reliably;
        // bring the hero learner forward for the actual learner-facing shot.
        await page.bringToFront()
        await page.waitForTimeout(700)
      }
      const answer = outcome === 'struggling'
        ? 'A car accelerating forward when the driver presses the gas pedal.'
        : 'A block resting on a table experiencing a normal force equal to its weight.'
      await page.getByRole('button', { name: answer }).click()
    }
    await expect(tutorPage.getByText('✗ Incorrect')).toBeVisible({ timeout: 15_000 })
    await expect(tutorPage.getByText('✓ Correct').first()).toBeVisible({ timeout: 15_000 })
    await tutorPage.waitForTimeout(4_000)

    // Scene 4 — the tutor closes the check and returns to the live lesson.
    await tutorPage.getByRole('button', { name: 'Close' }).first().click()
    await tutorPage.waitForTimeout(1_500)

    // Scene 5 — establish the assessment from the tutor's workflow, then let students submit in the background.
    await tutorPage.goto('/dashboard/mocks', { waitUntil: 'domcontentloaded' })
    const todayMock = mobileRecording
      ? tutorPage.getByRole('heading', { name: "Today's Physics Mock" })
      : tutorPage.getByRole('row', { name: /Today's Physics Mock/i })
    await expect(todayMock).toBeVisible({ timeout: 20_000 })
    await tutorPage.waitForTimeout(2_000)

    await Promise.all(studentContexts.map(async ({ page, outcome }) => {
      // Today's Physics Mock is a centre programme assessment (the same
      // workflow the tutor published), not a marketplace entitlement.
      await page.goto('/dashboard/student/mocks', { waitUntil: 'domcontentloaded' })
      if (outcome === 'struggling') await page.bringToFront()
      await page.getByRole('button', { name: /^Available/ }).click()
      const todayStudentMock = page.locator('article', { hasText: "Today's Physics Mock" })
      const instructions = todayStudentMock.getByRole('link', { name: 'View instructions' })
      await expect(instructions).toBeVisible({ timeout: 20_000 })
      await instructions.click()
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
      if (mobileRecording) await page.getByRole('button', { name: 'Review' }).last().evaluate((button: HTMLButtonElement) => button.click())
      else await page.getByRole('button', { name: 'Review' }).last().click()
      await page.getByRole('button', { name: 'Submit final answers' }).click()
      await page.waitForURL(/\/dashboard\/student\/mocks\/result\//, { timeout: 20_000 })
      if (outcome === 'struggling') await page.waitForTimeout(3_000)
    }))

    // Scene 6 and 7 — show automatic scores and the class-level signal before opening Emeka's insight.
    if (mobileRecording) await tutorPage.getByText('View results', { exact: true }).first().click()
    else await todayMock.getByRole('button', { name: /view results/i }).click()
    await expect(tutorPage.getByRole('heading', { name: 'Mock results' })).toBeVisible({ timeout: 20_000 })
    if (mobileRecording) await expect(tutorPage.getByText('Emeka Okafor', { exact: true })).toBeVisible({ timeout: 20_000 })
    else await expect(tutorPage.getByRole('button', { name: /Emeka Okafor Graded/ })).toBeVisible({ timeout: 20_000 })
    await tutorPage.waitForTimeout(3_000)

    // Scene 8 — the hero shot: the cross-signal interpretation stays visible long enough to read.
    await tutorPage.getByRole('button', { name: 'AI Analyze', exact: true }).click()
    await expect(tutorPage.getByRole('heading', { name: 'Emeka Okafor needs attention' })).toBeVisible({ timeout: 15_000 })
    await tutorPage.waitForTimeout(5_000)

    // Scene 9 and ending — record the available follow-up, then leave the class performance visible.
    await tutorPage.getByRole('button', { name: 'Send Support' }).click()
    await expect(tutorPage.getByRole('heading', { name: 'Mock results' })).toBeVisible()
    await tutorPage.waitForTimeout(3_000)
  } finally {
    await Promise.all(studentContexts.map(({ context }) => context.close()))
    for (const studentContext of studentContexts) {
      if (!studentContext.video) continue
      const recordingPath = testInfo.outputPath('emeka-learner-flow.webm')
      await studentContext.video.saveAs(recordingPath)
      await testInfo.attach('emeka-learner-flow', { path: recordingPath, contentType: 'video/webm' })
    }
    await tutorContext.close()
    if (tutorVideo) {
      const recordingPath = testInfo.outputPath('kanvise-pitch-demo.webm')
      await tutorVideo.saveAs(recordingPath)
      await testInfo.attach('kanvise-pitch-demo', { path: recordingPath, contentType: 'video/webm' })
    }
  }
})
