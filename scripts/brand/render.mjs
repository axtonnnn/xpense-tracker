// Regenerates every logo and icon file from scripts/brand/mark.mjs and the Instrument Serif font.
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

import { COLORS, leaves, paperBackground, silhouette, svg } from './mark.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = (...p) => join(ROOT, ...p);
const FONTS = out('node_modules', '@expo-google-fonts');
const serifItalic = opentype.parse(readFileSync(join(FONTS, 'instrument-serif', '400Regular_Italic', 'InstrumentSerif_400Regular_Italic.ttf')).buffer);

// Content box of the mark on its 1024 canvas (leaf tips sit 400 px from the centre on the diagonals).
const MARK_BOX = { x: 229, size: 566 };

// --- Wordmark as outlines, so the logo files don't depend on the font being installed. ---
// Glyph by glyph: opentype.js can't run this font's contextual substitutions, and the wordmark needs none.
function textOutline(font, text, size) {
  const scale = size / font.unitsPerEm;
  const glyphs = [...text].map((ch) => font.charToGlyph(ch));
  const d = [];
  const box = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };
  let x = 0;
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
    x += g.advanceWidth * scale + (i < glyphs.length - 1 ? font.getKerningValue(g, glyphs[i + 1]) * scale : 0);
  });
  const xHeight = (font.tables.os2.sxHeight / font.unitsPerEm) * size;
  return { d: d.join(' '), box, xHeight };
}

/** Horizontal lockup: mark + "xpense" in Instrument Serif italic. */
function logo(ink = COLORS.ink) {
  const M = 120; // mark height in logo units
  const gap = 34;
  const t = textOutline(serifItalic, 'xpense', 150);
  const baseline = M / 2 + t.xHeight / 2; // centre the x-height on the mark (y grows downwards)
  const top = Math.min(0, baseline + t.box.y1);
  const bottom = Math.max(M, baseline + t.box.y2);
  const width = M + gap + t.box.x2;
  const s = M / MARK_BOX.size;
  const body = `<g transform="scale(${s.toFixed(5)}) translate(${-MARK_BOX.x} ${-MARK_BOX.x})">${leaves({ ink, hatch: 30, id: 'lh' })}</g>
    <path d="${t.d}" transform="translate(${M + gap} ${baseline.toFixed(2)})" fill="${ink}"/>`;
  const h = bottom - top;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${top.toFixed(1)} ${width.toFixed(1)} ${h.toFixed(1)}" width="${width.toFixed(0)}" height="${h.toFixed(0)}">${body}</svg>`;
}

const markOnly = () => svg(leaves(), 1024, `${MARK_BOX.x} ${MARK_BOX.x} ${MARK_BOX.size} ${MARK_BOX.size}`);
const ICON_SCALE = 1.04;

// --- Vector sources ---
mkdirSync(out('assets', 'brand'), { recursive: true });
const files = {
  'assets/brand/mark.svg': markOnly(),
  'assets/brand/logo.svg': logo(),
  'assets/brand/icon.svg': svg(paperBackground() + leaves({ scale: ICON_SCALE })),
};
for (const [path, content] of Object.entries(files)) writeFileSync(out(path), content);

// --- iOS 26 Icon Composer bundle: needs and wants are separate layers on a paper fill. ---
const iconDir = out('assets', 'xpense.icon');
mkdirSync(join(iconDir, 'Assets'), { recursive: true });
writeFileSync(join(iconDir, 'Assets', 'needs.svg'), svg(leaves({ which: 'needs', scale: ICON_SCALE })));
writeFileSync(join(iconDir, 'Assets', 'wants.svg'), svg(leaves({ which: 'wants', scale: ICON_SCALE })));
const layer = (name) => ({ 'image-name': `${name}.svg`, name, position: { scale: 1, 'translation-in-points': [0, 0] } });
writeFileSync(
  join(iconDir, 'icon.json'),
  JSON.stringify(
    {
      fill: { solid: 'extended-srgb:0.96471,0.94902,0.91765,1.00000' },
      groups: [{ layers: [layer('wants'), layer('needs')], shadow: { kind: 'neutral', opacity: 0.25 }, translucency: { enabled: false, value: 0 } }],
      'supported-platforms': { circles: ['watchOS'], squares: 'shared' },
    },
    null,
    2,
  ) + '\n',
);

