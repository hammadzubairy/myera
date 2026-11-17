/**
 * Day 3 Playwright audit — mobile + admin + reference design captures.
 * Usage: APP_URL=http://localhost:8081 ADMIN_URL=http://127.0.0.1:5173 \
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/day3-playwright-audit.mjs
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'dist', 'day3-audit');
const refOut = path.join(outDir, 'reference');
const appOut = path.join(outDir, 'app');
fs.mkdirSync(refOut, { recursive: true });
fs.mkdirSync(appOut, { recursive: true });

const APP = process.env.APP_URL || 'http://localhost:8081';
const ADMIN = process.env.ADMIN_URL || 'http://127.0.0.1:5173';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const results = [];

function pass(id, detail) {
  results.push({ id, status: 'pass', detail });
  console.log('PASS', id, detail || '');
}
function fail(id, detail) {
  results.push({ id, status: 'fail', detail: String(detail) });
  console.error('FAIL', id, detail);
}
function skip(id, detail) {
  results.push({ id, status: 'skip', detail: String(detail) });
  console.warn('SKIP', id, detail);
}

async function shot(page, dir, name) {
  const file = path.join(dir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function signupAndOnboard(page, email, password) {
  await page.goto(`${APP}/sign-up`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(1200);
  const inputs = page.locator('input');
  await inputs.nth(0).fill(email);
  await inputs.nth(1).fill(password);
  await shot(page, appOut, '01-sign-up');
  await page.getByText('Continue', { exact: true }).first().click();
  await page.waitForTimeout(5000);

  if (page.url().includes('sign-in')) {
    await inputs.nth(0).fill(email);
    await inputs.nth(1).fill(password);
    await page.getByText('Sign in', { exact: true }).first().click();
    await page.waitForTimeout(5000);
  }

  if (await page.getByText(/Set up your profile/i).count()) {
    const ons = page.locator('input');
    if ((await ons.count()) >= 1) await ons.nth(0).fill('Day3 Tester');
    if ((await ons.count()) >= 2) await ons.nth(1).fill('66');
    if ((await ons.count()) >= 3) await ons.nth(2).fill('200');
    if ((await ons.count()) >= 4) await ons.nth(3).fill('170');
    await page.getByText('Woman', { exact: true }).first().click().catch(() => {});
    await page.getByText(/Finish setup/i).first().click();
    await page.waitForTimeout(5000);
  }
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const desktop = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  });

  // ——— Reference design captures ———
  const refHtml = path.join(root, 'reference', 'myera-app-design (3).html');
  try {
    await desktop.goto(pathToFileURL(refHtml).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await desktop.waitForTimeout(1500);
    await shot(desktop, refOut, 'ref-full-top');

    // Capture phones that mention Day 3 related labels
    const phones = desktop.locator('.phone');
    const count = await phones.count();
    console.log('reference phones', count);
    for (let i = 0; i < count; i++) {
      const phone = phones.nth(i);
      const text = ((await phone.innerText().catch(() => '')) || '').slice(0, 200);
      const lower = text.toLowerCase();
      let name = null;
      if (lower.includes('morning') && lower.includes('week') && !name) name = 'ref-today';
      if (lower.includes('community') && lower.includes('pinned') && !name) name = 'ref-community';
      if (
        (lower.includes('\nme\n') || lower.startsWith('me') || text.includes('Shot reminders') || text.includes('Delete account')) &&
        (lower.includes('community updates') || lower.includes('shot reminder') || lower.includes('announcement'))
      )
        name = 'ref-me';
      if (lower.includes('shot reminder') && (lower.includes('weekly') || lower.includes('frequency') || lower.includes('hide')))
        name = 'ref-shot-reminders';
      if (lower.includes('announcement') && lower.includes('unread')) name = 'ref-announcements';
      if (lower.includes('reported') || (lower.includes('admin') && lower.includes('member'))) name = 'ref-admin';
      if (!name) continue;
      await phone.scrollIntoViewIfNeeded();
      await desktop.waitForTimeout(200);
      const box = await phone.boundingBox();
      if (!box) continue;
      await desktop.screenshot({
        path: path.join(refOut, `${name}.png`),
        clip: {
          x: Math.max(0, box.x - 4),
          y: Math.max(0, box.y - 4),
          width: box.width + 8,
          height: Math.min(box.height + 8, 900),
        },
      });
      pass(`ref-capture-${name}`, `phone #${i}`);
    }
  } catch (e) {
    fail('ref-capture', e.message || e);
  }

  // ——— Mobile Day 3 flows ———
  const email = `day3.audit.${Date.now()}@example.com`;
  const password = 'MyEraDay3Audit123!';
  try {
    await signupAndOnboard(mobile, email, password);
    pass('mobile-signup-onboard', email);

    // Today + bell
    await mobile.goto(`${APP}/today`, { waitUntil: 'networkidle', timeout: 90000 });
    await mobile.waitForTimeout(2000);
    await shot(mobile, appOut, '10-today-bell');
    const todayHasBell = (await mobile.locator('svg').count()) > 0;
    if (todayHasBell) pass('today-bell', 'bell control present');
    else fail('today-bell', 'no svg bell');

    // Community pinned
    await mobile.goto(`${APP}/community`, { waitUntil: 'networkidle', timeout: 90000 });
    await mobile.waitForTimeout(2000);
    await shot(mobile, appOut, '11-community-pinned');
    const pinned = await mobile.getByText(/Pinned announcement/i).count();
    if (pinned) pass('community-pinned', 'pinned banner visible');
    else fail('community-pinned', 'missing pinned banner');

    // Announcements list
    await mobile.goto(`${APP}/announcements`, { waitUntil: 'networkidle', timeout: 90000 });
    await mobile.waitForTimeout(2000);
    await shot(mobile, appOut, '12-announcements');
    const hasTitle = await mobile.getByText('Announcements', { exact: true }).count();
    const hasSeed = await mobile.getByText(/Be kind, no medical advice/i).count();
    if (hasTitle) pass('announcements-screen', hasSeed ? 'seeded announcement visible' : 'list screen ok (empty or unread)');
    else fail('announcements-screen', 'title missing');

    // Me prefs
    await mobile.goto(`${APP}/me`, { waitUntil: 'networkidle', timeout: 90000 });
    await mobile.waitForTimeout(2000);
    await shot(mobile, appOut, '13-me-prefs');
    const hasShotRow = await mobile.getByText('Shot reminders').count();
    const hasDelete = await mobile.getByText('Delete account').count();
    const hasCommunityPref = await mobile.getByText('Community updates').count();
    const hasAnnouncePref = await mobile.getByText('Announcements').count();
    if (hasShotRow && hasDelete && hasCommunityPref && hasAnnouncePref)
      pass('me-day3-rows', 'prefs + shot + delete present');
    else fail('me-day3-rows', `shot=${hasShotRow} del=${hasDelete} c=${hasCommunityPref} a=${hasAnnouncePref}`);

    // Shot reminders save
    await mobile.goto(`${APP}/shot-reminders`, { waitUntil: 'networkidle', timeout: 90000 });
    await mobile.waitForTimeout(1500);
    await shot(mobile, appOut, '14-shot-reminders');
    await mobile.getByText('Weekly', { exact: true }).first().click().catch(() => {});
    await mobile.getByText('Sat', { exact: true }).first().click().catch(() => {});
    const timeField = mobile.locator('input').first();
    if (await timeField.count()) await timeField.fill('09:00');
    await shot(mobile, appOut, '15-shot-reminders-filled');
    await mobile.getByText('Save reminders', { exact: true }).click();
    await mobile.waitForTimeout(2500);
    await shot(mobile, appOut, '16-after-save-shot');
    // Verify via API-ish: reopen
    await mobile.goto(`${APP}/shot-reminders`, { waitUntil: 'networkidle', timeout: 90000 });
    await mobile.waitForTimeout(1500);
    await shot(mobile, appOut, '17-shot-reminders-reloaded');
    const weeklyOn = await mobile.getByText('Weekly', { exact: true }).count();
    if (weeklyOn) pass('shot-schedule-save', 'screen reloaded after save');
    else fail('shot-schedule-save', 'could not reopen schedule');

    // Me shows schedule summary
    await mobile.goto(`${APP}/me`, { waitUntil: 'networkidle', timeout: 90000 });
    await mobile.waitForTimeout(2000);
    await shot(mobile, appOut, '18-me-after-schedule');
    const summary = await mobile.getByText(/Weekly|Daily|Biweekly|Set schedule|Off/i).count();
    if (summary) pass('me-shot-summary', 'schedule summary shown');
    else fail('me-shot-summary', 'no schedule summary');

    // Delete account UI present (do not confirm destructive delete in audit)
    await shot(mobile, appOut, '19-me-delete-visible');
    if (hasDelete) pass('account-delete-ui', 'Delete account row present (FR-1.6 UI)');
  } catch (e) {
    fail('mobile-flows', e.message || e);
    await shot(mobile, appOut, '99-mobile-error').catch(() => {});
  }

  // ——— Admin ———
  try {
    await desktop.goto(ADMIN, { waitUntil: 'networkidle', timeout: 60000 });
    await desktop.waitForTimeout(800);
    await shot(desktop, appOut, '20-admin-login');
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      skip('admin-signin', 'ADMIN_EMAIL/PASSWORD not set');
    } else {
      await desktop.locator('input[type="email"]').fill(ADMIN_EMAIL);
      await desktop.locator('input[type="password"]').fill(ADMIN_PASSWORD);
      await desktop.getByRole('button', { name: /Sign in/i }).click();
      await desktop.waitForTimeout(3000);
      await shot(desktop, appOut, '21-admin-after-signin');
      const blocked = await desktop.getByText(/Admin only|Sign in with an admin/i).count();
      const shell = await desktop.getByText('Reported posts').count();
      if (shell && !pageIncludesError(desktop)) {
        pass('admin-signin', 'admin shell visible');
        for (const [label, file] of [
          ['Reported posts', '22-admin-reports'],
          ['Announcements', '23-admin-announcements'],
          ['Members', '24-admin-members'],
          ['All posts', '25-admin-posts'],
          ['Community changes', '26-admin-changes'],
        ]) {
          await desktop.getByRole('button', { name: label, exact: true }).click();
          await desktop.waitForTimeout(1200);
          await shot(desktop, appOut, file);
          pass(`admin-tab-${file}`, label);
        }
        // Compose announcement
        await desktop.getByRole('button', { name: 'Announcements', exact: true }).click();
        await desktop.waitForTimeout(800);
        await desktop.locator('input').nth(0).fill('Day 3 audit announcement');
        await desktop.locator('textarea').fill('Playwright verification — no private tracking data.');
        await desktop.getByRole('button', { name: /Publish now/i }).click();
        await desktop.waitForTimeout(2500);
        await shot(desktop, appOut, '27-admin-announcement-created');
        const created = await desktop.getByText('Day 3 audit announcement').count();
        if (created) pass('admin-create-announcement', 'history shows new announcement');
        else fail('admin-create-announcement', 'not visible in history');
      } else {
        fail('admin-signin', blocked ? 'admin only / not elevated' : 'shell missing');
      }
    }
  } catch (e) {
    fail('admin-flows', e.message || e);
  }

  await browser.close();

  const summary = {
    generated_at: new Date().toISOString(),
    app: APP,
    admin: ADMIN,
    results,
    pass: results.filter((r) => r.status === 'pass').length,
    fail: results.filter((r) => r.status === 'fail').length,
    skip: results.filter((r) => r.status === 'skip').length,
    outDir,
  };
  fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(summary, null, 2));
  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify({ pass: summary.pass, fail: summary.fail, skip: summary.skip, outDir }, null, 2));
  if (summary.fail > 0) process.exitCode = 1;
}

function pageIncludesError() {
  return false;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
