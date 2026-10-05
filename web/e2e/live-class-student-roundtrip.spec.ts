import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'

const tutor = {
  email: process.env.E2E_LIVE_TUTOR_EMAIL,
  password: process.env.E2E_LIVE_TUTOR_PASSWORD,
}
const student = {
  email: process.env.E2E_LIVE_STUDENT_EMAIL,
  password: process.env.E2E_LIVE_STUDENT_PASSWORD,
}
const baseURL = process.env.E2E_BASE_URL
const title = `Live Physics check ${Date.now().toString(36)}`

function requireFixture() {
  if (!baseURL) throw new Error('E2E_BASE_URL is required')
  if (!tutor.email || !tutor.password || !student.email || !student.password) {
    throw new Error('Set E2E_LIVE_TUTOR_EMAIL, E2E_LIVE_TUTOR_PASSWORD, E2E_LIVE_STUDENT_EMAIL and E2E_LIVE_STUDENT_PASSWORD')
  }
  if (new URL(baseURL).hostname === 'kanvise.com') {
    throw new Error('This journey starts and ends a real class. Run only on localhost or staging.')
  }
}

function apiBase() {
  if (!baseURL) throw new Error('E2E_BASE_URL is required')
  // Remote browser runs must never inherit a developer's localhost API URL.
  // Staging has its own API origin even though local web/.env.local is used
  // for the Supabase test fixture configuration.
  return new URL(baseURL).hostname === 'staging.kanvise.com'
    ? 'https://staging-api.kanvise.com'
    : 'http://127.0.0.1:3001'
}

async function signedInContext(browser: Browser, credentials: { email?: string; password?: string }): Promise<BrowserContext> {
  const login = await browser.newContext({ baseURL })
  const page = await login.newPage()
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('form button[type="submit"]')).toBeEnabled()
  await page.locator('input[type="email"]').fill(credentials.email!)
  await page.locator('input[type="password"]').fill(credentials.password!)
  await page.locator('form button[type="submit"]').click()
  await page.waitForURL(/\/dashboard(?:\/|$)/, { timeout: 30_000 })
  const state = await login.storageState()
  await login.close()
  return browser.newContext({ baseURL, storageState: state, permissions: ['camera', 'microphone'] })
}

async function joinPlugNmeet(page: Page) {
  const preJoin = page.locator('#startupJoinModal')
  await expect(preJoin).toBeVisible({ timeout: 60_000 })
  const enableDevices = preJoin.getByRole('button', { name: 'Enable Microphone and Camera' })
  if (await enableDevices.isVisible().catch(() => false)) await enableDevices.click()
  await preJoin.getByRole('button', { name: 'Join as a listener' }).click()
  await expect(preJoin).toBeHidden({ timeout: 45_000 })
}

async function browserAccessToken(page: Page) {
  const token = await page.evaluate(() => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (!key?.includes('auth-token')) continue
      try {
        const stored = JSON.parse(localStorage.getItem(key) || '{}')
        if (typeof stored.access_token === 'string') return stored.access_token
      } catch { /* try the next storage key */ }
    }
    return null
  })
  if (!token) throw new Error('Could not read the authenticated browser session')
  return token
}

