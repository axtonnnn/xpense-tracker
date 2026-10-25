// Makes the App Store screenshots (6.9" iPhone 1320 × 2868 and 13" iPad 2752 × 2064), the in-app purchase
// review screenshot and the website's app pictures, from the web preview, which renders the same React
// Native screens as the app.
//
//   1. EXPO_PUBLIC_API_URL=demo npx expo start --web           (sample AI answers, local preview account)
//   2. CHROME_PATH=/path/to/chrome npm run store:screenshots   (or with Google Chrome installed: npm run store:screenshots)
//
// Writes docs/app-store/screenshots/*.jpg, docs/app-store/iap-review.jpg and worker/public/screens/*.jpg.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

import { framePaths, seedOf } from '../../shared/sketch.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const APP_URL = process.env.APP_URL ?? 'http://localhost:8081';
const OUT = join(ROOT, 'docs', 'app-store');
const SITE = join(ROOT, 'worker', 'public', 'screens');
const RECEIPT = join(ROOT, 'scripts', 'fixtures', 'sample-receipt.jpg');
const FONTS = join(ROOT, 'node_modules', '@expo-google-fonts');
const font = (path) => readFileSync(join(FONTS, path)).toString('base64');

const IPHONE = {
  '1-safe-to-spend': ['know what’s safe to spend', 'After rent, bills\nand saving'],
  '2-scan': ['snap a receipt', 'The AI does\nthe typing'],
  '3-needs-wants': ['every line, sorted', 'Needs and wants,\nwithout the guilt'],
  '4-buy-check': ['before you buy', 'Checked against\nyour own budget'],
  '5-history': ['on every device', 'Your money,\nlike a ledger'],
};
const IPAD = {
  '1-dashboard': ['on iPad and Mac too', 'Your month at a glance'],
  '2-history': ['synced to your account', 'Every entry, every device'],
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  channel: process.env.CHROME_PATH ? undefined : 'chrome',
});

/** A fresh app (new browser context = empty storage): preview account, onboarding done, AI allowed. */
async function freshApp(width, height, scale) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale });
  const page = await context.newPage();
  page.on('dialog', (dialog) => dialog.accept());
  const tap = (text) => page.getByText(text, { exact: true }).first().click();
  await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 120_000 });
  await tap('Try it without an account');
  await page.getByPlaceholder('e.g. Sam').fill('Sam');
  await page.getByPlaceholder('e.g. a car, moving out, a new laptop').fill('a car');
  await tap('Continue');
  await page.getByPlaceholder('e.g. 1800').fill('2950');
  await page.getByPlaceholder('e.g. 20', { exact: true }).fill('40');
  await page.getByPlaceholder('e.g. 200').fill('300');
  await tap('Continue');
  await page.getByRole('switch', { name: 'Allow AI features' }).click();
  await tap('Start, Sam');
  await page.getByRole('tab', { name: 'Dashboard' }).waitFor();
  return { page, tap };
}

/** Settings → Developer: Simulate Pro and sample data (both exist only in development builds). */
async function withSampleData({ page, tap }) {
  await page.getByLabel('Account and settings').first().click();
  await page.getByRole('switch', { name: 'Simulate Pro' }).click();
  await tap('Load sample data');
  await page.getByText('Sample data loaded').waitFor();
  await page.goBack();
  await page.waitForTimeout(3500); // let the toast leave
}

const shots = {};
const ipadShots = {};
const siteShots = {};
mkdirSync(join(OUT, 'screenshots'), { recursive: true });
mkdirSync(SITE, { recursive: true });

// In-app purchase review screenshot: the whole paywall, as a free user sees it.
{
  const { page } = await freshApp(390, 1400, 3);
  await page.getByRole('tab', { name: '6 months, Pro' }).click();
  await page.getByText('Restore purchases').waitFor();
  await page.waitForTimeout(800);
  // Down to the renewal terms (the preview's developer note below them stays out of the picture).
  const terms = await page.getByText(/renews automatically/).boundingBox();
  const height = Math.ceil(terms.y + terms.height + 24);
  await page.screenshot({ path: join(OUT, 'iap-review.jpg'), type: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: 390, height } });
  await page.context().close();
}

// iPhone
{
  const app = await freshApp(390, 844, 3);
  const { page, tap } = app;
  await withSampleData(app);
  shots['1-safe-to-spend'] = await page.screenshot();
  siteShots.dashboard = await page.screenshot({ type: 'jpeg', quality: 82, scale: 'css' });

  await page.getByRole('tab', { name: 'AI mode' }).click();
  await page.waitForTimeout(1000);
  shots['2-scan'] = await page.screenshot();

  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), tap('Choose from photos')]);
  await chooser.setFiles(RECEIPT);
  await page.getByText('Save expense').waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1000);
  shots['3-needs-wants'] = await page.screenshot();
  siteShots.review = await page.screenshot({ type: 'jpeg', quality: 82, scale: 'css' });
  await tap('Discard');

  await page.getByPlaceholder('e.g. wireless earbuds').fill('Wireless earbuds');
  await page.getByPlaceholder('0.00').first().fill('149');
  await tap('Check it');
  await page.getByText('of your work').first().waitFor({ timeout: 30_000 });
  // Scroll the answer into view with the wheel, so only the screen's own scroll view moves.
  const box = await page.getByText('Should I buy this?').boundingBox();
  await page.mouse.move(195, 500);
  await page.mouse.wheel(0, box.y - 90);
  await page.waitForTimeout(800);
  shots['4-buy-check'] = await page.screenshot();

  await page.getByRole('tab', { name: 'History' }).click();
  await page.waitForTimeout(1000);
  shots['5-history'] = await page.screenshot();
  siteShots.history = await page.screenshot({ type: 'jpeg', quality: 82, scale: 'css' });
  await page.context().close();
}

