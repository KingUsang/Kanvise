import { test } from '@playwright/test';

test('Take screenshot', async ({ page }) => {
  await page.goto('http://localhost:3000/auth/login');
  await page.fill('input[type="email"]', 'tutor@demo.com');
  await page.fill('input[type="password"]', 'Password123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'login-error.png' });
});
