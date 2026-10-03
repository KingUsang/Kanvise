import { expect, test, type Page } from '@playwright/test'

const tutorEmail = process.env.E2E_INDEPENDENT_TUTOR_EMAIL
const tutorPassword = process.env.E2E_INDEPENDENT_TUTOR_PASSWORD
const studentEmail = process.env.E2E_INDEPENDENT_STUDENT_EMAIL
const baseURL = process.env.E2E_BASE_URL
const runId = `e2e-${Date.now().toString(36)}`
const className = `Physics coaching ${runId}`
const sessionTitle = `Vectors revision ${runId}`
let classUrl = ''

function localDate(value = new Date()) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function futureLocalDateTime() {
  const value = new Date(Date.now() + 3 * 60 * 60 * 1000)
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  const hours = String(value.getHours()).padStart(2, '0')
  const minutes = String(value.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function requireTestAccount() {
  if (!baseURL) throw new Error('E2E_BASE_URL is required')
  if (!tutorEmail || !tutorPassword) {
    throw new Error('Set E2E_INDEPENDENT_TUTOR_EMAIL and E2E_INDEPENDENT_TUTOR_PASSWORD to a disposable independent-tutor account')
  }
  if (new URL(baseURL).hostname === 'kanvise.com') {
    throw new Error('Independent-tutor journeys create real records. Run them against localhost or staging, never production.')
  }
}

async function signIn(page: Page) {
  requireTestAccount()
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('input[type="email"]')).toBeVisible()
  // Login is a hydrated client form. Waiting for the form to be usable avoids
  // the browser's native fallback submission on a slow development machine.
  await expect(page.locator('form button[type="submit"]')).toBeEnabled()
  await page.locator('input[type="email"]').fill(tutorEmail!)
  await page.locator('input[type="password"]').fill(tutorPassword!)
  await page.locator('form button[type="submit"]').click()
  await page.waitForURL(/\/dashboard(?:\/|$)/, { timeout: 30_000 })
  await expect(page.getByRole('link', { name: 'Classes', exact: true })).toBeVisible({ timeout: 30_000 })
}

test.describe.serial('independent tutor journeys', () => {
  test.setTimeout(120_000)

  test('shows independent-tutor navigation and removes centre-only tutor assignment', async ({ page }) => {
    await signIn(page)

    await expect(page.getByRole('link', { name: 'Classes', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Calendar', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Timetable', exact: true })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Tutors', exact: true })).toHaveCount(0)

    await page.getByRole('link', { name: 'Classes', exact: true }).click()
    await page.getByRole('link', { name: 'Create class', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Set up the teaching space' })).toBeVisible()
    await expect(page.getByText('Assigned tutor', { exact: false })).toHaveCount(0)
  })

  test('creates a one-student class through the real class workspace', async ({ page }) => {
    await signIn(page)
    await page.goto('/dashboard/classes/new', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Set up the teaching space' })).toBeVisible()

    await page.getByLabel('Class name').fill(className)
    await page.getByRole('button', { name: 'One student', exact: true }).click()
    await page.getByRole('button', { name: 'One subject', exact: true }).click()
    await page.getByLabel(/^Subject/).fill('Physics')
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()

    await page.waitForURL(/\/dashboard\/classes\/[^?]+\?tab=learners&add_student=true/, { timeout: 30_000 })
    classUrl = page.url().replace(/\?tab=learners&add_student=true$/, '')
    await expect(page.getByRole('dialog', { name: 'Add student' })).toBeVisible()
    await expect(page.getByText('Assigned tutor', { exact: false })).toHaveCount(0)

    // Adding a learner sends a real invite, so it is opt-in and requires a
    // mailbox owned by the test environment. The class creation itself is
    // still exercised for every configured independent tutor.
    if (studentEmail) {
      await page.getByLabel('First name').fill('Journey')
      await page.getByLabel('Last name').fill('Student')
      await page.getByLabel('Email address').fill(studentEmail)
      await page.getByRole('button', { name: 'Send invitation', exact: true }).click()
      await expect(page.getByText('Student added and invitation sent')).toBeVisible()
    }
  })

  test('schedules a class without a tutor selector and keeps the session in the workspace', async ({ page }) => {
    test.skip(!classUrl, 'The class-creation journey did not complete')
    await signIn(page)
    await page.goto(`${classUrl}?tab=schedule`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('link', { name: 'Schedule', exact: true })).toHaveAttribute('aria-current', 'page')

    await page.getByRole('button', { name: 'Schedule live class', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Schedule a class' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Tutor', { exact: true })).toHaveCount(0)
    await dialog.getByLabel('Class title').fill(sessionTitle)
    await dialog.getByLabel('Date').fill(localDate())
    await dialog.getByLabel('Time').fill('16:30')
    await dialog.getByRole('button', { name: 'Schedule class', exact: true }).click()

    await expect(page.getByText(sessionTitle, { exact: true })).toBeVisible({ timeout: 30_000 })
    await page.getByRole('link', { name: 'Calendar', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Calendar', exact: true })).toBeVisible()
    await expect(page.getByText(sessionTitle, { exact: true })).toBeVisible({ timeout: 30_000 })
  })

  test('opens a class-bound quiz creator instead of sending the tutor to global mocks', async ({ page }) => {
    test.skip(!classUrl, 'The class-creation journey did not complete')
    await signIn(page)
    await page.goto(`${classUrl}?tab=assessments`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Assessments', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Create assessment', exact: true }).click()
    const picker = page.getByRole('dialog', { name: 'What are you creating?' })
    await expect(picker).toBeVisible()
    await picker.getByRole('button', { name: /Quiz.*Add questions or import/i }).click()

    await expect(page).toHaveURL(new RegExp(`/dashboard/classes/[^?]+\\?tab=assessments&create=quiz&class_id=`))
    await expect(page.getByRole('heading', { name: 'Create quiz', exact: true })).toBeVisible()
    await expect(page.getByText(`This quiz is only for students in ${className}.`)).toBeVisible()
    await expect(page).not.toHaveURL(/\/dashboard\/mocks(?:\/|$)/)
  })

  test('creates a published class assignment without leaving the workspace', async ({ page }) => {
    test.skip(!classUrl, 'The class-creation journey did not complete')
    await signIn(page)
    await page.goto(`${classUrl}?tab=assessments`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Create assessment', exact: true }).click()
    const picker = page.getByRole('dialog', { name: 'What are you creating?' })
    await picker.getByRole('button', { name: /Assignment.*Give students instructions/i }).click()

    await expect(page).toHaveURL(new RegExp(`/dashboard/classes/[^?]+\\?tab=assessments&create=assignment&class_id=`))
    await expect(page.getByRole('heading', { name: 'Create assignment', exact: true })).toBeVisible()
    await expect(page.getByText(`This assignment is only for students in ${className}.`)).toBeVisible()
    await page.locator('#course-select').selectOption({ label: 'Physics' })
    await page.getByLabel('Assignment Title').fill(`Vector practice ${runId}`)
    await page.getByLabel('Assignment Question(s)').fill('Resolve each vector into horizontal and vertical components, showing your working.')
    await page.getByLabel('Submission Deadline').fill(futureLocalDateTime())
    await page.getByRole('button', { name: 'Publish Assignment', exact: true }).click()

    await page.waitForURL(new RegExp(`/dashboard/classes/[^?]+\\?tab=assessments$`), { timeout: 30_000 })
    await expect(page.getByText(`Vector practice ${runId}`, { exact: true })).toBeVisible({ timeout: 30_000 })
    await expect(page).not.toHaveURL(/\/dashboard\/assignments(?:\/|$)/)
  })

  test('shows the one student’s own evidence instead of class aggregates', async ({ page }) => {
    test.skip(!classUrl || !studentEmail, 'A controlled student mailbox is required for this real student-evidence journey')
    await signIn(page)
    await page.goto(`${classUrl}?tab=performance`, { waitUntil: 'domcontentloaded' })

    await expect(page.getByText('Student performance', { exact: true })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Class health', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Topic mastery', { exact: true })).toBeVisible()
    await expect(page.getByText('Assessments', { exact: true })).toBeVisible()
  })
})
