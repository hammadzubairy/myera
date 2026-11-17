/**
 * Capture all 11 screens listed in MyEra_UI Testing.docx after UI fixes.
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'dist', 'ui-doc-screens');
fs.mkdirSync(outDir, { recursive: true });

const APP = process.env.APP_URL || 'http://127.0.0.1:8081';
const API = process.env.API_URL || 'http://127.0.0.1:3001';
const email = `uidoc.${Date.now()}@example.com`;
const password = 'MyEraUiDoc123!';

function loadEnv() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, '');
  }
  return out;
}

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log('saved', name, '→', page.url());
}

async function waitForText(page, re, ms = 15000) {
  await page.getByText(re).first().waitFor({ timeout: ms }).catch(() => {});
}

async function main() {
  const env = loadEnv();
  const sb = createClient(
    env.SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY
  );

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });

  // 1 Welcome
  await page.goto(`${APP}/welcome`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(2500);
  await shot(page, '01-welcome');

  // Sign up
  await page.goto(`${APP}/sign-up`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(1200);
  const inputs = page.locator('input');
  await inputs.nth(0).fill(email);
  await inputs.nth(1).fill(password);
  await page.getByText('Continue', { exact: true }).first().click();
  await page.waitForTimeout(4500);
  if (page.url().includes('sign-in')) {
    const ins = page.locator('input');
    await ins.nth(0).fill(email);
    await ins.nth(1).fill(password);
    await page.getByText('Sign in', { exact: true }).first().click();
    await page.waitForTimeout(4500);
  }

  // 2 Onboarding
  await waitForText(page, /Set up your profile/i);
  await shot(page, '02-onboarding-profile');
  const ons = page.locator('input');
  const oc = await ons.count();
  // Full name is usually first editable; email may be read-only
  for (let i = 0; i < oc; i++) {
    const editable = await ons.nth(i).isEditable().catch(() => false);
    const val = await ons.nth(i).inputValue().catch(() => '');
    if (!editable) continue;
    if (!val) {
      if (i === 0 || /name/i.test((await ons.nth(i).getAttribute('placeholder')) || '')) {
        await ons.nth(i).fill('Jessica Moore');
      } else if (!val.includes('@')) {
        // height / weights — fill remaining empties in order
      }
    }
  }
  // Fill remaining empty editable inputs with sensible defaults
  const empties = [];
  for (let i = 0; i < oc; i++) {
    const editable = await ons.nth(i).isEditable().catch(() => false);
    if (!editable) continue;
    const val = await ons.nth(i).inputValue().catch(() => '');
    if (!val) empties.push(i);
  }
  if (empties[0] != null) await ons.nth(empties[0]).fill('Jessica Moore');
  // height feet/inches or total inches fields vary — try common pattern
  const remaining = [];
  for (let i = 0; i < oc; i++) {
    const editable = await ons.nth(i).isEditable().catch(() => false);
    const val = await ons.nth(i).inputValue().catch(() => '');
    if (editable && !val) remaining.push(i);
  }
  const defaults = ['66', '221', '180'];
  remaining.forEach(async () => {});
  for (let j = 0; j < remaining.length; j++) {
    await ons.nth(remaining[j]).fill(defaults[j] || '180');
  }
  await page.getByText('Woman', { exact: true }).first().click().catch(() => {});
  await shot(page, '02b-onboarding-filled');
  await page.getByText(/Finish setup/i).first().click();
  await page.waitForTimeout(5000);

  // Seed dose + food via API for richer screens
  try {
    const { data: auth } = await sb.auth.signInWithPassword({ email, password });
    const token = auth?.session?.access_token;
    if (token) {
      await fetch(`${API}/doses/regimens`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medication_name: 'Semaglutide',
          amount_mg: 2.4,
          start_date: new Date().toISOString().slice(0, 10),
        }),
      }).catch(() => {});
    }
  } catch (e) {
    console.warn('seed skip', e.message);
  }

  // 3 Today
  await page.goto(`${APP}/(tabs)/today`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2500);
  await shot(page, '03-today');

  // 4 Dose
  await page.goto(`${APP}/dose`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2000);
  await shot(page, '04-dose');

  // 5 Progress Photos
  await page.goto(`${APP}/(tabs)/progress`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2000);
  await page.getByText('Photos', { exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '05-progress-photos');

  // 6 Food
  await page.goto(`${APP}/(tabs)/food`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2000);
  await shot(page, '06-food');

  // 7 Food search + servings sheet
  await page.getByText(/Add food/i).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  // try navigate search directly
  await page.goto(`${APP}/food-search?meal=snacks`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const search = page.locator('input').first();
  if (await search.count()) {
    await search.fill('almond');
    await page.waitForTimeout(2000);
  }
  await shot(page, '07a-food-search');
  await page.getByText(/Almonds, raw/i).first().click().catch(async () => {
    await page.locator('text=+').first().click().catch(() => {});
  });
  await page.waitForTimeout(2000);
  await shot(page, '07-food-servings');

  // 8 Community
  await page.goto(`${APP}/(tabs)/community`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2500);
  await shot(page, '08-community');

  // 9 New post
  await page.goto(`${APP}/new-post`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2000);
  await shot(page, '09-new-post');

  // 10 Me
  await page.goto(`${APP}/(tabs)/me`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2000);
  await shot(page, '10-me');

  // 11 Report sheet — open community and trigger report
  await page.goto(`${APP}/(tabs)/community`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2000);
  // seed a post if empty
  const hasPost = (await page.getByText(/Report|•••|⋯|More/i).count()) > 0;
  if (!hasPost) {
    await page.goto(`${APP}/new-post`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const ta = page.locator('textarea, [contenteditable="true"]').first();
    if (await ta.count()) await ta.fill('UI doc sample post for report sheet.');
    else {
      const inputs2 = page.locator('input');
      if (await inputs2.count()) await inputs2.first().fill('UI doc sample post for report sheet.');
    }
    // try TextInput via RN web
    await page.getByText(/^Post$/i).first().click().catch(() => {});
    await page.waitForTimeout(3000);
    await page.goto(`${APP}/(tabs)/community`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
  }
  await page.getByText('•••').first().click().catch(async () => {
    await page.getByText('⋯').first().click().catch(async () => {
      await page.getByText('Report').first().click().catch(() => {});
    });
  });
  await page.waitForTimeout(800);
  await page.getByText(/^Report$/i).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '11-report-sheet');

  await browser.close();
  console.log('All screens saved to', outDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
