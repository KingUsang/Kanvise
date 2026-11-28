const { chromium } = require('playwright');

const routes = [
  '/login',
  '/signup',
  '/auth/forgot-password',
  '/auth/set-password',
  '/auth/confirm-signup',
  '/auth/accept-invite',
  '/auth/confirm-email-change',
  '/auth/two-factor-reset',
  '/activate',
  '/oauth/authorize',
  '/recording-consent',
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  for (const route of routes) {
    const response = await page.goto(`https://app.withbobbin.com${route}`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null);
    await page.waitForTimeout(1800);
    const details = await page.evaluate(() => ({
      title: document.title,
      heading: document.querySelector('h1,h2')?.textContent?.trim() || '',
      text: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 500),
      links: [...document.querySelectorAll('a')].map((node) => ({ text: node.textContent.trim(), href: node.getAttribute('href') })).filter((item) => item.text || item.href),
      forms: [...document.forms].map((form) => ({
        fields: [...form.elements].map((node) => ({ tag: node.tagName, type: node.type, name: node.name, id: node.id, placeholder: node.placeholder })).filter((item) => item.tag !== 'BUTTON'),
        buttons: [...form.querySelectorAll('button')].map((node) => node.textContent.trim()),
      })),
    }));
    console.log(JSON.stringify({ route, status: response?.status() || null, finalUrl: page.url(), ...details }));
  }
  await browser.close();
})();
