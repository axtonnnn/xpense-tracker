// Makes the App Store screenshots (6.9" iPhone, 1320 × 2868) and the in-app purchase review screenshot
// from the web preview, which renders the same React Native screens as the app.
//
//   1. EXPO_PUBLIC_API_URL=demo npx expo start --web           (sample AI answers)
//   2. CHROME_PATH=/path/to/chrome npm run store:screenshots   (or with Google Chrome installed: npm run store:screenshots)
//
// Writes docs/app-store/screenshots/*.jpg and docs/app-store/iap-review.jpg.
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

import { COLORS, leaves } from '../brand/mark.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const APP_URL = process.env.APP_URL ?? 'http://localhost:8081';
const OUT = join(ROOT, 'docs', 'app-store');
const RECEIPT = join(ROOT, 'scripts', 'fixtures', 'sample-receipt.jpg');
const font = (weight) =>
  readFileSync(join(ROOT, 'node_modules', '@expo-google-fonts', 'manrope', weight, `Manrope_${weight}.ttf`)).toString('base64');

const CAPTIONS = {
  '1-progress': ['See where your money really goes', 'Needs and wants, week by week'],
  '2-scan': ['Snap a receipt.\nAI does the typing.', 'Every item, total and date'],
  '3-needs-wants': ['Every line sorted into needs and wants', 'Change anything with a tap'],
  '4-buy-check': ['Pause before you buy', 'See the price in hours of work'],
  '5-safe-to-spend': ['Know what’s safe to spend', 'Your data stays on your phone'],
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  channel: process.env.CHROME_PATH ? undefined : 'chrome',
});

/** A fresh app (new browser context = empty database), through onboarding with AI allowed. */
async function freshApp(colorScheme, height = 844) {
  const context = await browser.newContext({ viewport: { width: 390, height }, deviceScaleFactor: 3, colorScheme });
  const page = await context.newPage();
  page.on('dialog', (dialog) => dialog.accept());
  const tap = (text) => page.getByText(text, { exact: true }).first().click();
  await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 120_000 });
  await tap('Get started');
  await page.getByPlaceholder('e.g. 3200').fill('5200');
  await page.getByPlaceholder('e.g. 400').fill('800');
  await tap('Continue');
  await page.getByRole('switch', { name: 'Allow AI features' }).click();
  await tap('Start saving');
  await page.getByLabel('Settings').waitFor();
  return { page, tap };
}

/** Settings → Developer: sample data and Simulate Pro (both exist only in development builds). */
async function withSampleData({ page, tap }) {
  await page.getByLabel('Settings').click();
  await page.getByText('Load sample data').scrollIntoViewIfNeeded();
  await page.getByRole('switch', { name: 'Simulate Pro' }).click();
  await tap('Load sample data');
  await page.getByText('Sample data loaded').waitFor();
  await page.goBack();
  await page.waitForTimeout(3500); // let the toast leave
}

/** Scrolls the screen (with the wheel, so only the page's scroll view moves) until `text` sits at `top`. */
async function scrollTo(page, text, top) {
  const box = await page.getByText(text).first().boundingBox();
  await page.mouse.move(195, 500);
  await page.mouse.wheel(0, box.y - top);
  await page.waitForTimeout(800);
}

const shots = {};
mkdirSync(join(OUT, 'screenshots'), { recursive: true });

// In-app purchase review screenshot: the whole paywall, as a free user sees it.
{
  const { page, tap } = await freshApp('light', 1500);
  await tap('6 months');
  await page.getByText('Restore purchases').waitFor();
  await page.waitForTimeout(800);
  // Down to the renewal terms (the preview's developer note below them stays out of the picture).
  const terms = await page.getByText(/renews automatically/).boundingBox();
  const height = Math.ceil(terms.y + terms.height + 24);
  await page.screenshot({ path: join(OUT, 'iap-review.jpg'), type: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: 390, height } });
  await page.context().close();
}

{
  const app = await freshApp('light');
  const { page, tap } = app;
  await withSampleData(app);
  shots['1-progress'] = await page.screenshot();

  await page.getByRole('tab', { name: 'AI mode' }).click();
  await page.waitForTimeout(1000);
  shots['2-scan'] = await page.screenshot();

  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), tap('Choose from photos')]);
  await chooser.setFiles(RECEIPT);
  await page.getByText('Save expense').waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1000);
  shots['3-needs-wants'] = await page.screenshot();
  await tap('Discard');

  await page.getByPlaceholder(/What is it/).fill('Wireless earbuds');
  await page.getByPlaceholder(/Price/).fill('149');
  await tap('Check it');
  await page.getByText(/of your work/).first().waitFor({ timeout: 30_000 });
  await scrollTo(page, 'Should I buy this?', 100);
  shots['4-buy-check'] = await page.screenshot();
  await page.context().close();
}

{
  const app = await freshApp('dark');
  await withSampleData(app);
  await scrollTo(app.page, /^Wants are/, 28);
  shots['5-safe-to-spend'] = await app.page.screenshot();
  await app.page.context().close();
}

// Compose: headline and supporting line on the evergreen brand gradient, the screen rising from the bottom.
const page = await browser.newPage({ viewport: { width: 1320, height: 2868 } });
const mark = `<svg class="mark" width="1100" height="1100" viewBox="229 229 566 566">${leaves(COLORS.icon, { ribs: false })}</svg>`;
for (const [name, [title, sub]] of Object.entries(CAPTIONS)) {
  await page.setContent(`<!doctype html><html><head><style>
@font-face{font-family:Manrope;font-weight:800;src:url(data:font/ttf;base64,${font('800ExtraBold')})}
@font-face{font-family:Manrope;font-weight:600;src:url(data:font/ttf;base64,${font('600SemiBold')})}
body{margin:0;width:1320px;height:2868px;overflow:hidden;position:relative;font-family:Manrope;background:linear-gradient(165deg,#23715F 0%,#1A5A4D 35%,#123F36 100%)}
.mark{position:absolute;right:-330px;top:-300px;opacity:.09}
.text{position:absolute;top:150px;left:80px;right:80px;text-align:center}
h1{margin:0;color:#F6F4EE;font-weight:800;font-size:92px;line-height:1.08;letter-spacing:-2.5px;white-space:pre-line}
p{margin:30px 0 0;color:#8FD3B6;font-weight:600;font-size:50px;letter-spacing:-.5px}
.screen{position:absolute;left:120px;bottom:0;width:1080px;border-radius:72px 72px 0 0;box-shadow:0 -10px 120px rgba(0,0,0,.35)}
</style></head><body>${mark}<div class="text"><h1>${title}</h1><p>${sub}</p></div>
<img class="screen" src="data:image/png;base64,${shots[name].toString('base64')}"></body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(OUT, 'screenshots', `${name}.jpg`), type: 'jpeg', quality: 90 });
  console.log(`docs/app-store/screenshots/${name}.jpg`);
}
console.log('docs/app-store/iap-review.jpg');
await browser.close();
