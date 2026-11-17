import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'dist', 'ui-screenshots');
fs.mkdirSync(outDir, { recursive: true });
const APP = process.env.APP_URL || 'http://localhost:8081';
const email = `ui.audit.${Date.now()}@example.com`;
const password = 'MyEraAudit123!';

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log('saved', name, page.url());
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });

  console.log('signing up as', email);
  await page.goto(`${APP}/sign-up`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(1500);

  const inputs = page.locator('input');
  await inputs.nth(0).fill(email);
  await inputs.nth(1).fill(password);
  await shot(page, '20-sign-up-filled');

  await page.getByText('Continue', { exact: true }).first().click();
  await page.waitForTimeout(5000);
  await shot(page, '22-after-continue');

  // If bounced to sign-in (email confirm), try signing in anyway
  if (page.url().includes('sign-in')) {
    const ins = page.locator('input');
    await ins.nth(0).fill(email);
    await ins.nth(1).fill(password);
    await page.getByText('Sign in', { exact: true }).first().click();
    await page.waitForTimeout(5000);
    await shot(page, '22b-after-signin');
  }

  // Onboarding
  if (await page.getByText(/Set up your profile/i).count()) {
    await shot(page, '23-onboarding');
    const ons = page.locator('input');
    const oc = await ons.count();
    console.log('onboarding inputs', oc);
    if (oc >= 1) await ons.nth(0).fill('Audit User');
    if (oc >= 2) await ons.nth(1).fill('66');
    if (oc >= 3) await ons.nth(2).fill('200');
    if (oc >= 4) await ons.nth(3).fill('170');
    await page.getByText('Woman', { exact: true }).first().click().catch(() => {});
    await shot(page, '24-onboarding-filled');
    await page.getByText(/Finish setup/i).first().click();
    await page.waitForTimeout(5000);
    await shot(page, '25-after-onboarding');
  } else {
    console.log('No onboarding screen. URL=', page.url());
    await shot(page, '23-no-onboarding');
  }

  for (const [route, name] of [
    ['/', '30-home'],
    ['/today', '31-today'],
    ['/(tabs)/today', '31b-today'],
    ['/progress', '32-progress'],
    ['/(tabs)/progress', '32b-progress'],
    ['/food', '33-food'],
    ['/(tabs)/food', '33b-food'],
    ['/community', '34-community'],
    ['/(tabs)/community', '34b-community'],
    ['/me', '35-me'],
    ['/(tabs)/me', '35b-me'],
    ['/dose', '36-dose'],
    ['/new-post', '37-new-post'],
    ['/calorie-goal', '38-calorie-goal'],
    ['/shot-reminders', '40-shot-reminders'],
    ['/announcements', '41-announcements'],
  ]) {
    try {
      await page.goto(`${APP}${route}`, { waitUntil: 'networkidle', timeout: 90000 });
      await page.waitForTimeout(2000);
      await shot(page, name);
    } catch (e) {
      console.warn('fail', route, e.message);
    }
  }

  await browser.close();
  console.log('done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
