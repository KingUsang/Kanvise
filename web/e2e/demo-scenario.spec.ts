import { test, expect } from '@playwright/test';

test.use({ 
  actionTimeout: 10000,
  viewport: { width: 1920, height: 1080 }
});

test('Kanvise AI Demo Video Recording', async ({ browser }) => {
  const tutorSetupContext = await browser.newContext();
  const tutorSetupPage = await tutorSetupContext.newPage();
  
  await tutorSetupPage.goto('http://localhost:3000/login');
  await tutorSetupPage.fill('input[type="email"]', 'tutor@demo.com');
  await tutorSetupPage.fill('input[type="password"]', 'Password123!');
  await tutorSetupPage.click('button[type="submit"]');
  await tutorSetupPage.waitForURL('**/dashboard');
  await tutorSetupContext.storageState({ path: 'tutor-state.json' });
  await tutorSetupContext.close();

  const students = [
    { email: 'ada@demo.com', role: 'Strong', ansKC: 'A block resting on a table experiencing a normal force equal to its weight.' },
    { email: 'tobi@demo.com', role: 'Average', ansKC: 'A block resting on a table experiencing a normal force equal to its weight.' },
    { email: 'david@demo.com', role: 'Improving', ansKC: 'A block resting on a table experiencing a normal force equal to its weight.' },
    { email: 'favour@demo.com', role: 'Inconsistent', ansKC: 'A rocket propelling upward by expelling exhaust gases downward.' },
    { email: 'emeka@demo.com', role: 'Struggling', ansKC: 'A car accelerating forward when the driver presses the gas pedal.' }
  ];
  
  const studentStates = [];
  for (const s of students) {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto('http://localhost:3000/login');
    await p.fill('input[type="email"]', s.email);
    await p.fill('input[type="password"]', 'Password123!');
    await p.click('button[type="submit"]');
    await p.waitForURL('**/dashboard');
    const path = `${s.email.split('@')[0]}-state.json`;
    await ctx.storageState({ path });
    await ctx.close();
    studentStates.push({ ...s, statePath: path });
  }

  // ==========================================
  // BEGIN RECORDING CONTEXT
  // ==========================================
  const tutorContext = await browser.newContext({
    storageState: 'tutor-state.json',
    recordVideo: { dir: 'videos/', size: { width: 1920, height: 1080 } }
  });
  const tutorPage = await tutorContext.newPage();
  
  const studentContexts = await Promise.all(studentStates.map(async (s) => {
      const ctx = await browser.newContext({ storageState: s.statePath });
      const p = await ctx.newPage();
      return { ...s, page: p };
  }));

  // ━━━━━━━━━━━━━━━━━━━━
  // SCENE 1 — ENTER THE CLASS
  // ━━━━━━━━━━━━━━━━━━━━
  await tutorPage.goto('http://localhost:3000/dashboard');
  
  // Navigate naturally into the live classroom
  await tutorPage.click('text="Newton\'s Laws of Motion"');
  await tutorPage.click('text="Start"'); // Join class
  
  // Students join
  for (const s of studentContexts) {
      await s.page.goto('http://localhost:3000/dashboard');
      await s.page.click('text="Newton\'s Laws of Motion"');
      await s.page.click('text="Join"');
  }

  await tutorPage.waitForSelector('text="Generate Knowledge Check"', { timeout: 15000 });
  await tutorPage.waitForTimeout(2000);

  // ━━━━━━━━━━━━━━━━━━━━
  // SCENE 2 — LIVE TEACHING
  // ━━━━━━━━━━━━━━━━━━━━
  await tutorPage.waitForTimeout(3000);

  // ━━━━━━━━━━━━━━━━━━━━
  // SCENE 3 — AI KNOWLEDGE CHECK
  // ━━━━━━━━━━━━━━━━━━━━
  await tutorPage.click('text="Generate Knowledge Check"');
  
  // Pause for viewer to read
  await tutorPage.waitForTimeout(3000);
  
  // Students submit different responses
  for (const s of studentContexts) {
      await s.page.waitForSelector('text="Which situation best demonstrates Newton\'s Third Law?"');
      await s.page.click(`text="${s.ansKC}"`);
  }

  await expect(tutorPage.locator('text="✗ Incorrect"').first()).toBeVisible();
  await expect(tutorPage.locator('text="✓ Correct"').first()).toBeVisible();
  await tutorPage.waitForTimeout(4000); // Important visual story

  // ━━━━━━━━━━━━━━━━━━━━
  // SCENE 4 — RETURN TO TEACHING
  // ━━━━━━━━━━━━━━━━━━━━
  await tutorPage.click('text="Close"');
  await tutorPage.waitForTimeout(2000);

  // ━━━━━━━━━━━━━━━━━━━━
  // SCENE 5 — MOCK EXAM
  // ━━━━━━━━━━━━━━━━━━━━
  await tutorPage.goto('http://localhost:3000/dashboard/mocks');
  await tutorPage.click('text="Today\'s Physics Mock"');
  await tutorPage.waitForSelector('text="Mock Results"');
  
  for (const s of studentContexts) {
      await s.page.goto('http://localhost:3000/dashboard/student/mocks');
      await s.page.click('text="Today\'s Physics Mock"');
      await s.page.click('text="Start Attempt"');
      await s.page.waitForSelector('text="Easy question on Newton\'s Laws"');
      
      if (s.email === 'emeka@demo.com') {
          // Struggling
          await s.page.locator('div', { hasText: 'Easy question on Newton\'s Laws' }).locator('text="A"').click();
          await s.page.locator('div', { hasText: 'Hard question on Newton\'s Laws' }).locator('text="A"').click();
      } else if (s.role === 'Strong') {
          await s.page.locator('div', { hasText: 'Easy question on Newton\'s Laws' }).locator('text="A"').click();
          await s.page.locator('div', { hasText: 'Hard question on Newton\'s Laws' }).locator('text="B"').click();
      } else if (s.role === 'Average') {
          await s.page.locator('div', { hasText: 'Easy question on Newton\'s Laws' }).locator('text="A"').click();
      }
      
      await s.page.click('text="Submit Mock"');
  }

  // ━━━━━━━━━━━━━━━━━━━━
  // SCENE 6 — AUTOMATIC GRADING & SCENE 7 — TUTOR DASHBOARD
  // ━━━━━━━━━━━━━━━━━━━━
  await tutorPage.reload();
  await expect(tutorPage.locator('text="Emeka Okafor"').first()).toBeVisible();
  await tutorPage.waitForTimeout(2000);

  // ━━━━━━━━━━━━━━━━━━━━
  // SCENE 8 — HERO STUDENT INSIGHT
  // ━━━━━━━━━━━━━━━━━━━━
  await tutorPage.click('button:has-text("AI Analyze")');
  
  await expect(tutorPage.locator('text="Emeka Okafor needs attention"')).toBeVisible();
  
  // Hold for 3-5 seconds (HERO SHOT)
  await tutorPage.waitForTimeout(5000);

  // ━━━━━━━━━━━━━━━━━━━━
  // SCENE 9 — INTERVENTION
  // ━━━━━━━━━━━━━━━━━━━━
  await tutorPage.click('text="Send Support"');
  await tutorPage.waitForTimeout(1000);

  // ━━━━━━━━━━━━━━━━━━━━
  // ENDING SHOT
  // ━━━━━━━━━━━━━━━━━━━━
  await tutorPage.goto('http://localhost:3000/dashboard');
  await tutorPage.waitForTimeout(3000);

  await tutorContext.close();
  console.log("Demo recording complete.");
});
