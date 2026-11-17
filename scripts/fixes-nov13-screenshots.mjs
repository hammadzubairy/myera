// Screenshots for the Nov 13 fixes (ring colour, weight tile, multi-dose, nav pill).
// PHASE=a  → sign up a throwaway user, log a weight, shoot ring + weight tile + nav pill
// PHASE=b  → sign in as that user, add two doses, shoot dose screens
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'dist', 'ui-screenshots', 'fixes-nov13');
fs.mkdirSync(outDir, { recursive: true });
const credsFile = path.join(outDir, '.creds.json');
const APP = process.env.APP_URL || 'http://localhost:8081';
const PHASE = process.env.PHASE || 'a';

async function shot(page, name, clip) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false, ...(clip ? { clip } : {}) });
  console.log('saved', name, page.url());
}

/** Fill the input that follows a visible label (RN-web renders label text then <input>). */
async function fillByLabel(page, label, value) {
  const input = page
    .locator(`xpath=//*[normalize-space(text())="${label}"]/following::input[1]`)
    .first();
  await input.fill(value);
}

async function go(page, route, wait = 2500) {
  await page.goto(`${APP}${route}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(wait);
}

async function clickText(page, text, wait = 3000) {
  await page.getByText(text, { exact: true }).first().click();
  await page.waitForTimeout(wait);
}

async function signUp(page) {
  const email = `ui.audit.${Date.now()}@example.com`;
  const password = 'MyEraAudit123!';
  fs.writeFileSync(credsFile, JSON.stringify({ email, password }));
  console.log('signing up as', email);
  await go(page, '/sign-up', 1500);
  const inputs = page.locator('input');
  await inputs.nth(0).fill(email);
  await inputs.nth(1).fill(password);
  await clickText(page, 'Continue', 6000);

  if (page.url().includes('sign-in')) await signIn(page);

  if (await page.getByText(/Set up your profile/i).count()) {
    const field = (label) => page.getByRole('button', { name: label }).locator('input');
    await field('Full name').fill('Audit User');
    await field('Height (ft)').fill('5').catch(() => {});
    await field('Height (in)').fill('7').catch(() => {});
    await field('Current weight (lb)').fill('200').catch(() => {});
    await field('Goal (lb, optional)').fill('170').catch(() => {});
    await page.getByText('Woman', { exact: true }).first().click().catch(() => {});
    await shot(page, '00-onboarding-filled');
    await page.getByText(/Finish setup/i).first().click();
    await page.waitForTimeout(6000);
  }
}

async function signIn(page) {
  const { email, password } = JSON.parse(fs.readFileSync(credsFile, 'utf8'));
  console.log('signing in as', email);
  await go(page, '/sign-in', 1500);
  const ins = page.locator('input');
  await ins.nth(0).fill(email);
  await ins.nth(1).fill(password);
  await page.getByText('Sign in', { exact: true }).last().click();
  await page.waitForTimeout(6000);
}

async function phaseA(page) {
  await signUp(page);

  // Log a lower weight so the ring shows some progress
  await go(page, '/log-weight');
  await fillByLabel(page, 'Weight (lb)', '192');
  await clickText(page, 'Save', 4000);

  await go(page, '/today', 4000);
  await shot(page, '01-today-ring');
  await shot(page, '01b-today-ring-closeup', { x: 0, y: 60, width: 390, height: 300 });

  await go(page, '/progress', 3000);
  await clickText(page, 'Measurements', 2000);
  await shot(page, '02-progress-weight-tile');

  // Weight tile opens Log weight
  await clickText(page, 'Log weight', 2500);
  await shot(page, '02b-weight-tile-opens-log-weight');

  for (const tab of ['today', 'progress', 'me']) {
    await go(page, `/${tab}`, 2500);
    await shot(page, `06-nav-pill-${tab}`, { x: 0, y: 720, width: 390, height: 124 });
  }
}

async function phaseB(page) {
  await signIn(page);

  await go(page, '/dose');
  await clickText(page, 'Add dose');
  await fillByLabel(page, 'Medication', 'Semaglutide');
  await fillByLabel(page, 'Amount (mg)', '0.5');
  await clickText(page, 'Save', 4000);

  await go(page, '/dose');
  await clickText(page, '+ Add another dose');
  await fillByLabel(page, 'Medication', 'Tirzepatide');
  await fillByLabel(page, 'Amount (mg)', '2.5');
  await shot(page, '03a-add-second-dose-form');
  await clickText(page, 'Save', 4000);
  await shot(page, '03b-after-save');

  await go(page, '/dose', 3000);
  await shot(page, '03-dose-multi');

  await go(page, '/today', 4000);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(1200);
  await shot(page, '04-today-multi-dose');

  await go(page, '/log-dose', 3000);
  await shot(page, '05-log-dose-picker');
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  page.on('dialog', async (d) => {
    console.log('DIALOG:', d.message());
    await d.accept();
  });
  try {
    if (PHASE === 'a') await phaseA(page);
    else await phaseB(page);
  } catch (e) {
    console.error('step failed:', e.message);
    await shot(page, `zz-error-phase-${PHASE}`);
  }
  await browser.close();
  console.log('done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