// --- Raster icons ---
const ANDROID_SCALE = 0.72; // keeps the leaf tips inside the adaptive-icon safe zone
const rasters = [
  { path: 'assets/images/icon.png', size: 1024, body: paperBackground() + leaves({ scale: ICON_SCALE }) },
  { path: 'assets/images/android-icon-background.png', size: 1024, body: paperBackground() },
  { path: 'assets/images/android-icon-foreground.png', size: 1024, body: leaves({ scale: ANDROID_SCALE, hatch: 44 }), transparent: true },
  { path: 'assets/images/android-icon-monochrome.png', size: 1024, body: silhouette({ scale: ANDROID_SCALE }), transparent: true },
  { path: 'assets/images/splash-icon.png', size: 1024, body: leaves({ hatch: 30 }), transparent: true },
  {
    path: 'assets/images/favicon.png',
    size: 48,
    body: `<g transform="scale(${48 / 1024})"><rect width="1024" height="1024" rx="220" fill="${COLORS.paper}"/>${leaves({ scale: 1.12, hatch: 0 })}</g>`,
  },
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
const font = (dir, file) => readFileSync(join(FONTS, dir, file)).toString('base64');
const face = (family, b64, extra = '') => `@font-face{font-family:"${family}";src:url(data:font/ttf;base64,${b64});${extra}}`;
const swatch = (name, hex, note) =>
  `<div class="sw"><div class="chip" style="background:${hex}"></div><b>${name}</b><span>${hex}</span><em>${note}</em></div>`;
const sheet = `<html><head><style>
${face('Brand Serif', font('instrument-serif', '400Regular/InstrumentSerif_400Regular.ttf'))}
${face('Brand Serif Italic', font('instrument-serif', '400Regular_Italic/InstrumentSerif_400Regular_Italic.ttf'))}
${face('Inter', font('inter', '400Regular/Inter_400Regular.ttf'))}
${face('InterSB', font('inter', '600SemiBold/Inter_600SemiBold.ttf'))}
${face('Caveat', font('caveat', '500Medium/Caveat_500Medium.ttf'))}
body{margin:0;background:#F6F2EA;color:#111;font-family:Inter;width:1400px}
.wrap{padding:56px 64px}
h1{font-family:"Brand Serif Italic";font-weight:400;font-size:64px;margin:0}
h2{font-family:InterSB;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#5E5A53;margin:44px 0 16px}
.lead{font-size:19px;color:#5E5A53;max-width:880px;line-height:1.5;margin:10px 0 0}
.row{display:flex;gap:28px;align-items:center;flex-wrap:wrap}
.card{background:#fff;padding:34px 40px;box-shadow:inset 0 0 0 1.3px #111}
.sw{display:flex;flex-direction:column;gap:4px;width:150px;font-size:14px}
.sw .chip{height:84px;border-radius:3px;margin-bottom:6px;box-shadow:inset 0 0 0 1px rgba(17,17,17,.16)}.sw span{color:#5E5A53;font-family:InterSB}.sw em{color:#716B62;font-style:normal;font-size:13px}
.legend{display:flex;gap:36px;font-family:InterSB;font-size:16px;margin-top:18px}
.legend i{display:inline-block;width:40px;height:24px;margin-right:12px;vertical-align:-6px;border-radius:2px}
.need{background:#111}.want{box-shadow:inset 0 0 0 1.2px #111;background-image:repeating-linear-gradient(-45deg,#111 0 1px,transparent 1px 5px)}
.ring{width:18px!important;height:18px!important;border-radius:50%!important;border:1.4px solid #111}
.type div{margin:8px 0}.note{font-family:Caveat;font-size:30px;color:#5E5A53}
</style></head><body><div class="wrap">
<h1>xpense</h1>
<p class="lead">A pocket sketchbook for your money: beige paper, white pages, black ink. Two leaves cross to make the X. One diagonal is <b>needs</b>, drawn in solid ink; the other is <b>wants</b>, pencil-hatched. The whole app reads in black and white.</p>

<h2>Logo</h2>
<div class="row"><div class="card">${files['assets/brand/logo.svg'].replace(/width="\d+" height="\d+"/, 'height="96"')}</div></div>
<div class="legend"><span><i class="need"></i>Needs</span><span><i class="want"></i>Wants</span><span><i class="ring"></i>Income</span></div>

<h2>App icon</h2>
<div class="row">${[220, 120, 76, 44]
  .map(
    (s) =>
      `<div style="width:${s}px;height:${s}px;border-radius:${s * 0.2237}px;overflow:hidden;box-shadow:0 0 0 1px rgba(17,17,17,.14),0 8px 24px rgba(17,17,17,.10)">${svg(
        paperBackground() + leaves({ scale: ICON_SCALE, hatch: s >= 76 ? 36 : 0, id: `i${s}` }),
        s,
      )}</div>`,
  )
  .join('')}</div>

<h2>Colour</h2>
<div class="row">${swatch('Paper', '#F6F2EA', 'the ground')}${swatch('Page', '#FFFFFF', 'cards')}${swatch('Sand', '#E7DFD0', 'bills, tracks')}
${swatch('Ink', '#111111', 'text, needs')}${swatch('Graphite', '#5E5A53', 'quiet text')}${swatch('Pencil', '#716B62', 'hints, notes')}${swatch('Alert', '#8C2F25', 'errors only')}</div>

<h2>Type</h2>
<div class="card type">
<div style="font-family:'Brand Serif';font-size:64px;line-height:1">$1,988.56</div>
<div style="font-family:'Brand Serif';font-size:34px">Where it went</div>
<div style="font-size:18px;color:#5E5A53">Inter for everything you read and tap · About $284.08 a day for the 7 days left</div>
<div class="note">Caveat, only for pencil notes in the margins</div></div>
</div></body></html>`;
mkdirSync(out('docs', 'brand'), { recursive: true });
await page.setViewportSize({ width: 1400, height: 900 });
await page.setContent(sheet, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out('docs', 'brand', 'brand-sheet.png'), fullPage: true });
await browser.close();

console.log('Brand assets written:', [...Object.keys(files), 'assets/xpense.icon', ...rasters.map((r) => r.path), 'docs/brand/brand-sheet.png'].join('\n  '));
