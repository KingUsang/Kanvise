const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { chromium } = require('playwright');

const baseUrl = 'https://app.withbobbin.com';
const root = __dirname;
const screenshotDir = path.join(root, 'screenshots');
const evidenceDir = path.join(root, 'evidence');
const viewports = {
  desktop: { width: 1440, height: 1000 },
  tablet: { width: 834, height: 1112 },
  mobile: { width: 390, height: 844 },
};
const setupStates = [
  { id: 'setup--checklist', action: null },
  { id: 'setup--client-form', action: 'Add client' },
  { id: 'setup--tutor-form', action: 'Add tutor' },
  { id: 'setup--student-form', action: 'Add student' },
  { id: 'setup--course-form', action: 'Create course' },
  { id: 'setup--lesson-form', action: 'Schedule lesson' },
];

function readCredentials() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
  return new Promise((resolve) => {
    const values = [];
    const ask = () => rl.question(values.length ? 'Password: ' : 'Email: ', (answer) => {
      values.push(answer);
      if (values.length === 2) { rl.close(); resolve({ email: values[0], password: values[1] }); }
      else ask();
    });
    ask();
  });
}

async function evidence(page, state, viewport) {
  return page.evaluate(({ state, viewport }) => ({
    capturedAt: new Date().toISOString(), state, requestedRoute: '/setup', viewport,
    url: location.href, title: document.title,
    headings: [...document.querySelectorAll('h1,h2,h3')].map((node) => node.textContent.trim()),
    bodyText: document.body.innerText.replace(/\s+/g, ' ').trim(),
    controls: [...document.querySelectorAll('input,select,textarea,button,a')].map((node) => ({
      tag: node.tagName.toLowerCase(), type: node.getAttribute('type'), id: node.id || null,
      text: node.textContent.trim() || null, label: node.getAttribute('aria-label'),
      placeholder: node.getAttribute('placeholder'), href: node.getAttribute('href'),
      required: node.required || false, disabled: node.disabled || false,
    })),
  }), { state, viewport });
}

(async () => {
  const credentials = await readCredentials();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: viewports.desktop, locale: 'en-GB' });
  const login = await context.newPage();
  await login.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await login.locator('#email').fill(credentials.email);
  await login.locator('#password').fill(credentials.password);
  credentials.email = '';
  credentials.password = '';
  await login.getByRole('button', { name: 'Log in', exact: true }).click();
  await login.waitForURL((url) => url.pathname !== '/login', { timeout: 20000 });

  await context.route('https://api.withbobbin.com/auth/me/', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const organizations = (body.organizations || []).map((organization) => (
      organization.id === body.active_organization_id ? { ...organization, setup_complete: false } : organization
    ));
    await route.fulfill({ response, json: { ...body, active_role: 'administrator', onboarding_complete: true, organizations } });
  });
  await context.route('https://api.withbobbin.com/auth/me/setup-state', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ clients: false, tutors: false, students: false, courses: false, lessons: false, steps: ['clients', 'tutors', 'students', 'courses', 'lessons'] }),
  }));

  const manifest = [];
  for (const [viewportName, viewport] of Object.entries(viewports)) {
    for (const state of setupStates) {
      const page = await context.newPage();
      await page.setViewportSize(viewport);
      await page.goto(`${baseUrl}/setup`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.getByText('Let’s create your first lesson').waitFor({ timeout: 15000 });
      if (state.action) {
        await page.getByRole('button', { name: state.action, exact: true }).click();
        await page.locator('[role=dialog]').waitFor({ timeout: 8000 });
        await page.waitForTimeout(400);
      }
      const stem = `${viewportName}--${state.id}`;
      const shot = `screenshots/${stem}.png`;
      const evidenceFile = `evidence/${stem}.json`;
      await page.screenshot({ path: path.join(root, shot), fullPage: true });
      const details = await evidence(page, state.id, viewportName);
      details.simulatedSetupReadModel = true;
      fs.writeFileSync(path.join(root, evidenceFile), `${JSON.stringify(details, null, 2)}\n`);
      manifest.push({ viewport: viewportName, ...state, screenshot: shot, evidence: evidenceFile, finalUrl: details.url, title: details.title, headings: details.headings, summary: details.bodyText.slice(0, 260), simulatedSetupReadModel: true });
      console.log(`${stem}: ${details.headings.join(' | ')}`);
      await page.close();
    }
  }
  fs.writeFileSync(path.join(root, 'setup-capture-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await login.close();
  await context.close();
  await browser.close();
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
