// Makes the App Store screenshots (6.9" iPhone 1320 × 2868 and 13" iPad 2752 × 2064) and the in-app
// purchase review screenshot from the web preview, which renders the same React Native screens as the app.
//
//   1. EXPO_PUBLIC_API_URL=demo npx expo start --web           (sample AI answers, local preview account)
//   2. CHROME_PATH=/path/to/chrome npm run store:screenshots   (or with Google Chrome installed: npm run store:screenshots)
//
// Writes docs/app-store/screenshots/*.jpg and docs/app-store/iap-review.jpg. The layout follows the Gallery
// design: an index number and a light headline on bone paper, the real screen inside a thin ink outline.
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const APP_URL = process.env.APP_URL ?? 'http://localhost:8081';
const OUT = join(ROOT, 'docs', 'app-store');
const RECEIPT = join(ROOT, 'scripts', 'fixtures', 'sample-receipt.jpg');
const FONTS = join(ROOT, 'node_modules', '@expo-google-fonts');
const font = (path) => readFileSync(join(FONTS, path)).toString('base64');

const IPHONE = {
  '1-safe-to-spend': 'Know what’s\nsafe to spend',
  '2-scan': 'Snap a receipt.\nThe AI does the typing.',
  '3-needs-wants': 'Every line,\na need or a want',
  '4-buy-check': 'Thinking of buying it?\nCheck first.',
  '5-goal': 'Save up for what\nyou really want',
};
const IPAD = {
  '1-dashboard': 'Your month at a glance, on iPad and Mac',
  '2-history': 'Every entry, on every device',
};

// The canvas, the device outline and the app viewport that fills it exactly (status bar room on top).
const PHONE = { width: 1320, height: 2868, margin: 120, top: 560, radius: 150, inset: 50, viewport: 390 };
const TABLET = { width: 2752, height: 2064, margin: 200, top: 420, radius: 64, inset: 24, viewport: 1180 };
const BORDER = 4;
const scaleOf = (c) => (c.width - 2 * c.margin - 2 * BORDER) / c.viewport;
const viewportHeight = (c) => Math.round((c.height - c.top - BORDER - c.inset * scaleOf(c)) / scaleOf(c));

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  channel: process.env.CHROME_PATH ? undefined : 'chrome',
});

/** A fresh app (new browser context = empty storage): preview account, setup done, AI allowed. */
async function freshApp(width, height, scale) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale });
  const page = await context.newPage();
  const tap = (text) => page.getByText(text, { exact: true }).first().click();
  await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 180_000 });
  await tap('Try it without an account');
  await page.getByLabel('Your first name').fill('Sam');
  await page.getByLabel('What is it?').fill('A laptop');
  await page.getByLabel('How much does it cost?').fill('1200');
  await tap('Continue');
  await page.getByLabel('Take-home pay').fill('680');
  await page.getByRole('radio', { name: 'a week' }).click();
  await page.getByLabel('Hours you work in a week (optional)').fill('32');
  await page.getByLabel(/Set aside each month/).fill('300');
  await tap('Continue');
  await page.getByRole('switch', { name: 'Allow AI features' }).click();
  await tap('Start, Sam');
  await page.getByRole('tab', { name: 'Dashboard' }).waitFor();
  await page.waitForTimeout(1000);
  return { page, tap };
}

const openSettings = (page) => page.getByLabel(/Settings and account|Account and settings/).first().click();

/** Settings → Developer: Simulate Pro and sample data (both exist only in development builds). */
async function withSampleData({ page, tap }) {
  await openSettings(page);
  await page.getByRole('switch', { name: 'Simulate Pro' }).click();
  await tap('Load sample data');
  await page.getByText('Sample data loaded').waitFor();
  await page.goBack();
  await page.waitForTimeout(3500); // let the toast leave and the numbers settle
}

const shots = {};
const ipadShots = {};
mkdirSync(join(OUT, 'screenshots'), { recursive: true });

// In-app purchase review screenshot: the whole Pro screen, as a free user sees it.
{
  const { page, tap } = await freshApp(390, 1400, 3);
  await openSettings(page);
  await tap('See Pro plans');
  await page.getByText('Restore purchases').waitFor();
  await page.waitForTimeout(1000);
  // Down to the renewal terms (the preview's developer note below them stays out of the picture).
  const terms = await page.getByText(/renews automatically/).boundingBox();
  const height = Math.ceil(terms.y + terms.height + 14);
  await page.screenshot({ path: join(OUT, 'iap-review.jpg'), type: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: 390, height } });
  await page.context().close();
}

// iPhone
{
  const app = await freshApp(PHONE.viewport, viewportHeight(PHONE), 3);
  const { page, tap } = app;
  await withSampleData(app);
  shots['1-safe-to-spend'] = await page.screenshot();

  await page.getByRole('tab', { name: 'AI mode' }).click();
  await page.waitForTimeout(1200);
  shots['2-scan'] = await page.screenshot();

  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), tap('Choose from photos')]);
  await chooser.setFiles(RECEIPT);
  await page.getByText('Check the scan').waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1200);
  // Scroll the item lines into view with the wheel, so only the screen's own scroll view moves: the page
  // starts at the line above the shop's name.
  const top = await page.getByText(/^Receipt ·/).first().boundingBox();
  await page.mouse.move(195, 400);
  await page.mouse.wheel(0, Math.max(0, top.y - 16));
  await page.waitForTimeout(900);
  shots['3-needs-wants'] = await page.screenshot();
  await tap('Discard');
  await page.waitForTimeout(800);

  await page.getByLabel('What is it?').fill('Wireless earbuds');
  await page.getByLabel('Price').fill('149');
  await tap('Check it');
  await page.getByText('Sleep on it').waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  shots['4-buy-check'] = await page.screenshot();
  await page.goBack();
  await page.waitForTimeout(800);

  await page.getByRole('tab', { name: 'Dashboard' }).click();
  await page.waitForTimeout(800);
  await page.getByLabel(/saved of/).first().click();
  await page.waitForTimeout(1500);
  shots['5-goal'] = await page.screenshot();
  await page.context().close();
}

