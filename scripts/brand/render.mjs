// Regenerates every logo and icon file from scripts/brand/mark.mjs and the Manrope font.
//
//   CHROME_PATH=/path/to/chrome node scripts/brand/render.mjs
//
// Needs the devDependencies opentype.js and playwright-core, plus a local Chrome/Chromium
// (CHROME_PATH, or an installed Google Chrome).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import { chromium } from 'playwright-core';

import { COLORS, iconBackground, leaves, silhouette, svg } from './mark.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = (...p) => join(ROOT, ...p);
const FONT_DIR = out('node_modules', '@expo-google-fonts', 'manrope');
const fontFile = (w) => join(FONT_DIR, w, `Manrope_${w}.ttf`);

// Content box of the mark on its 1024 canvas (leaf tips sit 400 px from the centre on the diagonals).
const MARK_BOX = { x: 229, size: 566 };

// --- Wordmark as outlines, so the logo files don't depend on the font being installed. ---
const extraBold = opentype.parse(readFileSync(fontFile('800ExtraBold')).buffer);

function textOutline(font, text, size, tracking) {
  const glyphs = font.stringToGlyphs(text);
  const scale = size / font.unitsPerEm;
  let x = 0;
  const d = [];
  const box = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };
  glyphs.forEach((g, i) => {
    const path = g.getPath(x, 0, size);
    d.push(path.toPathData(2));
    const b = path.getBoundingBox();
    if (b.x2 > b.x1) {
      box.x1 = Math.min(box.x1, b.x1);
      box.y1 = Math.min(box.y1, b.y1);
      box.x2 = Math.max(box.x2, b.x2);
      box.y2 = Math.max(box.y2, b.y2);
    }
    x += g.advanceWidth * scale + (i < glyphs.length - 1 ? font.getKerningValue(g, glyphs[i + 1]) * scale + tracking * size : 0);
  });
  const xHeight = (font.tables.os2.sxHeight / font.unitsPerEm) * size;
  return { d: d.join(' '), box, xHeight };
}

/** Horizontal lockup: mark + "xpense". */
function logo(colors) {
  const M = 120; // mark height in logo units
  const gap = 22;
  const t = textOutline(extraBold, 'xpense', 104, -0.03);
  const baseline = M / 2 + t.xHeight / 2; // centre the x-height on the mark (y grows downwards)
  const top = Math.min(0, baseline + t.box.y1);
  const bottom = Math.max(M, baseline + t.box.y2);
  const width = M + gap + t.box.x2;
  const s = M / MARK_BOX.size;
  const body = `<g transform="scale(${s.toFixed(5)}) translate(${-MARK_BOX.x} ${-MARK_BOX.x})">${leaves(colors, { ribs: false })}</g>
    <path d="${t.d}" transform="translate(${M + gap} ${baseline.toFixed(2)})" fill="${colors.word}"/>`;
  const h = bottom - top;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${top.toFixed(1)} ${width.toFixed(1)} ${h.toFixed(1)}" width="${width.toFixed(0)}" height="${h.toFixed(0)}">${body}</svg>`;
}

const markOnly = (colors, ribs = true) =>
  svg(leaves(colors, { ribs }), 1024, `${MARK_BOX.x} ${MARK_BOX.x} ${MARK_BOX.size} ${MARK_BOX.size}`);

// --- Vector sources ---
mkdirSync(out('assets', 'brand'), { recursive: true });
const files = {
  'assets/brand/mark.svg': markOnly(COLORS.light, false),
  'assets/brand/mark-dark.svg': markOnly(COLORS.dark, false),
  'assets/brand/logo.svg': logo(COLORS.light),
  'assets/brand/logo-dark.svg': logo(COLORS.dark),
  'assets/brand/icon.svg': svg(iconBackground() + leaves(COLORS.icon)),
};
for (const [path, content] of Object.entries(files)) writeFileSync(out(path), content);

