import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const BASE_URL = process.env.E2E_BASE_URL || 'https://staging.kanvise.com'
const API_URL  = process.env.E2E_API_URL  || 'https://staging-api.kanvise.com'
const PASSWORD = 'Password123!'
const CLASS_ID = process.env.E2E_DEMO_CLASS_ID || '5adba341-22d4-443b-aed3-a16f01dc8de2'
const VIEWPORT   = { width: 1920, height: 1080 }
const VIDEO_SIZE = { width: 1920, height: 1080 }

function webEnv(name: string) {
  const src   = readFileSync('web/.env.local', 'utf8')
  const match = src.match(new RegExp(`^${name}=(.+)$`, 'm'))
  if (!match) throw new Error(`Missing ${name} in web/.env.local`)
  return match[1].trim().replace(/^['"]|['"]$/g, '')
}

async function signIn(browser: Browser, email: string) {
  const supabaseUrl = webEnv('NEXT_PUBLIC_SUPABASE_URL')
  const auth = createClient(supabaseUrl, webEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await auth.auth.signInWithPassword({ email, password: PASSWORD })
  if (error || !data.session) throw error ?? new Error(`Could not sign in ${email}`)
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  const value      = `base64-${Buffer.from(JSON.stringify(data.session)).toString('base64url')}`
  const ctx        = await browser.newContext({ baseURL: BASE_URL, viewport: VIEWPORT })
  await ctx.addCookies(
    Array.from({ length: Math.ceil(value.length / 3000) }, (_, i) => ({
      name: `sb-${projectRef}-auth-token.${i}`,
      value: value.slice(i * 3000, (i + 1) * 3000),
      url: BASE_URL,
      sameSite: 'Lax' as const,
    })),
  )
  const state = await ctx.storageState()
  await ctx.close()
  return { state, token: data.session.access_token, userId: data.user.id }
}

async function addCursor(ctx: BrowserContext) {
  await ctx.addInitScript(() => {
    const cursor = document.createElement('span')
    cursor.setAttribute('aria-hidden', 'true')
    cursor.innerHTML =
      '<svg width="26" height="32" viewBox="0 0 28 34" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M2 2L24 18.2L13.1 20.1L8.1 31L2 2Z" fill="white" stroke="#17131B" stroke-width="2.5" stroke-linejoin="round"/></svg>'
    cursor.style.cssText = 'position:fixed;left:-40px;top:-40px;pointer-events:none;z-index:2147483647;filter:drop-shadow(0 2px 2px rgba(0,0,0,.25));transform:translate(-2px,-2px)'
    document.documentElement.appendChild(cursor)
    document.addEventListener('pointermove', e => {
      cursor.style.left = `${e.clientX}px`
      cursor.style.top  = `${e.clientY}px`
    }, true)
  })
}

test('records the full Kanvise story for the landing page', async ({ browser, request }, testInfo) => {
  test.setTimeout(25 * 60_000)
  console.log('[demo] Script starting')

  const tutor = await signIn(browser, 'tutor@demo.com')
  const emeka = await signIn(browser, 'emeka@demo.com')

  const classRes  = await request.get(`${API_URL}/classes/${CLASS_ID}`, { headers: { Authorization: `Bearer ${tutor.token}` } })
  const classBody = await classRes.json()
  if (!classRes.ok()) throw new Error(classBody?.error || 'Could not load demo class')
  const className: string = classBody.data.name
  const physicsSubject = (classBody.data.courses as { id: string; name: string }[]).find(c => c.name.toLowerCase().includes('physics')) ?? classBody.data.courses[0]

  const profileRes  = await request.get(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${tutor.token}` } })
  const profileBody = await profileRes.json()
  const tutorProfileId: string = profileBody.user.id

  const liveClassTitle = "Newton's Third Law · Live demo"
  const existingRes = await request.get(`${API_URL}/live-classes?course_id=${physicsSubject.id}`, { headers: { Authorization: `Bearer ${tutor.token}` } })
  if (existingRes.ok()) {
    const existingBody = await existingRes.json()
    for (const item of existingBody.data || []) {
      if (item.title === liveClassTitle && ['scheduled', 'live'].includes(item.status)) {
        if (item.status === 'scheduled') await request.delete(`${API_URL}/live-classes/${item.id}`, { headers: { Authorization: `Bearer ${tutor.token}` } })
        else await request.post(`${API_URL}/live-classes/${item.id}/end`, { headers: { Authorization: `Bearer ${tutor.token}` } })
      }
    }
  }

  const scheduledAt = new Date(Date.now() + 3 * 60_000).toISOString()
  const scheduleRes = await request.post(`${API_URL}/live-classes`, {
    headers: { Authorization: `Bearer ${tutor.token}`, 'Content-Type': 'application/json' },
    data: { course_id: physicsSubject.id, tutor_id: tutorProfileId, title: liveClassTitle, access_mode: 'enrolled_learners', duration_minutes: 60, scheduled_at: scheduledAt },
  })
  const scheduleBody = await scheduleRes.json()
  const liveClassId: string = scheduleBody.data.id

  console.log('[demo] Polling for classroom worker readiness')
  await expect.poll(async () => {
    const response = await request.get(`${API_URL}/live-classes/${liveClassId}/readiness`, { headers: { Authorization: `Bearer ${tutor.token}` } })
    const body = await response.json().catch(() => null)
    return response.ok() ? body?.data?.state : 'unavailable'
  }, { timeout: 4 * 60_000, intervals: [3_000, 5_000, 10_000] }).toBe('ready')
  console.log('[demo] Worker ready')

  const ctx = await browser.newContext({ baseURL: BASE_URL, storageState: tutor.state, viewport: VIEWPORT, permissions: ['camera', 'microphone'], recordVideo: { dir: testInfo.outputPath('video'), size: VIDEO_SIZE } })
  await addCursor(ctx)
  const page = await ctx.newPage()
  page.setDefaultTimeout(15_000)
  page.setDefaultNavigationTimeout(30_000)
  const video = page.video()!

  const emekaCtx = await browser.newContext({ baseURL: BASE_URL, storageState: emeka.state, viewport: VIEWPORT })
  const emekaPage = await emekaCtx.newPage()
  emekaPage.setDefaultTimeout(15_000)

  try {
    await page.goto(`/dashboard/classes/${CLASS_ID}`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: className })).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(2000)

    for (const tabName of ['schedule', 'assessments', 'materials', 'learners', 'performance']) {
      await page.goto(`/dashboard/classes/${CLASS_ID}?tab=${tabName}`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(1500)
    }

    await page.goto(`/dashboard/classes/${CLASS_ID}?tab=schedule`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(1500)

    await page.goto(`/class/${liveClassId}?start=true`, { waitUntil: 'domcontentloaded' })
    
    const preJoin = page.locator('#startupJoinModal')
    await expect(preJoin).toBeVisible({ timeout: 90_000 })
    const enableBtn = preJoin.getByRole('button', { name: 'Enable Microphone and Camera' })
    if (await enableBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await enableBtn.click({ force: true })
    }
    await preJoin.getByRole('button', { name: 'Join as a listener' }).click({ force: true })
    
    await emekaPage.goto(`/class/${liveClassId}`, { waitUntil: 'domcontentloaded' })
    const emekaPreJoin = emekaPage.locator('#startupJoinModal')
    await expect(emekaPreJoin).toBeVisible({ timeout: 60_000 }).catch(() => null)
    await emekaPreJoin.getByRole('button', { name: 'Join as a listener' }).click({ force: true }).catch(() => null)
    
    await expect(page.locator('#plugNmeet-app')).toContainText(/Participants \([2-9]/, { timeout: 15_000 }).catch(() => null)
    await page.waitForTimeout(1500)

    const whiteboardBtn = page.getByRole('button', { name: 'Show Whiteboard' })
    if (await whiteboardBtn.isVisible().catch(() => false)) {
      await whiteboardBtn.click({ force: true })
      await page.waitForTimeout(2000)
    }

    const checkBtn = page.getByRole('button', { name: 'Suggest a knowledge check' })
    if (await checkBtn.isVisible().catch(() => false)) {
      await checkBtn.click({ force: true })
      await expect(page.getByRole('heading', { name: /Newton/ }).or(page.getByText(/knowledge check/i))).toBeVisible({ timeout: 10_000 }).catch(() => null)
      await page.waitForTimeout(2000)
      const sendBtn = page.getByRole('button', { name: 'Send to students' })
      if (await sendBtn.isVisible().catch(() => false)) await sendBtn.click({ force: true })
      await page.waitForTimeout(2000)
      const closeBtn = page.getByRole('button', { name: 'Close' }).first()
      if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click({ force: true })
    }

    await page.goto(`/dashboard/classes/${CLASS_ID}?tab=assessments`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)

    await page.goto('/dashboard/attendance', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    await emekaPage.bringToFront()
    await emekaPage.goto('/dashboard/student/mocks', { waitUntil: 'domcontentloaded' })
    await emekaPage.waitForTimeout(2000)
    await page.bringToFront()

    await page.goto(`/dashboard/classes/${CLASS_ID}?tab=performance`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    const needsAttention = page.getByText('Needs attention').first()
    if (await needsAttention.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await needsAttention.locator('xpath=ancestor::*[self::button or self::a][1]').click({ force: true }).catch(() => null)
      await page.waitForTimeout(4000)
    }

    await page.goto('/dashboard/payments', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    await page.goto(`/dashboard/classes/${CLASS_ID}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(4000)

  } finally {
    console.log('[demo] Cleaning up')
    await request.post(`${API_URL}/live-classes/${liveClassId}/end`, { headers: { Authorization: `Bearer ${tutor.token}` } }).catch(() => null)
    await emekaCtx.close()
    await ctx.close()
    if (video) {
      const dest = testInfo.outputPath('kanvise-demo.webm')
      await video.saveAs(dest)
      await testInfo.attach('kanvise-demo', { path: dest, contentType: 'video/webm' })
      console.log(`[demo] Video saved to ${dest}`)
    }
  }
})
