import { test, expect } from '@playwright/test';

// The "Director" script for the pitch demo

test('Kanvise AI Demo Data Chain', async ({ browser }) => {
  // We need to drive multiple sessions for Tutor and Students
  const tutorContext = await browser.newContext();
  const tutorPage = await tutorContext.newPage();
  
  const studentContext = await browser.newContext();
  const studentPage = await studentContext.newPage();

  // 1. Tutor logs in
  await tutorPage.goto('http://localhost:3000/login');
  await tutorPage.fill('input[type="email"]', 'tutor@demo.com');
  await tutorPage.fill('input[type="password"]', 'Password123!');
  await tutorPage.click('button[type="submit"]');
  await tutorPage.waitForURL('**/dashboard');

  // 2. Student logs in
  await studentPage.goto('http://localhost:3000/login');
  await studentPage.fill('input[type="email"]', 'emeka@demo.com');
  await studentPage.fill('input[type="password"]', 'Password123!');
  await studentPage.click('button[type="submit"]');
  await studentPage.waitForURL('**/dashboard');

  // 3. Tutor starts the live class
  await tutorPage.click('text="Newton\'s Laws of Motion"');
  await tutorPage.click('text="Start Class"');
  // Handle the live class page loading (Wait for the knowledge check button)
  await tutorPage.waitForSelector('text="Generate Knowledge Check"', { timeout: 15000 });

  // 4. Student joins the live class
  await studentPage.click('text="Newton\'s Laws of Motion"');
  await studentPage.click('text="Join Class"');
  
  // 5. Tutor sends the Knowledge Check
  await tutorPage.click('text="Generate Knowledge Check"');

  // 6. Student answers the Knowledge Check
  await studentPage.waitForSelector('text="Which situation best demonstrates Newton\'s Third Law?"');
  // Emeka answers incorrectly
  await studentPage.click('text="A car accelerating forward when the driver presses the gas pedal."');

  // 7. Tutor sees the result
  await expect(tutorPage.locator('text="✗ Incorrect"')).toBeVisible();

  // 8. Tutor launches AI Analysis Insight
  await tutorPage.click('text="Analyze"');
  
  // 9. Tutor views the AI insight card (The Hero Moment)
  await expect(tutorPage.locator('text="Emeka Okafor needs attention"')).toBeVisible();
  
  // 10. Tutor clicks "Send Support"
  await tutorPage.click('text="Send Support"');

  console.log("Demo scenario successfully orchestrated.");
});