// iPad (landscape; the same layout runs on a Mac)
{
  const app = await freshApp(TABLET.viewport, viewportHeight(TABLET), 2);
  const { page } = app;
  await withSampleData(app);
  ipadShots['1-dashboard'] = await page.screenshot();
  await page.getByRole('tab', { name: 'History' }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: /Green Valley Market/ }).first().click();
  await page.waitForTimeout(1200);
  ipadShots['2-history'] = await page.screenshot();
  await page.context().close();
}

// Compose: index and headline on paper, the screen in an ink outline that runs off the bottom edge.
const STYLE = `
@font-face{font-family:Geist;font-weight:300;src:url(data:font/ttf;base64,${font('geist/300Light/Geist_300Light.ttf')})}
@font-face{font-family:"Geist Mono";src:url(data:font/ttf;base64,${font('geist-mono/400Regular/GeistMono_400Regular.ttf')})}
*{box-sizing:border-box}
body{margin:0;overflow:hidden;position:relative;background:#F4F3EF;color:#111111;font-family:Geist;-webkit-font-smoothing:antialiased}
.index{font-family:"Geist Mono";color:#6B6A66}
h1{margin:0;font-weight:300;white-space:pre-line;letter-spacing:-.035em;line-height:1.04}
.device{position:absolute;bottom:0;border:${BORDER}px solid #111111;border-bottom:0;overflow:hidden;background:#F4F3EF}
.device img{display:block;width:100%}`;

const layout = (c, extra) => `${STYLE}
body{width:${c.width}px;height:${c.height}px}
.device{left:${c.margin}px;right:${c.margin}px;height:${c.height - c.top}px;border-radius:${c.radius}px ${c.radius}px 0 0;padding-top:${Math.round(c.inset * scaleOf(c))}px}
${extra}`;

/** The largest headline size (up to `max`) at which every title fits in `lines` lines across `width`. */
async function fitSize(page, titles, { width, max, lines }) {
  return page.evaluate(
    ({ titles, width, max, lines }) => {
      const h = document.createElement('h1');
      h.style.cssText = `position:absolute;visibility:hidden;width:${width}px`;
      document.body.append(h);
      let size = max;
      for (const t of titles) {
        h.textContent = t;
        for (;;) {
          h.style.fontSize = `${size}px`;
          if (h.getBoundingClientRect().height <= size * 1.04 * lines + 1 || size <= 40) break;
          size -= 2;
        }
      }
      h.remove();
      return size;
    },
    { titles, width, max, lines },
  );
}

const composer = await browser.newPage({ viewport: { width: PHONE.width, height: PHONE.height } });
await composer.setContent(`<!doctype html><html><head><style>${layout(PHONE, '')}</style></head><body></body></html>`);
await composer.evaluate(() => document.fonts.load('300 100px Geist'));
const phoneSize = await fitSize(composer, Object.values(IPHONE), { width: PHONE.width - 2 * PHONE.margin, max: 108, lines: 2 });
for (const [i, [name, title]] of Object.entries(IPHONE).entries()) {
  await composer.setContent(`<!doctype html><html><head><style>${layout(
    PHONE,
    `.text{position:absolute;top:130px;left:${PHONE.margin}px;right:${PHONE.margin}px}
.index{font-size:40px;line-height:48px}
h1{margin-top:24px;font-size:${phoneSize}px}`,
  )}</style></head><body><div class="text"><div class="index">0${i + 1}</div><h1>${title}</h1></div>
<div class="device"><img src="data:image/png;base64,${shots[name].toString('base64')}"></div></body></html>`);
  await composer.evaluate(() => document.fonts.ready);
  await composer.screenshot({ path: join(OUT, 'screenshots', `iphone-${name}.jpg`), type: 'jpeg', quality: 90 });
  console.log(`docs/app-store/screenshots/iphone-${name}.jpg`);
}

await composer.setViewportSize({ width: TABLET.width, height: TABLET.height });
for (const [i, [name, title]] of Object.entries(IPAD).entries()) {
  await composer.setContent(`<!doctype html><html><head><style>${layout(
    TABLET,
    `.text{position:absolute;top:110px;left:${TABLET.margin}px;right:${TABLET.margin}px}
.index{font-size:40px;line-height:48px}
h1{margin-top:20px;font-size:116px;white-space:nowrap}`,
  )}</style></head><body><div class="text"><div class="index">0${i + 1}</div><h1>${title}</h1></div>
<div class="device"><img src="data:image/png;base64,${ipadShots[name].toString('base64')}"></div></body></html>`);
  await composer.evaluate(() => document.fonts.ready);
  await composer.screenshot({ path: join(OUT, 'screenshots', `ipad-${name}.jpg`), type: 'jpeg', quality: 90 });
  console.log(`docs/app-store/screenshots/ipad-${name}.jpg`);
}
console.log('docs/app-store/iap-review.jpg');
await browser.close();

// Screenshots from earlier designs.
for (const old of ['1-progress', '2-scan', '3-needs-wants', '4-buy-check', '5-safe-to-spend']) rmSync(join(OUT, 'screenshots', `${old}.jpg`), { force: true });
rmSync(join(OUT, 'screenshots', 'iphone-5-history.jpg'), { force: true });
