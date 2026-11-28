const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { chromium } = require('playwright');
const root = __dirname;
const screenshots = path.join(root, 'screenshots');
const evidence = path.join(root, 'evidence');

function credentialsFromStdin() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
  return new Promise((resolve) => { const values = []; const ask = () => rl.question(values.length ? 'Password: ' : 'Email: ', (v) => { values.push(v); if (values.length === 2) { rl.close(); resolve({ email: values[0], password: values[1] }); } else ask(); }); ask(); });
}
async function snap(page, stem) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(screenshots, `${stem}.png`), fullPage: true });
  const data = await page.evaluate(() => ({
    capturedAt: new Date().toISOString(), url: location.href, title: document.title,
    headings: [...document.querySelectorAll('h1,h2,h3')].map((n) => n.textContent.trim()).filter(Boolean),
    bodyText: document.body.innerText.replace(/\s+/g, ' ').trim(),
    controls: [...document.querySelectorAll('a,button,input,select,textarea,[role="button"],[role="tab"],[role="menuitem"]')].map((n) => ({ tag:n.tagName.toLowerCase(), text:(n.textContent||'').trim()||null, label:n.getAttribute('aria-label'), title:n.getAttribute('title'), href:n.getAttribute('href'), role:n.getAttribute('role'), type:n.getAttribute('type'), name:n.getAttribute('name'), placeholder:n.getAttribute('placeholder'), disabled:n.disabled||false, visible:!!(n.offsetWidth||n.offsetHeight||n.getClientRects().length) })),
  }));
  fs.writeFileSync(path.join(evidence, `${stem}.json`), `${JSON.stringify(data, null, 2)}\n`);
  return data;
}
(async () => {
  const credentials = await credentialsFromStdin();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'en-GB' });
  const page = await context.newPage();
  await page.goto('https://app.withbobbin.com/login', { waitUntil:'domcontentloaded' });
  await page.locator('#email').fill(credentials.email); await page.locator('#password').fill(credentials.password);
  credentials.email=''; credentials.password=''; await page.getByRole('button',{name:'Log in',exact:true}).click();
  await page.waitForURL((url)=>url.pathname!=='/login',{timeout:20000});

  await page.goto('https://app.withbobbin.com/courses/9581',{waitUntil:'domcontentloaded'}); await page.waitForTimeout(1800);
  await page.getByRole('link',{name:/Atlas Research Tutor/}).click(); await page.waitForURL(/\/tutors\/24857/); await page.waitForTimeout(1200); await snap(page,'course-roster--tutor-detail');
  await page.goto('https://app.withbobbin.com/courses/9581',{waitUntil:'domcontentloaded'}); await page.waitForTimeout(1200);
  await page.getByRole('link',{name:/Atlas Research Student/}).click(); await page.waitForURL(/\/students\/24854/); await page.waitForTimeout(1200); await snap(page,'course-roster--student-detail');
  await page.goto('https://app.withbobbin.com/courses/9581',{waitUntil:'domcontentloaded'}); await page.waitForTimeout(1200);
  await page.getByRole('button',{name:'Describe your own',exact:true}).click(); await page.waitForTimeout(700); const form = await snap(page,'ai-course-plan--describe-form');
  console.log(JSON.stringify({ tutorRoute:'/tutors/24857', studentRoute:'/students/24854', aiFormControls:form.controls.filter((c)=>c.visible).filter((c)=>['input','textarea','select','button'].includes(c.tag)) }));
  await browser.close();
})().catch((error)=>{ console.error(error.stack||error.message); process.exitCode=1; });
