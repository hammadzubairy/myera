/**
 * Chrome UI audit — mobile viewport screenshots vs design reference.
 * Usage: node scripts/ui-screenshot-audit.mjs
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'dist', 'ui-screenshots');
fs.mkdirSync(outDir, { recursive: true });

const APP = process.env.APP_URL || 'http://127.0.0.1:8081';
const DESIGN = `file://${path.join(root, 'reference', 'myera-app-design (3).html')}`;

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log('saved', file);
  return file;
}

async function main() {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // --- Design reference frames (first phone-like screens) ---
  try {
    await page.goto(DESIGN, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(800);
    await shot(page, '00-design-reference-top');
    // Scroll through design document capturing major sections
    const labels = await page.locator('figcaption').allTextContents().catch(() => []);
    console.log('design figcaptions:', labels.slice(0, 20));
  } catch (e) {
    console.warn('design html open failed', e.message);
  }

  // --- App screens ---
  await page.goto(APP, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(2500);
  await shot(page, '01-app-landing');

  // Try welcome / sign-in routes
  for (const [route, name] of [
    ['/welcome', '02-welcome'],
    ['/(auth)/welcome', '02b-welcome-group'],
    ['/sign-in', '03-sign-in'],
    ['/(auth)/sign-in', '03b-sign-in'],
    ['/sign-up', '04-sign-up'],
    ['/(auth)/sign-up', '04b-sign-up'],
    ['/forgot-password', '05-forgot'],
  ]) {
    try {
      await page.goto(`${APP}${route}`, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(1200);
      await shot(page, name);
    } catch (e) {
      console.warn('route failed', route, e.message);
    }
  }

  // Attempt demo login if env provided
  const email = process.env.MYERA_TEST_EMAIL;
  const password = process.env.MYERA_TEST_PASSWORD;
  if (email && password) {
    await page.goto(`${APP}/sign-in`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const inputs = page.locator('input');
    const count = await inputs.count();
    if (count >= 2) {
      await inputs.nth(0).fill(email);
      await inputs.nth(1).fill(password);
      await page.getByText('Sign in', { exact: false }).first().click();
      await page.waitForTimeout(3000);
      await shot(page, '06-after-login');
    }

    for (const [route, name] of [
      ['/today', '07-today'],
      ['/(tabs)/today', '07b-today'],
      ['/progress', '08-progress'],
      ['/(tabs)/progress', '08b-progress'],
      ['/food', '09-food'],
      ['/(tabs)/food', '09b-food'],
      ['/community', '10-community'],
      ['/(tabs)/community', '10b-community'],
      ['/me', '11-me'],
      ['/(tabs)/me', '11b-me'],
      ['/dose', '12-dose'],
      ['/new-post', '13-new-post'],
      ['/compare-photos', '14-compare'],
      ['/calorie-goal', '15-calorie-goal'],
    ]) {
      try {
        await page.goto(`${APP}${route}`, { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(1500);
        await shot(page, name);
      } catch (e) {
        console.warn('authed route failed', route, e.message);
      }
    }
  } else {
    console.log('Set MYERA_TEST_EMAIL / MYERA_TEST_PASSWORD to capture logged-in screens.');
  }

  await browser.close();
  console.log('Done. Screenshots in', outDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
