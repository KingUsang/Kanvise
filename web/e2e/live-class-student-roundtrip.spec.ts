import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

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

function webEnv(name: string) {
  const match = readFileSync('web/.env.local', 'utf8').match(new RegExp(`^${name}=(.+)$`, 'm'))
  if (!match) throw new Error(`Missing ${name} in web/.env.local`)
  return match[1].trim().replace(/^['"]|['"]$/g, '')
}

function requireFixture() {
  if (!baseURL) throw new Error('E2E_BASE_URL is required')
  if (!tutor.email || !tutor.password || !student.email || !student.password) {
    throw new Error('Set E2E_LIVE_TUTOR_EMAIL, E2E_LIVE_TUTOR_PASSWORD, E2E_LIVE_STUDENT_EMAIL and E2E_LIVE_STUDENT_PASSWORD')
  }
  if (new URL(baseURL).hostname === 'kanvise.com') {
    throw new Error('This journey starts and ends a real class. Run only on localhost or staging.')
  }
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

async function apiToken(credentials: { email?: string; password?: string }) {
  const auth = createClient(webEnv('NEXT_PUBLIC_SUPABASE_URL'), webEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await auth.auth.signInWithPassword({ email: credentials.email!, password: credentials.password! })
  if (error || !data.session) throw error || new Error('Could not authenticate test fixture')
  return data.session.access_token
}

test('an enrolled student sees, joins and is recorded for a tutor live class', async ({ browser, request }) => {
  test.setTimeout(4 * 60_000)
  requireFixture()
  const tutorContext = await signedInContext(browser, tutor)
  const studentContext = await signedInContext(browser, student)
  let classId: string | null = null
  let classEnded = false

  try {
    const tutorPage = await tutorContext.newPage()
    await tutorPage.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    await tutorPage.getByRole('button', { name: 'Start live class', exact: true }).click()
    const launcher = tutorPage.getByRole('dialog', { name: 'Start a live class' })
    await expect(launcher).toBeVisible()
    await launcher.getByRole('button', { name: 'Enrolled learners', exact: true }).click()
    await launcher.getByLabel('Class title').fill(title)
    await launcher.getByLabel('Subject').selectOption({ label: 'Physics' })
    await launcher.getByRole('button', { name: /Start class now/ }).click()
    await tutorPage.waitForURL(/\/class\/[^?]+\?start=true/, { timeout: 60_000 })
    classId = new URL(tutorPage.url()).pathname.split('/').pop() || null
    expect(classId).toBeTruthy()
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
    const token = await apiToken(tutor)
    const endResponse = await request.post(`${webEnv('NEXT_PUBLIC_API_URL')}/live-classes/${classId}/end`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(endResponse.ok()).toBeTruthy()
    classEnded = true

    // This is a direct read of the real backend after the actual provider join,
    // not a mocked browser response. Attendance records become visible only
    // after the session ends, which is how the tutor attendance view works.
    await expect.poll(async () => {
      const response = await request.get(`${webEnv('NEXT_PUBLIC_API_URL')}/attendance/records?class_id=${classId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await response.json().catch(() => null)
      return body?.data?.find((item: { student_name: string; status: string }) => item.student_name.includes('Emeka'))?.status || null
    }, { timeout: 60_000, intervals: [2_000, 3_000, 5_000] }).toBe('Present')
  } finally {
    if (classId && !classEnded) {
      const token = await apiToken(tutor)
      await request.post(`${webEnv('NEXT_PUBLIC_API_URL')}/live-classes/${classId}/end`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    }
    await Promise.all([tutorContext.close(), studentContext.close()])
  }
})
