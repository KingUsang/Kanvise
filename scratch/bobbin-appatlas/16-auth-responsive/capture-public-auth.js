const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const baseUrl = 'https://app.withbobbin.com';
const root = __dirname;
const screenshotDir = path.join(root, 'screenshots');
const evidenceDir = path.join(root, 'evidence');
const forceStem = process.env.FORCE_STEM || '';
fs.mkdirSync(screenshotDir, { recursive: true });
fs.mkdirSync(evidenceDir, { recursive: true });

const viewports = {
  desktop: { width: 1440, height: 1000 },
  tablet: { width: 834, height: 1112 },
  mobile: { width: 390, height: 844 },
};

const states = [
  { id: 'login--default', route: '/login' },
  { id: 'login--email-changed-notice', route: '/login?notice=email_changed' },
  { id: 'login--email-reset-notice', route: '/login?notice=email_reset' },
  { id: 'login--signup-unavailable', route: '/login?notice=signup_unavailable&redirect_url=%2Fsignup' },
  { id: 'login--invalid-credentials', route: '/login', action: 'invalid-login' },
  { id: 'login--password-visible', route: '/login', action: 'show-password' },
  { id: 'signup--default', route: '/signup' },
  { id: 'signup--referral-warning', route: '/signup?ref=ABCDEFGH', settle: 3000 },
  { id: 'forgot-password--default', route: '/auth/forgot-password' },
  { id: 'forgot-password--client-audience', route: '/auth/forgot-password?audience=client' },
  { id: 'forgot-password--success', route: '/auth/forgot-password', action: 'forgot-success' },
  { id: 'forgot-password--rate-limited', route: '/auth/forgot-password', action: 'forgot-rate-limit' },
  { id: 'set-password--invalid-link', route: '/auth/set-password' },
  { id: 'confirm-signup--invalid-link', route: '/auth/confirm-signup' },
  { id: 'accept-invite--invalid-link', route: '/auth/accept-invite' },
  { id: 'two-factor-reset--invalid-link', route: '/auth/two-factor-reset' },
  { id: 'recording-consent--invalid-link', route: '/recording-consent' },
  { id: 'protected-activate--reauthentication', route: '/activate' },
  { id: 'oauth-authorize--reauthentication', route: '/oauth/authorize' },
  { id: 'confirm-email-change--reauthentication', route: '/auth/confirm-email-change' },
];

function cleanText(value) {
  return value.replace(/\s+/g, ' ').trim();
}

async function collectEvidence(page, state, viewportName) {
  return page.evaluate(({ state, viewportName }) => ({
    capturedAt: new Date().toISOString(),
    state: state.id,
    requestedRoute: state.route,
    viewport: viewportName,
    url: location.href,
    title: document.title,
    headings: [...document.querySelectorAll('h1,h2,h3')].map((node) => node.textContent.trim()),
    bodyText: document.body.innerText.replace(/\s+/g, ' ').trim(),
    controls: [...document.querySelectorAll('input,select,textarea,button,a')].map((node) => ({
      tag: node.tagName.toLowerCase(),
      type: node.getAttribute('type'),
      id: node.id || null,
      text: node.textContent.trim() || null,
      label: node.getAttribute('aria-label'),
      placeholder: node.getAttribute('placeholder'),
      href: node.getAttribute('href'),
      required: node.required || false,
      disabled: node.disabled || false,
    })),
  }), { state, viewportName });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const manifest = [];
  for (const [viewportName, viewport] of Object.entries(viewports)) {
    for (const state of states) {
      const stem = `${viewportName}--${state.id}`;
      const screenshot = path.join(screenshotDir, `${stem}.png`);
      const evidencePath = path.join(evidenceDir, `${stem}.json`);
      if (stem !== forceStem && fs.existsSync(screenshot) && fs.existsSync(evidencePath)) {
        const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
        manifest.push({ viewport: viewportName, ...state, simulatedNetworkOutcome: Boolean(evidence.simulatedNetworkOutcome), screenshot: `screenshots/${stem}.png`, evidence: `evidence/${stem}.json`, finalUrl: evidence.url, title: evidence.title, headings: evidence.headings, summary: cleanText(evidence.bodyText).slice(0, 260) });
        console.log(`${stem}: existing`);
        continue;
      }
      const context = await browser.newContext({ viewport, locale: 'en-GB' });
      const page = await context.newPage();
      const simulated = Boolean(state.action?.startsWith('forgot-') || state.action === 'invalid-login');

      if (state.action === 'invalid-login') {
        await page.route('https://api.withbobbin.com/auth/login', (route) => route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ detail: "That email and password don't match." }),
        }));
      }
      if (state.action === 'forgot-success') {
        await page.route('https://api.withbobbin.com/auth/forgot-password', (route) => route.fulfill({
          status: 204,
          body: '',
        }));
      }
      if (state.action === 'forgot-rate-limit') {
        await page.route('https://api.withbobbin.com/auth/forgot-password', (route) => route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Too many requests.' }),
        }));
      }

      await page.goto(`${baseUrl}${state.route}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(state.settle || 1600);

      if (state.action === 'show-password') {
        await page.locator('#password').fill('Example password');
        await page.getByRole('button', { name: 'Show password' }).click();
      }
      if (state.action === 'invalid-login') {
        await page.locator('#email').fill('atlas.invalid@example.com');
        await page.locator('#password').fill('Incorrect example password');
        await page.getByRole('button', { name: 'Log in', exact: true }).click();
        await page.getByRole('alert').waitFor({ timeout: 8000 });
      }
      if (state.action === 'forgot-success' || state.action === 'forgot-rate-limit') {
        await page.locator('#email').fill('atlas.research@example.com');
        await page.getByRole('button', { name: 'Send reset link' }).click();
        await page.waitForTimeout(500);
      }

      await page.screenshot({ path: screenshot, fullPage: true });
      const evidence = await collectEvidence(page, state, viewportName);
      evidence.simulatedNetworkOutcome = simulated;
      fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
      manifest.push({ viewport: viewportName, ...state, simulatedNetworkOutcome: simulated, screenshot: `screenshots/${stem}.png`, evidence: `evidence/${stem}.json`, finalUrl: evidence.url, title: evidence.title, headings: evidence.headings, summary: cleanText(evidence.bodyText).slice(0, 260) });
      console.log(`${stem}: ${evidence.headings.join(' | ')}`);
      await context.close();
    }
  }
  fs.writeFileSync(path.join(root, 'capture-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await browser.close();
})();
