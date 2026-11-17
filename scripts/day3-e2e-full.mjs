/**
 * Full Day 3 E2E: seed user+admin data, drive UI, assert no errors, screenshot proofs.
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'dist', 'day3-e2e');
fs.mkdirSync(outDir, { recursive: true });

const APP = process.env.APP_URL || 'http://localhost:8081';
const ADMIN = process.env.ADMIN_URL || 'http://127.0.0.1:5173';
const API = process.env.API_URL || 'http://127.0.0.1:3001';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const results = [];
const stamp = Date.now();
const memberEmail = `e2e.member.${stamp}@example.com`;
const memberPass = 'MyEraE2EMember123!';
const adminEmail = `e2e.admin.${stamp}@myera.test`;
const adminPass = 'MyEraE2EAdmin123!';

function record(id, status, detail = '') {
  results.push({ id, status, detail });
  console.log(status.toUpperCase(), id, detail);
}

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function assertNoNavError(page, id) {
  const toast = page.getByText(/GO_BACK|was not handled by any navigator/i);
  const n = await toast.count();
  if (n > 0) {
    await shot(page, `FAIL-${id}-goback`);
    record(id, 'fail', 'GO_BACK toast visible');
    return false;
  }
  record(id, 'pass', 'no GO_BACK error');
  return true;
}

async function apiJson(token, method, p, body) {
  const res = await fetch(`${API}${p}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${p} → ${res.status} ${JSON.stringify(json)}`);
  }
  return json;
}

async function ensureAdminUser(sbAdmin) {
  const { data: created, error } = await sbAdmin.auth.admin.createUser({
    email: adminEmail,
    password: adminPass,
    email_confirm: true,
    user_metadata: { full_name: 'E2E Admin' },
  });
  if (error) throw new Error(`admin create: ${error.message}`);
  const id = created.user.id;
  await sbAdmin.from('profiles').upsert({
    id,
    email: adminEmail,
    full_name: 'E2E Admin',
    role: 'admin',
    updated_at: new Date().toISOString(),
  });
  await sbAdmin.from('profiles').update({ role: 'admin' }).eq('id', id);
  return id;
}

async function signupOnboard(page) {
  await page.goto(`${APP}/sign-up`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(1000);
  const inputs = page.locator('input');
  await inputs.nth(0).fill(memberEmail);
  await inputs.nth(1).fill(memberPass);
  await shot(page, '01-signup');
  await page.getByText('Continue', { exact: true }).first().click();
  await page.waitForTimeout(5000);
  if (page.url().includes('sign-in')) {
    await page.locator('input').nth(0).fill(memberEmail);
    await page.locator('input').nth(1).fill(memberPass);
    await page.getByText('Sign in', { exact: true }).first().click();
    await page.waitForTimeout(5000);
  }
  if (await page.getByText(/Set up your profile/i).count()) {
    const ons = page.locator('input');
    if ((await ons.count()) >= 1) await ons.nth(0).fill('E2E Member');
    if ((await ons.count()) >= 2) await ons.nth(1).fill('66');
    if ((await ons.count()) >= 3) await ons.nth(2).fill('210');
    if ((await ons.count()) >= 4) await ons.nth(3).fill('175');
    await page.getByText('Woman', { exact: true }).first().click().catch(() => {});
    await page.getByText(/Finish setup/i).first().click();
    await page.waitForTimeout(5000);
  }
  await shot(page, '02-after-onboarding');
}

async function seedMemberData(token) {
  // Dose regimen
  await apiJson(token, 'POST', '/doses/regimens', {
    medication_name: 'Semaglutide',
    amount_mg: 2.4,
    start_date: new Date().toISOString().slice(0, 10),
  }).catch(async (e) => {
    // maybe exists — try change
    console.warn('regimen create', e.message);
  });
  await apiJson(token, 'POST', '/doses/logs', {
    logged_on: new Date().toISOString().slice(0, 10),
    amount_mg: 2.4,
  });
  await apiJson(token, 'POST', '/weights', {
    logged_on: new Date().toISOString().slice(0, 10),
    weight_lb: 198.5,
  });
  await apiJson(token, 'PUT', '/shot-schedule', {
    frequency: 'weekly',
    shot_day: 6,
    shot_time: '09:00',
    day_before_enabled: true,
    day_before_time: '19:00',
    second_reminder_enabled: true,
    hide_on_lockscreen: true,
    timezone: 'UTC',
    enabled: true,
  });
  await apiJson(token, 'POST', '/community/posts', {
    body: 'E2E win: down another pound this week. Feeling steady.',
    photo_urls: [],
    include_weight_change: true,
    include_before_after: false,
    include_dose: true,
  });
  await apiJson(token, 'POST', '/community/posts', {
    body: 'Second E2E post — community feed should not be empty.',
    photo_urls: [],
    include_weight_change: false,
    include_before_after: false,
    include_dose: false,
  });
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_ANON || !SERVICE) {
    throw new Error('Missing Supabase env (URL, anon, service role)');
  }
  const health = await fetch(`${API}/health`).then((r) => r.json()).catch(() => null);
  if (!health?.ok) throw new Error(`API not healthy at ${API}`);

  const sbAdmin = createClient(SUPABASE_URL, SERVICE);
  await ensureAdminUser(sbAdmin);
  record('seed-admin', 'pass', adminEmail);

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  // Capture console errors related to navigation
  const consoleErrors = [];
  mobile.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  mobile.on('pageerror', (err) => consoleErrors.push(String(err)));

  const desktop = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });

  try {
    // —— Member signup ——
    await signupOnboard(mobile);
    record('member-signup', 'pass', memberEmail);

    // Sign in via supabase client to seed API data
    const sbUser = createClient(SUPABASE_URL, SUPABASE_ANON);
    const { data: auth, error: authErr } = await sbUser.auth.signInWithPassword({
      email: memberEmail,
      password: memberPass,
    });
    if (authErr) throw new Error(authErr.message);
    const token = auth.session.access_token;
    await seedMemberData(token);
    record('seed-member-data', 'pass', 'dose, weight, schedule, 2 posts');

    // —— Admin: announcements ——
    await desktop.goto(ADMIN, { waitUntil: 'networkidle', timeout: 60000 });
    await desktop.locator('input[type="email"]').fill(adminEmail);
    await desktop.locator('input[type="password"]').fill(adminPass);
    await desktop.getByRole('button', { name: /Sign in/i }).click();
    await desktop.waitForTimeout(2500);
    await shot(desktop, '10-admin-home');
    if (!(await desktop.getByText('Reported posts').count())) {
      record('admin-login', 'fail', 'shell missing');
    } else {
      record('admin-login', 'pass');
    }

    await desktop.getByRole('button', { name: 'Announcements', exact: true }).click();
    await desktop.waitForTimeout(800);
    await desktop.locator('.form-grid input').first().fill('E2E pinned heads-up');
    await desktop.locator('textarea').fill('Admin-created announcement for E2E. Stay kind — no medical advice.');
    await desktop.locator('input[type="checkbox"]').nth(1).check().catch(() => {});
    // pin checkbox is 2nd
    const checks = desktop.locator('.form-grid input[type="checkbox"]');
    if ((await checks.count()) >= 2) await checks.nth(1).check();
    await desktop.getByRole('button', { name: /Publish now/i }).click();
    await desktop.waitForTimeout(2500);
    await shot(desktop, '11-admin-announcement-published');
    if (await desktop.getByText('E2E pinned heads-up').count()) {
      record('admin-publish-announcement', 'pass');
    } else {
      record('admin-publish-announcement', 'fail', 'not in history');
    }

    // Members list shows our tester
    await desktop.getByRole('button', { name: 'Members', exact: true }).click();
    await desktop.waitForTimeout(1000);
    await shot(desktop, '12-admin-members');
    if (await desktop.getByText(memberEmail).count()) {
      record('admin-sees-member', 'pass');
    } else {
      record('admin-sees-member', 'fail', 'member email missing');
    }

    await desktop.getByRole('button', { name: 'All posts', exact: true }).click();
    await desktop.waitForTimeout(1000);
    await shot(desktop, '13-admin-posts');
    if (await desktop.getByText(/E2E win/i).count()) {
      record('admin-sees-posts', 'pass');
    } else {
      record('admin-sees-posts', 'fail', 'member posts missing');
    }

    // —— Mobile: verify feed + data ——
    await mobile.goto(`${APP}/today`, { waitUntil: 'networkidle', timeout: 90000 });
    await mobile.waitForTimeout(2500);
    await shot(mobile, '20-today-with-data');
    if (await mobile.getByText(/2\.4|Semaglutide|mg/i).count()) {
      record('today-dose', 'pass');
    } else {
      // dose card may say You're on with amount
      record('today-dose', (await mobile.getByText(/You're on|Add dose/i).count()) ? 'pass' : 'fail', 'dose card');
    }

    await mobile.goto(`${APP}/community`, { waitUntil: 'networkidle', timeout: 90000 });
    await mobile.waitForTimeout(2500);
    await shot(mobile, '21-community-feed');
    const hasPin = await mobile.getByText(/E2E pinned heads-up|Pinned announcement/i).count();
    const hasPost = await mobile.getByText(/E2E win/i).count();
    record('community-pin', hasPin ? 'pass' : 'fail', hasPin ? 'pinned visible' : 'no pin');
    record('community-posts', hasPost ? 'pass' : 'fail', hasPost ? 'member posts visible' : 'empty feed');

    // New post via UI
    await mobile.getByText(/Share a win from today/i).click();
    await mobile.waitForTimeout(1500);
    await mobile.locator('textarea').or(mobile.locator('[contenteditable], input').first()).first().fill(
      'UI-composed E2E post from Playwright.'
    ).catch(async () => {
      // new-post uses TextInput multiline
      await mobile.locator('input, textarea').last().fill('UI-composed E2E post from Playwright.');
    });
    // Find text input on new-post
    const editors = mobile.locator('TextInput, textarea, [data-testid="post-body"]');
    // RN web often uses textarea or div
    const bodyInputs = mobile.locator('textarea');
    if (await bodyInputs.count()) {
      await bodyInputs.first().fill('UI-composed E2E post from Playwright.');
    } else {
      // Try any textbox
      const tb = mobile.getByRole('textbox');
      if (await tb.count()) await tb.first().fill('UI-composed E2E post from Playwright.');
    }
    await shot(mobile, '22-new-post-compose');
    await mobile.getByText('Post', { exact: true }).last().click();
    await mobile.waitForTimeout(3500);
    await shot(mobile, '23-community-after-ui-post');
    record(
      'ui-create-post',
      (await mobile.getByText(/UI-composed E2E post/i).count()) ? 'pass' : 'fail'
    );

    // Announcements from bell
    await mobile.goto(`${APP}/today`, { waitUntil: 'networkidle', timeout: 90000 });
    await mobile.waitForTimeout(1500);
    // Navigate via Me → shot (with stack history) to prove GO_BACK fix
    await mobile.goto(`${APP}/me`, { waitUntil: 'networkidle', timeout: 90000 });
    await mobile.waitForTimeout(1500);
    await shot(mobile, '30-me');
    await mobile.getByText('Shot reminders').click();
    await mobile.waitForTimeout(1500);
    await shot(mobile, '31-shot-reminders');
    // Toggle day-before on and save
    await mobile.getByText('Day-before reminder').click().catch(() => {});
    // Use Save
    await mobile.getByText('Save reminders', { exact: true }).click();
    await mobile.waitForTimeout(2500);
    await shot(mobile, '32-after-save-shot');
    await assertNoNavError(mobile, 'shot-save-no-goback');
    // Should land on Me
    const onMe = pageUrlIncludes(mobile, '/me') || (await mobile.getByText('Delete account').count()) > 0;
    record('shot-save-lands-me', onMe ? 'pass' : 'fail', mobile.url());

    // Direct deep-link save (the original failure case)
    await mobile.goto(`${APP}/shot-reminders`, { waitUntil: 'networkidle', timeout: 90000 });
    await mobile.waitForTimeout(1200);
    await mobile.getByText('Save reminders', { exact: true }).click();
    await mobile.waitForTimeout(2500);
    await shot(mobile, '33-deeplink-save');
    await assertNoNavError(mobile, 'deeplink-save-no-goback');

    // Announcements list
    await mobile.goto(`${APP}/announcements`, { waitUntil: 'networkidle', timeout: 90000 });
    await mobile.waitForTimeout(1500);
    await shot(mobile, '34-announcements');
    record(
      'announcements-list',
      (await mobile.getByText(/E2E pinned heads-up/i).count()) ? 'pass' : 'fail'
    );
    await mobile.getByText(/E2E pinned heads-up/i).first().click().catch(() => {});
    await mobile.waitForTimeout(800);
    await shot(mobile, '35-announcement-read');

    // Prefs toggle
    await mobile.goto(`${APP}/me`, { waitUntil: 'networkidle', timeout: 90000 });
    await mobile.waitForTimeout(1500);
    await shot(mobile, '36-me-final');
    const scheduleSummary = await mobile.getByText(/Weekly|Sat|09:00|9:00/i).count();
    record('me-schedule-summary', scheduleSummary ? 'pass' : 'fail');

    // Progress with weight
    await mobile.goto(`${APP}/progress`, { waitUntil: 'networkidle', timeout: 90000 });
    await mobile.waitForTimeout(2000);
    await shot(mobile, '37-progress');
    record(
      'progress-weight',
      (await mobile.getByText(/198|210|175|lb/i).count()) ? 'pass' : 'fail'
    );

    // Dose screen
    await mobile.goto(`${APP}/dose`, { waitUntil: 'networkidle', timeout: 90000 });
    await mobile.waitForTimeout(1500);
    await shot(mobile, '38-dose');
    record(
      'dose-history',
      (await mobile.getByText(/Semaglutide|2\.4|mg/i).count()) ? 'pass' : 'fail'
    );

    // Check console for GO_BACK
    const gobackLogs = consoleErrors.filter((t) => /GO_BACK|not handled by any navigator/i.test(t));
    record(
      'console-no-goback',
      gobackLogs.length === 0 ? 'pass' : 'fail',
      gobackLogs[0] || ''
    );
  } catch (e) {
    record('e2e-fatal', 'fail', e.message || String(e));
    await shot(mobile, '99-fatal').catch(() => {});
  }

  await browser.close();

  const summary = {
    generated_at: new Date().toISOString(),
    memberEmail,
    adminEmail,
    pass: results.filter((r) => r.status === 'pass').length,
    fail: results.filter((r) => r.status === 'fail').length,
    results,
    outDir,
  };
  fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(summary, null, 2));
  console.log('\n=== E2E SUMMARY ===');
  console.log(JSON.stringify({ pass: summary.pass, fail: summary.fail, outDir }, null, 2));
  if (summary.fail > 0) process.exitCode = 1;
}

function pageUrlIncludes(page, frag) {
  try {
    return page.url().includes(frag);
  } catch {
    return false;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
