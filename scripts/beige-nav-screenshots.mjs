import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'dist', 'ui-screenshots');
fs.mkdirSync(outDir, { recursive: true });
const APP = process.env.APP_URL || 'http://localhost:8081';
const email = `beige.nav.${Date.now()}@example.com`;
const password = 'MyEraAudit123!';

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log('saved', file);
  return file;
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });

  await page.goto(`${APP}/sign-up`, { waitUntil: 'networkidle', timeout: 180000 });
  await page.waitForTimeout(2000);

  const inputs = page.locator('input');
  await inputs.nth(0).fill(email);
  await inputs.nth(1).fill(password);
  await page.getByText('Continue', { exact: true }).first().click();
  await page.waitForTimeout(5000);

  if (page.url().includes('sign-in')) {
    const ins = page.locator('input');
    await ins.nth(0).fill(email);
    await ins.nth(1).fill(password);
    await page.getByText('Sign in', { exact: true }).first().click();
    await page.waitForTimeout(5000);
  }

  if (await page.getByText(/Set up your profile/i).count()) {
    const ons = page.locator('input');
    const oc = await ons.count();
    if (oc >= 1) await ons.nth(0).fill('Beige Nav');
    if (oc >= 2) await ons.nth(1).fill('66');
    if (oc >= 3) await ons.nth(2).fill('221');
    if (oc >= 4) await ons.nth(3).fill('180');
    await page.getByText('Woman', { exact: true }).first().click().catch(() => {});
    await page.getByText(/Finish setup/i).first().click();
    await page.waitForTimeout(5000);
  }

  await page.goto(`${APP}/(tabs)/today`, { waitUntil: 'networkidle', timeout: 90000 }).catch(async () => {
    await page.goto(`${APP}/today`, { waitUntil: 'networkidle', timeout: 90000 });
  });
  await page.waitForTimeout(2500);
  await shot(page, 'beige-nav-today');

  await page.goto(`${APP}/change-dose`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2500);
  await shot(page, 'beige-nav-add-dose');

  await browser.close();
  console.log('done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
