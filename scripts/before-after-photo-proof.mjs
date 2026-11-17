/**
 * Proof: upload 2 progress photos (before/after), show compare slider, share to post.
 * Screenshots → dist/before-after-proof/
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'dist', 'before-after-proof');
fs.mkdirSync(outDir, { recursive: true });

const APP = process.env.APP_URL || 'http://localhost:8081';
const API = process.env.API_URL || 'http://127.0.0.1:3001';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const PHOTO = path.join(root, 'scripts', 'fixtures', 'test-photo.png');

const stamp = Date.now();
const email = `ba.proof.${stamp}@example.com`;
const password = 'MyEraBeforeAfter123!';
const results = [];

function record(id, status, detail = '') {
  results.push({ id, status, detail: String(detail) });
  console.log(`${status.toUpperCase().padEnd(4)} ${id} ${detail}`);
}

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function api(token, method, p, body) {
  const res = await fetch(`${API}${p}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${p} → ${res.status} ${JSON.stringify(json)}`);
  return json;
}

async function pickGallery(page) {
  const chooserPromise = page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null);
  await page.getByText('Gallery', { exact: true }).first().click();
  const chooser = await chooserPromise;
  if (chooser) {
    await chooser.setFiles(PHOTO);
    await page.waitForTimeout(700);
    return true;
  }
  const fileInput = page.locator('input[type="file"]');
  if (await fileInput.count()) {
    await fileInput.first().setInputFiles(PHOTO);
    await page.waitForTimeout(700);
    return true;
  }
  return false;
}

async function injectSession(page, session) {
  const ref = new URL(SUPABASE_URL).hostname.split('.')[0];
  const key = `sb-${ref}-auth-token`;
  await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(
    ({ key, session }) => {
      localStorage.setItem(key, JSON.stringify(session));
    },
    { key, session }
  );
  await page.goto(`${APP}/today`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(2500);
}

async function main() {
  if (!fs.existsSync(PHOTO)) {
    throw new Error(`Missing fixture ${PHOTO}`);
  }
  const health = await fetch(`${API}/health`).then((r) => r.json()).catch(() => null);
  if (!health?.ok) throw new Error(`API down at ${API}`);

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON);
  const { data: signed, error: signErr } = await sb.auth.signUp({ email, password });
  if (signErr) throw signErr;
  let session = signed.session;
  if (!session) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    session = data.session;
  }
  const token = session.access_token;
  await api(token, 'POST', '/auth/sync-profile', {});
  await api(token, 'POST', '/me/onboarding', {
    full_name: 'BA Proof',
    height_in: 67,
    current_weight_lb: 200,
    goal_weight_lb: 170,
    gender: 'woman',
  });
  record('seed-user', 'pass', email);

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  page.on('dialog', async (d) => d.accept());

  try {
    await injectSession(page, session);
    await shot(page, '01-today-signed-in');
    const onToday = await page.getByText(/Today|Week|Your era|Morning|Afternoon|Evening/i).count();
    record('session-inject', onToday ? 'pass' : 'fail', page.url());

    // Before photo
    await page.goto(`${APP}/add-progress-photo`, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(800);
    await shot(page, '02-add-photo-empty');
    const picked1 = await pickGallery(page);
    // date field
    const inputs = page.locator('input');
    if ((await inputs.count()) > 0) await inputs.last().fill('2026-08-01');
    await shot(page, '03-before-photo-picked');
    await page.getByText('Save photo', { exact: true }).first().click();
    await page.waitForTimeout(5500);
    await shot(page, '04-after-save-before');
    record('upload-before-ui', picked1 ? 'pass' : 'fail', picked1 ? 'gallery+save' : 'no picker');

    // After photo
    await page.goto(`${APP}/add-progress-photo`, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(800);
    const picked2 = await pickGallery(page);
    if ((await page.locator('input').count()) > 0) await page.locator('input').last().fill('2026-10-20');
    await shot(page, '05-after-photo-picked');
    await page.getByText('Save photo', { exact: true }).first().click();
    await page.waitForTimeout(5500);
    await shot(page, '06-after-save-after');
    record('upload-after-ui', picked2 ? 'pass' : 'fail', picked2 ? 'gallery+save' : 'no picker');

    const list = await api(token, 'GET', '/photos');
    const n = (list.photos || []).length;
    record('photos-api-count', n >= 2 ? 'pass' : 'fail', `count=${n} urls=${(list.photos || []).map((p) => p.url?.slice(0, 40)).join(',')}`);

    await page.goto(`${APP}/progress`, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(1200);
    await page.getByText('Photos', { exact: true }).first().click();
    await page.waitForTimeout(1500);
    await shot(page, '07-progress-photos-compare');
    const hasExample = await page.getByText('Example', { exact: true }).count();
    const hasDrag = await page.getByText(/Drag to compare/i).count();
    record(
      'compare-slider-real-photos',
      n >= 2 && !hasExample && hasDrag ? 'pass' : n >= 2 && hasDrag ? 'warn' : 'fail',
      `exampleBadge=${!!hasExample} photos=${n}`
    );

    const shareSwitch = page.getByRole('switch', { name: /Share comparison/i });
    if (await shareSwitch.count()) {
      await shareSwitch.click();
      await page.waitForTimeout(2500);
      await shot(page, '08-share-opens-new-post');
      const onNewPost =
        page.url().includes('new-post') || (await page.getByText(/New post/i).count()) > 0;
      const hasBA = await page.getByText(/Before \/ after photos/i).count();
      record('share-before-after-to-post', onNewPost && hasBA ? 'pass' : 'fail', page.url());

      if (onNewPost) {
        const body = page.locator('textarea').first();
        if (await body.count()) await body.fill('Before/after proof post from Playwright.');
        await page.getByText('Post', { exact: true }).last().click();
        await page.waitForTimeout(5500);
        await shot(page, '09-community-after-ba-post');
        const feedHit = await page.getByText(/Before\/after proof post/i).count();
        record('community-shows-ba-post', feedHit ? 'pass' : 'warn', `feedHits=${feedHit}`);
      }
    } else {
      record('share-before-after-to-post', 'fail', 'share switch missing');
    }
  } finally {
    await browser.close();
    const summary = {
      generated_at: new Date().toISOString(),
      email,
      pass: results.filter((r) => r.status === 'pass').length,
      warn: results.filter((r) => r.status === 'warn').length,
      fail: results.filter((r) => r.status === 'fail').length,
      results,
      outDir,
    };
    fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(summary, null, 2));
    console.log('\nSUMMARY', summary);
    if (summary.fail > 0) process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