test('an enrolled student sees, joins and is recorded for a tutor live class', async ({ browser, request }) => {
  test.setTimeout(4 * 60_000)
  requireFixture()
  const tutorContext = await signedInContext(browser, tutor)
  const studentContext = await signedInContext(browser, student)
  let classId: string | null = null
  let classEnded = false
  let token: string | null = null

  try {
    const tutorPage = await tutorContext.newPage()
    await tutorPage.goto('/dashboard/schedule?new=1', { waitUntil: 'domcontentloaded' })
    const composer = tutorPage.locator('form', { has: tutorPage.getByRole('heading', { name: 'New class' }) })
    await expect(composer).toBeVisible({ timeout: 45_000 })
    await composer.getByRole('button', { name: 'Enrolled learners', exact: true }).click()
    const classSelect = composer.getByLabel('Class')
    await expect(classSelect).toBeVisible()
    const classOptions = await classSelect.locator('option').evaluateAll((options) =>
      options.map((option) => ({ value: option.getAttribute('value') || '', label: option.textContent || '' })),
    )
    const physicsClass = classOptions.find((option) => option.label.toLowerCase().includes('physics')) || classOptions.find((option) => option.value)
    expect(physicsClass, 'The tutor needs an enrolled teaching class for this fixture').toBeTruthy()
    await classSelect.selectOption(physicsClass!.value)
    if (await composer.getByLabel('Subject').isVisible().catch(() => false)) {
      const subjectSelect = composer.getByLabel('Subject')
      const subjectOptions = await subjectSelect.locator('option').evaluateAll((options) =>
        options.map((option) => ({ value: option.getAttribute('value') || '', label: option.textContent || '' })),
      )
      const physics = subjectOptions.find((option) => option.label.toLowerCase() === 'physics') || subjectOptions.find((option) => option.value)
      expect(physics, 'The selected teaching class needs a subject').toBeTruthy()
      await subjectSelect.selectOption(physics!.value)
    }
    const scheduled = new Date(Date.now() + 5 * 60_000)
    const localDate = `${scheduled.getFullYear()}-${String(scheduled.getMonth() + 1).padStart(2, '0')}-${String(scheduled.getDate()).padStart(2, '0')}`
    const localTime = `${String(scheduled.getHours()).padStart(2, '0')}:${String(scheduled.getMinutes()).padStart(2, '0')}`
    await composer.getByLabel('Class title').fill(title)
    await composer.getByLabel('Date').fill(localDate)
    await composer.getByLabel('Time').fill(localTime)
    await composer.getByRole('button', { name: 'Schedule class', exact: true }).click()
    const scheduledClass = tutorPage.getByRole('button', { name: new RegExp(title) })
    await expect(scheduledClass).toBeVisible({ timeout: 45_000 })
    await scheduledClass.click()
    const sessionDetails = tutorPage.locator('form', { has: tutorPage.getByRole('heading', { name: 'Edit class' }) })
    await expect(sessionDetails).toBeVisible()
    await sessionDetails.getByRole('button', { name: 'Join as host', exact: true }).click()
    await tutorPage.waitForURL(/\/class\/[^?]+\?start=true/, { timeout: 60_000 })
    classId = new URL(tutorPage.url()).pathname.split('/').pop() || null
    expect(classId).toBeTruthy()
    token = await browserAccessToken(tutorPage)
    await joinPlugNmeet(tutorPage)

    const studentPage = await studentContext.newPage()
    await studentPage.goto('/dashboard/student/classes', { waitUntil: 'domcontentloaded' })
    const studentClass = studentPage.locator('article', { hasText: title })
    await expect(studentClass).toBeVisible({ timeout: 45_000 })
    await expect(studentClass.getByRole('link', { name: 'Join class', exact: true })).toBeVisible()
    await studentClass.getByRole('link', { name: 'Join class', exact: true }).click()
    await expect(studentPage).toHaveURL(new RegExp(`/class/${classId}$`), { timeout: 30_000 })
    await joinPlugNmeet(studentPage)

    await expect(tutorPage.locator('#plugNmeet-app')).toContainText('Participants (2)', { timeout: 45_000 })

    // End the short-lived room through the real tutor endpoint. The provider
    // emits the leave event and Kanvise persists the student's attendance.
    const endResponse = await request.post(`${apiBase()}/live-classes/${classId}/end`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(endResponse.ok()).toBeTruthy()
    classEnded = true

    // This is a direct read of the real backend after the actual provider join,
    // not a mocked browser response. Attendance records become visible only
    // after the session ends, which is how the tutor attendance view works.
    await expect.poll(async () => {
      const response = await request.get(`${apiBase()}/attendance/records?class_id=${classId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await response.json().catch(() => null)
      return body?.data?.find((item: { status: string }) => item.status === 'Present')?.status || null
    }, { timeout: 60_000, intervals: [2_000, 3_000, 5_000] }).toBe('Present')
  } finally {
    if (classId && !classEnded && token) {
      await request.post(`${apiBase()}/live-classes/${classId}/end`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    }
    await Promise.all([tutorContext.close(), studentContext.close()])
  }
})
