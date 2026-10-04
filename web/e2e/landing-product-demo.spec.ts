import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const baseURL = process.env.E2E_BASE_URL || 'https://staging.kanvise.com'
const apiURL = process.env.E2E_API_URL || 'https://staging-api.kanvise.com'
const password = 'Password123!'
const classId = process.env.E2E_DEMO_CLASS_ID || '5adba341-22d4-443b-aed3-a16f01dc8de2'
const viewport = { width: 2560, height: 1440 }
const videoSize = { width: 1920, height: 1080 }

type SignedIn = { state: Awaited<ReturnType<BrowserContext['storageState']>>; token: string; userId: string }

function webEnv(name: string) {
  const match = readFileSync('web/.env.local', 'utf8').match(new RegExp(`^${name}=(.+)$`, 'm'))
  if (!match) throw new Error(`Missing ${name} in web/.env.local`)
  return match[1].trim().replace(/^['"]|['"]$/g, '')
}

async function signIn(browser: Browser, email: string): Promise<SignedIn> {
  console.log('[demo] signing in', email)
  const supabaseURL = webEnv('NEXT_PUBLIC_SUPABASE_URL')
  const client = createClient(supabaseURL, webEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.session) throw error ?? new Error(`Could not authenticate ${email}`)
  const context = await browser.newContext({ baseURL, viewport })
  const projectRef = new URL(supabaseURL).hostname.split('.')[0]
  const value = `base64-${Buffer.from(JSON.stringify(data.session)).toString('base64url')}`
  await context.addCookies(Array.from({ length: Math.ceil(value.length / 3000) }, (_, index) => ({
    name: `sb-${projectRef}-auth-token.${index}`,
    value: value.slice(index * 3000, (index + 1) * 3000),
    url: baseURL,
    sameSite: 'Lax' as const,
  })))
  const state = await context.storageState()
  await context.close()
  return { state, token: data.session.access_token, userId: data.user.id }
}

async function recordingAffordances(context: BrowserContext) {
  await context.addInitScript(() => {
    const cursor = document.createElement('span')
    cursor.setAttribute('aria-hidden', 'true')
    cursor.innerHTML = '<svg width="28" height="34" viewBox="0 0 28 34" xmlns="http://www.w3.org/2000/svg"><path d="M2 2L24 18.2L13.1 20.1L8.1 31L2 2Z" fill="white" stroke="#17131B" stroke-width="2.5" stroke-linejoin="round"/></svg>'
    cursor.style.cssText = 'position:fixed;left:-40px;top:-40px;pointer-events:none;z-index:2147483647;filter:drop-shadow(0 2px 2px rgba(0,0,0,.28));transform:translate(-2px,-2px)'
    document.documentElement.appendChild(cursor)
    document.addEventListener('pointermove', event => {
      cursor.style.left = `${event.clientX}px`
      cursor.style.top = `${event.clientY}px`
    }, true)
    document.addEventListener('pointerdown', event => {
      const pulse = document.createElement('span')
      pulse.style.cssText = `position:fixed;left:${event.clientX - 18}px;top:${event.clientY - 18}px;width:36px;height:36px;border:3px solid #c26627;border-radius:9999px;background:rgba(194,102,39,.14);pointer-events:none;z-index:2147483646;animation:demo-click .5s ease-out forwards`
      document.documentElement.appendChild(pulse)
      setTimeout(() => pulse.remove(), 520)
    }, true)
    const style = document.createElement('style')
    style.textContent = '@keyframes demo-click{from{transform:scale(.45);opacity:1}to{transform:scale(1.45);opacity:0}}'
    document.documentElement.appendChild(style)
  })
}

async function joinClassroom(page: Page, devices = false) {
  const preJoin = page.locator('#startupJoinModal')
  await expect(preJoin).toBeVisible({ timeout: 5 * 60_000 })
  if (devices) {
    const enable = preJoin.getByRole('button', { name: 'Enable Microphone and Camera' })
    if (await enable.isVisible().catch(() => false)) await enable.click()
    await page.waitForTimeout(900)
  }
  await preJoin.getByRole('button', { name: 'Join as a listener' }).click()
  await expect(preJoin).toBeHidden({ timeout: 45_000 })
}

test('records the current Kanvise class workspace story', async ({ browser, request }, testInfo) => {
  test.setTimeout(12 * 60_000)
  if (new URL(baseURL).hostname !== 'staging.kanvise.com') throw new Error('The landing demo records only against configured staging')

  const tutor = await signIn(browser, 'tutor@demo.com')
  console.log('[demo] tutor ready')
  const learners = await Promise.all(['ada@demo.com', 'tobi@demo.com', 'emeka@demo.com'].map(email => signIn(browser, email)))
  console.log('[demo] learners ready')
  const headers = { Authorization: `Bearer ${tutor.token}` }
  const profileResponse = await request.get(`${apiURL}/auth/me`, { headers })
  const profileBody = await profileResponse.json()
  if (!profileResponse.ok() || !profileBody.user?.id) throw new Error(profileBody.error || 'Could not load the tutor profile')
  const tutorProfileId = profileBody.user.id as string
  const classResponse = await request.get(`${apiURL}/classes/${classId}`, { headers })
  const classBody = await classResponse.json()
  if (!classResponse.ok()) throw new Error(classBody.error || 'Could not load the demo class workspace')
  const physics = classBody.data.courses.find((course: { name: string }) => course.name === 'Physics') || classBody.data.courses[0]
  if (!physics) throw new Error('The demo class needs a subject')

  const title = `Newton's Third Law · Live lesson`
  const existingResponse = await request.get(`${apiURL}/live-classes?course_id=${encodeURIComponent(physics.id)}`, { headers })
  if (existingResponse.ok()) {
    const existingBody = await existingResponse.json()
    for (const item of existingBody.data || []) {
      if (item.title === title && (item.status === 'scheduled' || item.status === 'live')) {
        if (item.status === 'scheduled') await request.delete(`${apiURL}/live-classes/${item.id}`, { headers })
        else await request.post(`${apiURL}/live-classes/${item.id}/end`, { headers })
      }
    }
  }
  const scheduledAt = new Date(Date.now() + 3 * 60_000).toISOString()
  const scheduleResponse = await request.post(`${apiURL}/live-classes`, {
    headers,
    data: { course_id: physics.id, tutor_id: tutorProfileId, title, scheduled_at: scheduledAt, duration_minutes: 60, access_mode: 'enrolled_learners' },
  })
  const scheduled = await scheduleResponse.json()
  if (!scheduleResponse.ok()) throw new Error(scheduled.error || 'Could not prepare the demo session')
  const sessionId = scheduled.data.id as string
  console.log('[demo] session prepared', sessionId)

  // Wake the real staging classroom worker before any recording context is
  // opened. This is environment preparation, not part of the tutor story.
  await expect.poll(async () => {
    const response = await request.get(`${apiURL}/live-classes/${sessionId}/readiness`, { headers })
    const body = await response.json().catch(() => null)
    return response.ok() ? body?.data?.state : body?.data?.state || 'unavailable'
  }, { timeout: 6 * 60_000, intervals: [5_000, 8_000, 12_000] }).toBe('ready')
  console.log('[demo] classroom worker ready')

  const tutorContext = await browser.newContext({ baseURL, storageState: tutor.state, viewport, permissions: ['camera', 'microphone'], recordVideo: { dir: testInfo.outputPath('tutor'), size: videoSize } })
  await recordingAffordances(tutorContext)
  const tutorPage = await tutorContext.newPage()
  tutorPage.setDefaultTimeout(30_000)
  tutorPage.setDefaultNavigationTimeout(60_000)
  const tutorVideo = tutorPage.video()!
  const learnerContexts = await Promise.all(learners.map(async (learner, index) => {
    const context = await browser.newContext({ baseURL, storageState: learner.state, viewport, recordVideo: index === 2 ? { dir: testInfo.outputPath('student'), size: videoSize } : undefined })
    if (index === 2) await recordingAffordances(context)
    const page = await context.newPage()
    page.setDefaultTimeout(30_000)
    page.setDefaultNavigationTimeout(60_000)
    return { context, page, video: index === 2 ? page.video() : null }
  }))

  try {
    // The story begins inside the redesigned class workspace, not the old dashboard launcher.
    await tutorPage.goto(`/dashboard/classes/${classId}?tab=schedule`, { waitUntil: 'domcontentloaded' })
    console.log('[demo] workspace open')
    await expect(tutorPage.getByRole('heading', { name: classBody.data.name })).toBeVisible({ timeout: 45_000 })
    const start = tutorPage.getByRole('button', { name: `Start ${title}` })
    await expect(start).toBeVisible({ timeout: 45_000 })
    await tutorPage.waitForTimeout(1_800)
    console.log('[demo] starting classroom')
    await start.click({ force: true, noWaitAfter: true })
    console.log('[demo] start clicked')
    await tutorPage.waitForURL(new RegExp(`/class/${sessionId}\\?start=true`), { timeout: 45_000 })
    await joinClassroom(tutorPage, true)
    console.log('[demo] tutor joined classroom')

    for (const [index, learner] of learnerContexts.entries()) {
      const page = learner.page
      await page.goto('/dashboard/student/classes', { waitUntil: 'domcontentloaded' })
      const card = page.locator('article', { hasText: title })
      await expect(card).toBeVisible({ timeout: 45_000 })
      if (index === 2) {
        await page.bringToFront()
        await page.waitForTimeout(1_500)
      }
      await card.getByRole('link', { name: 'Join class' }).click()
      await joinClassroom(page)
      console.log('[demo] learner joined', index + 1)
    }
    await tutorPage.bringToFront()
    await expect(tutorPage.locator('#plugNmeet-app')).toContainText('Participants (4)', { timeout: 45_000 })
    await tutorPage.waitForTimeout(1_500)

    // Teach first. The knowledge check is then suggested from this context.
    await tutorPage.getByRole('button', { name: 'Show Whiteboard' }).click()
    const board = tutorPage.locator('#plugNmeet-app canvas.interactive')
    await expect(board).toBeVisible({ timeout: 20_000 })
    for (const [text, y] of [["Newton's Third Law", 125], ['Every action has an equal and opposite reaction.', 205], ['A rocket pushes gas down. The gas pushes the rocket up.', 285]] as const) {
      await tutorPage.getByTestId('toolbar-text').click()
      await board.click({ position: { x: 175, y } })
      await tutorPage.keyboard.type(text, { delay: 28 })
      await tutorPage.keyboard.press('Control+Enter')
      await tutorPage.waitForTimeout(650)
    }
    await tutorPage.waitForTimeout(2_300)
    await tutorPage.getByRole('button', { name: 'Suggest a knowledge check' }).click()
    await expect(tutorPage.getByText('Creating a question')).toBeVisible()
    await expect(tutorPage.getByRole('heading', { name: "Which example best shows Newton's Third Law?" })).toBeVisible({ timeout: 10_000 })
    await tutorPage.waitForTimeout(2_000)
    await tutorPage.getByRole('button', { name: 'Send to students' }).click()

    const answers = ['A rocket moves upward as it pushes exhaust gases downward.', 'A rocket moves upward as it pushes exhaust gases downward.', 'A stationary book has balanced forces acting on it.']
    for (let index = 0; index < learnerContexts.length; index += 1) {
      const page = learnerContexts[index].page
      await expect(page.getByText("Which example best shows Newton's Third Law?")).toBeVisible({ timeout: 20_000 })
      if (index === 2) {
        await page.bringToFront()
        await page.waitForTimeout(1_200)
      }
      await page.getByRole('button', { name: answers[index] }).click()
      await page.waitForTimeout(450 + index * 250)
    }
    await tutorPage.bringToFront()
    await expect(tutorPage.getByText('✓ Correct').first()).toBeVisible({ timeout: 15_000 })
    await expect(tutorPage.getByText('✗ Incorrect')).toBeVisible()
    await tutorPage.waitForTimeout(3_500)
    await tutorPage.getByRole('button', { name: 'Close' }).click()

    // Return to this same class, where assessment and performance signals live.
    await tutorPage.goto(`/dashboard/classes/${classId}?tab=assessments`, { waitUntil: 'domcontentloaded' })
    await expect(tutorPage.getByRole('heading', { name: 'Assessments' })).toBeVisible({ timeout: 45_000 })
    await tutorPage.waitForTimeout(2_500)
    await tutorPage.getByRole('link', { name: 'Performance' }).click()
    await expect(tutorPage.getByText('Needs attention', { exact: true }).first()).toBeVisible({ timeout: 45_000 })
    const emeka = tutorPage.getByText(/Emeka/i).first()
    await expect(emeka).toBeVisible()
    await emeka.click()
    await expect(tutorPage.getByText(/Suggested tutor action/i)).toBeVisible({ timeout: 30_000 })
    await tutorPage.waitForTimeout(5_000)
  } finally {
    await request.post(`${apiURL}/live-classes/${sessionId}/end`, { headers }).catch(() => null)
    await Promise.all(learnerContexts.map(item => item.context.close()))
    await tutorContext.close()
    const tutorPath = testInfo.outputPath('kanvise-current-product-demo.webm')
    await tutorVideo.saveAs(tutorPath)
    await testInfo.attach('kanvise-current-product-demo', { path: tutorPath, contentType: 'video/webm' })
  }
})