// iPad (landscape; the same layout runs on a Mac)
{
  const app = await freshApp(1180, 820, 2);
  await withSampleData(app);
  ipadShots['1-dashboard'] = await app.page.screenshot();
  await app.page.getByRole('tab', { name: 'History' }).click();
  await app.page.waitForTimeout(1000);
  ipadShots['2-history'] = await app.page.screenshot();
  await app.page.context().close();
}

for (const [name, buf] of Object.entries(siteShots)) {
  writeFileSync(join(SITE, `${name}.jpg`), buf);
  console.log(`worker/public/screens/${name}.jpg`);
}

// Compose: a pencil note and a serif headline on paper, the screen on a white page with a sketched frame.
const STYLE = `
@font-face{font-family:"Instrument Serif";src:url(data:font/ttf;base64,${font('instrument-serif/400Regular/InstrumentSerif_400Regular.ttf')})}
@font-face{font-family:Caveat;src:url(data:font/ttf;base64,${font('caveat/500Medium/Caveat_500Medium.ttf')})}
body{margin:0;overflow:hidden;position:relative;background:#F6F2EA;color:#111}
.note{font-family:Caveat;color:#5E5A53}
h1{margin:0;font-family:"Instrument Serif";font-weight:400;white-space:pre-line;letter-spacing:-1px}
.page{position:absolute;background:#fff}
.page img{display:block;width:100%}
.sk{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.sk path{fill:none;stroke:#111;stroke-width:4;stroke-linecap:round;vector-effect:non-scaling-stroke}
.sk .p2{stroke-width:2;opacity:.4}`;
const frame = (key) => {
  const [a, b] = framePaths(seedOf(key));
  return `<svg class="sk" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${a}"/><path class="p2" d="${b}"/></svg>`;
};

const composer = await browser.newPage({ viewport: { width: 1320, height: 2868 } });
for (const [name, [note, title]] of Object.entries(IPHONE)) {
  await composer.setContent(`<!doctype html><html><head><style>${STYLE}
body{width:1320px;height:2868px}
.text{position:absolute;top:150px;left:110px;right:110px}
.note{font-size:64px;transform:rotate(-2deg);transform-origin:left}
h1{font-size:150px;line-height:1;margin-top:16px}
.page{left:120px;right:120px;top:760px;padding:28px 28px 0}
</style></head><body><div class="text"><div class="note">${note}</div><h1>${title}</h1></div>
<div class="page">${frame(`iphone-${name}`)}<img src="data:image/png;base64,${shots[name].toString('base64')}"></div></body></html>`);
  await composer.evaluate(() => document.fonts.ready);
  await composer.screenshot({ path: join(OUT, 'screenshots', `iphone-${name}.jpg`), type: 'jpeg', quality: 90 });
  console.log(`docs/app-store/screenshots/iphone-${name}.jpg`);
}

await composer.setViewportSize({ width: 2752, height: 2064 });
for (const [name, [note, title]] of Object.entries(IPAD)) {
  await composer.setContent(`<!doctype html><html><head><style>${STYLE}
body{width:2752px;height:2064px}
.text{position:absolute;top:110px;left:190px;right:190px;display:flex;align-items:baseline;gap:48px}
.note{font-size:70px;transform:rotate(-2deg)}
h1{font-size:140px;line-height:1}
.page{left:190px;right:190px;top:380px;padding:30px}
</style></head><body><div class="text"><h1>${title}</h1><div class="note">${note}</div></div>
<div class="page">${frame(`ipad-${name}`)}<img src="data:image/png;base64,${ipadShots[name].toString('base64')}"></div></body></html>`);
  await composer.evaluate(() => document.fonts.ready);
  await composer.screenshot({ path: join(OUT, 'screenshots', `ipad-${name}.jpg`), type: 'jpeg', quality: 90 });
  console.log(`docs/app-store/screenshots/ipad-${name}.jpg`);
}
console.log('docs/app-store/iap-review.jpg');
await browser.close();

// Screenshots from the earlier green design.
for (const old of ['1-progress', '2-scan', '3-needs-wants', '4-buy-check', '5-safe-to-spend']) rmSync(join(OUT, 'screenshots', `${old}.jpg`), { force: true });