// --- iOS 26 Icon Composer bundle: needs and wants are separate glass layers on an evergreen fill. ---
const iconDir = out('assets', 'xpense.icon');
mkdirSync(join(iconDir, 'Assets'), { recursive: true });
writeFileSync(join(iconDir, 'Assets', 'needs.svg'), svg(leaves(COLORS.icon, { which: 'needs' })));
writeFileSync(join(iconDir, 'Assets', 'wants.svg'), svg(leaves(COLORS.icon, { which: 'wants' })));
const layer = (name) => ({ 'image-name': `${name}.svg`, name, position: { scale: 1, 'translation-in-points': [0, 0] } });
writeFileSync(
  join(iconDir, 'icon.json'),
  JSON.stringify(
    {
      fill: { 'automatic-gradient': 'extended-srgb:0.11765,0.35686,0.30980,1.00000' },
      groups: [
        {
          layers: [layer('wants'), layer('needs')],
          shadow: { kind: 'neutral', opacity: 0.5 },
          translucency: { enabled: true, value: 0.4 },
        },
      ],
      'supported-platforms': { circles: ['watchOS'], squares: 'shared' },
    },
    null,
    2,
  ) + '\n',
);

// --- Raster icons ---
const ANDROID_SCALE = 0.72; // keeps the leaf tips inside the adaptive-icon safe zone
const rasters = [
  { path: 'assets/images/icon.png', size: 1024, body: iconBackground() + leaves(COLORS.icon) },
  { path: 'assets/images/android-icon-background.png', size: 1024, body: iconBackground() },
  { path: 'assets/images/android-icon-foreground.png', size: 1024, body: leaves(COLORS.icon, { scale: ANDROID_SCALE }), transparent: true },
  { path: 'assets/images/android-icon-monochrome.png', size: 1024, body: silhouette({ scale: ANDROID_SCALE }), transparent: true },
  { path: 'assets/images/splash-icon.png', size: 1024, body: leaves(COLORS.light), transparent: true },
  { path: 'assets/images/splash-icon-dark.png', size: 1024, body: leaves({ ...COLORS.dark, rib: '#0F1A17' }), transparent: true },
  { path: 'assets/images/favicon.png', size: 48, body: `<g transform="scale(${48 / 1024})"><rect width="1024" height="1024" rx="220" fill="#1E5B4F"/>${leaves(COLORS.icon, { ribs: false, scale: 1.12 })}</g>` },
];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  channel: process.env.CHROME_PATH ? undefined : 'chrome',
});
const page = await browser.newPage();
for (const r of rasters) {
  await page.setViewportSize({ width: r.size, height: r.size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg(r.body, r.size, r.size === 1024 ? '0 0 1024 1024' : `0 0 ${r.size} ${r.size}`)}</body></html>`,
  );
  await page.screenshot({ path: out(r.path), omitBackground: !!r.transparent, clip: { x: 0, y: 0, width: r.size, height: r.size } });
}

// --- Brand sheet (docs/brand/brand-sheet.png) ---
const fontFace = (family, w) =>
  `@font-face{font-family:${family};src:url(data:font/ttf;base64,${readFileSync(fontFile(w)).toString('base64')})}`;
const swatch = (name, hex, note, dark = false) =>
  `<div class="sw"><div class="chip" style="background:${hex};${dark ? '' : 'border:1px solid #e2ded3'}"></div><b>${name}</b><span>${hex}</span><em>${note}</em></div>`;
const sheet = `<html><head><style>
${fontFace('MXB', '800ExtraBold')}${fontFace('MB', '700Bold')}${fontFace('MSB', '600SemiBold')}${fontFace('MM', '500Medium')}
body{margin:0;background:#F6F4EE;color:#1B2421;font-family:MM;width:1400px}
.wrap{padding:56px 64px}
h1{font-family:MXB;font-size:44px;letter-spacing:-1px;margin:0}
h2{font-family:MB;font-size:15px;letter-spacing:.08em;text-transform:uppercase;color:#5D6864;margin:44px 0 16px}
.lead{font-size:19px;color:#5D6864;max-width:860px;line-height:1.5;margin:10px 0 0}
.row{display:flex;gap:24px;align-items:center;flex-wrap:wrap}
.card{background:#fff;border-radius:22px;padding:34px 40px;box-shadow:0 6px 24px rgba(27,36,33,.06)}
.dark{background:#0F1A17}
.sw{display:flex;flex-direction:column;gap:4px;width:136px;font-size:14px}
.sw .chip{height:84px;border-radius:16px;margin-bottom:6px}.sw span{color:#5D6864;font-family:MSB}.sw em{color:#5D6864;font-style:normal;font-size:13px}
.type div{margin:6px 0}
.legend{display:flex;gap:26px;font-family:MSB;font-size:16px;margin-top:18px;color:#1B2421}
.dot{display:inline-block;width:14px;height:14px;border-radius:7px;margin-right:8px;vertical-align:-1px}
</style></head><body><div class="wrap">
<h1>Xpense brand</h1>
<p class="lead">Two leaves cross to make the X: one diagonal is <b style="color:#0E8066">needs</b>, the other is <b style="color:#B06F12">wants</b>. Leaves for conservation, an X for Xpense, and the crossing is the decision the app helps you make. Evergreen and parchment keep it calm and safe.</p>

<h2>Logo</h2>
<div class="row"><div class="card">${files['assets/brand/logo.svg'].replace(/width="\d+" height="\d+"/, 'height="88"')}</div>
<div class="card dark">${files['assets/brand/logo-dark.svg'].replace(/width="\d+" height="\d+"/, 'height="88"')}</div></div>
<div class="legend"><span><i class="dot" style="background:#0E8066"></i>Needs leaves</span><span><i class="dot" style="background:#CC8418"></i>Wants leaves</span></div>

<h2>App icon</h2>
<div class="row">${[220, 120, 76, 44].map((s) => `<div style="width:${s}px;height:${s}px;border-radius:${s * 0.2237}px;overflow:hidden;box-shadow:0 8px 24px rgba(18,63,54,.25)">${svg(iconBackground('i' + s) + leaves(COLORS.icon, { ribs: s >= 76 }), s)}</div>`).join('')}
<div style="width:220px;height:220px;border-radius:110px;overflow:hidden;background:#1E5B4F;display:flex;align-items:center;justify-content:center">${svg(leaves(COLORS.icon, { scale: ANDROID_SCALE }), 220)}</div></div>

<h2>Colour</h2>
<div class="row">${swatch('Evergreen', '#1E5B4F', 'Primary, trust', true)}${swatch('Parchment', '#F6F4EE', 'Background')}${swatch('Ink', '#1B2421', 'Text', true)}
${swatch('Need', '#008A6E', 'Needs in charts', true)}${swatch('Want', '#B06F12', 'Wants in charts', true)}${swatch('Income', '#2F6BC4', 'Money in', true)}
${swatch('Mint', '#8FD3B6', 'Icon, dark accents', true)}${swatch('Gold', '#F0BE5C', 'Icon, Pro', true)}</div>

<h2>Type · Manrope</h2>
<div class="card type">
<div style="font-family:MXB;font-size:56px;letter-spacing:-1.5px">$2,085.58</div>
<div style="font-family:MB;font-size:30px;letter-spacing:-.5px">Your progress</div>
<div style="font-family:MSB;font-size:20px">Scan a receipt or bill</div>
<div style="font-family:MM;font-size:17px;color:#5D6864">Safe to spend this month · ≈ $231.73 a day for the next 9 days</div></div>
</div></body></html>`;
mkdirSync(out('docs', 'brand'), { recursive: true });
await page.setViewportSize({ width: 1400, height: 900 });
await page.setContent(sheet, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out('docs', 'brand', 'brand-sheet.png'), fullPage: true });
await browser.close();

console.log('Brand assets written:', [...Object.keys(files), 'assets/xpense.icon', ...rasters.map((r) => r.path), 'docs/brand/brand-sheet.png'].join('\n  '));
