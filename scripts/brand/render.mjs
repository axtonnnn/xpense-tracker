// Regenerates every logo and icon file (app, website) and the brand sheet from scripts/brand/mark.mjs and
// the Geist and Instrument Serif fonts.
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
// The mark fills about 65% of the icon tile (566 × 1.18 of 1024), as in the Gallery icon design.
const ICON_SCALE = 1.18;

// --- Vector sources ---
mkdirSync(out('assets', 'brand'), { recursive: true });
const files = {
  'assets/brand/mark.svg': markOnly(),
  'assets/brand/logo.svg': logo(),
  'assets/brand/icon.svg': svg(paperBackground() + leaves({ scale: ICON_SCALE })),
  // Browser tabs: the paper tile with outlined wants, edged thick enough to read at 16 px.
  'worker/public/favicon.svg': svg(`<rect width="1024" height="1024" rx="220" fill="${COLORS.paper}"/>${leaves({ scale: 1.12, hatch: 0, outline: 56 })}`, 32),
};
for (const [path, content] of Object.entries(files)) writeFileSync(out(path), content);

// --- iOS 26 Icon Composer bundle: needs and wants are separate layers on a paper fill. ---
const iconDir = out('assets', 'xpense.icon');
mkdirSync(join(iconDir, 'Assets'), { recursive: true });
writeFileSync(join(iconDir, 'Assets', 'needs.svg'), svg(leaves({ which: 'needs', scale: ICON_SCALE })));
writeFileSync(join(iconDir, 'Assets', 'wants.svg'), svg(leaves({ which: 'wants', scale: ICON_SCALE })));
const layer = (name) => ({ 'image-name': `${name}.svg`, name, position: { scale: 1, 'translation-in-points': [0, 0] } });
const srgb = (hex) => [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(5)).join(',');
writeFileSync(
  join(iconDir, 'icon.json'),
  JSON.stringify(
    {
      fill: { solid: `extended-srgb:${srgb(COLORS.paper)},1.00000` },
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
    body: `<g transform="scale(${48 / 1024})"><rect width="1024" height="1024" rx="220" fill="${COLORS.paper}"/>${leaves({ scale: 1.12, hatch: 0, outline: 40 })}</g>`,
  },
  // The website's icon when someone adds it to their home screen (iOS rounds the corners itself).
  { path: 'worker/public/apple-touch-icon.png', size: 180, body: `<g transform="scale(${180 / 1024})">${paperBackground()}${leaves({ scale: ICON_SCALE })}</g>` },
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

// --- Brand sheet (docs/brand/brand-sheet.png), in the Gallery style ---
const font = (dir, file) => readFileSync(join(FONTS, dir, file)).toString('base64');
const face = (family, b64, weight = 400, style = 'normal') =>
  `@font-face{font-family:"${family}";font-weight:${weight};font-style:${style};src:url(data:font/ttf;base64,${b64})}`;
const swatch = (name, hex, note) =>
  `<div class="sw"><div class="chip" style="background:${hex}"></div><b>${name}</b><span>${hex}</span><em>${note}</em></div>`;
const key = (cls, label) => `<span class="key"><i class="${cls}"></i>${label}</span>`;
const section = (index, title, body) => `<section><span class="index">${index}</span><h2>${title}</h2>${body}</section>`;
const tile = (s) =>
  `<div style="width:${s}px;height:${s}px;border-radius:${s * 0.2237}px;overflow:hidden;box-shadow:inset 0 0 0 1px #D9D7D0">${svg(
    paperBackground() + leaves({ scale: ICON_SCALE, hatch: s >= 76 ? 36 : 0, outline: s >= 76 ? 16 : 40, id: `i${s}` }),
    s,
  )}</div>`;
const sheet = `<html><head><style>
${face('Geist', font('geist', '200ExtraLight/Geist_200ExtraLight.ttf'), 200)}
${face('Geist', font('geist', '300Light/Geist_300Light.ttf'), 300)}
${face('Geist', font('geist', '400Regular/Geist_400Regular.ttf'), 400)}
${face('Geist', font('geist', '500Medium/Geist_500Medium.ttf'), 500)}
${face('Geist Mono', font('geist-mono', '400Regular/GeistMono_400Regular.ttf'))}
${face('Instrument Serif', font('instrument-serif', '400Regular_Italic/InstrumentSerif_400Regular_Italic.ttf'), 400, 'italic')}
*{box-sizing:border-box}
body{margin:0;background:#F4F3EF;color:#111;font-family:Geist;width:1400px;-webkit-font-smoothing:antialiased}
.wrap{padding:64px 72px 72px}
.lead{font-weight:300;font-size:22px;line-height:32px;letter-spacing:-.02em;color:#6B6A66;max-width:900px;margin:28px 0 0}
section{margin-top:56px;padding-top:24px;border-top:1px solid #D9D7D0}
.index{font-family:"Geist Mono";font-size:12px;color:#6B6A66}
h2{margin:8px 0 24px;font-weight:300;font-size:40px;line-height:44px;letter-spacing:-1.4px}
.row{display:flex;gap:32px;align-items:flex-end;flex-wrap:wrap}
.card{background:#fff;padding:36px 44px;border:1px solid #D9D7D0}
.sw{display:flex;flex-direction:column;gap:4px;width:136px;font-size:14px}
.sw .chip{height:84px;margin-bottom:8px;box-shadow:inset 0 0 0 1px #D9D7D0}.sw span{font-family:"Geist Mono";font-size:12px;color:#6B6A66}.sw em{color:#6B6A66;font-style:normal;font-size:13px}
.keys{display:flex;gap:36px;flex-wrap:wrap;font-size:15px}
.key{display:flex;align-items:center;gap:12px}
.key i{display:inline-block;width:44px;height:20px;border:1px solid #111}
.need{background:#111}.want{background:repeating-linear-gradient(-45deg,#111 0 1px,#fff 1px 4px)}
.bills{background-color:#fff;background-image:radial-gradient(#111 .8px,transparent 1.1px);background-size:3px 3px}
.savings{background:#CFCCC4}.left{background:#fff}
.key i.ring{width:16px;height:16px;border-radius:50%;border:1.5px solid #111}.key i.planned{width:16px;height:16px;border-radius:50%;border:1.5px dashed #111}
.type div{margin:0 0 18px}
.type small{display:block;font-family:"Geist Mono";font-size:11px;color:#6B6A66;margin-bottom:6px}
</style></head><body><div class="wrap">
${files['assets/brand/logo.svg'].replace(/width="\d+" height="\d+"/, 'height="72"')}
<p class="lead">A gallery for your money: bone paper, white pages, black ink and square corners, with type that does the work. Two leaves cross to make the X. One diagonal is needs, in solid ink; the other is wants, hatched. Nothing depends on colour.</p>
${section('01', 'Logo', `<div class="row"><div class="card">${files['assets/brand/logo.svg'].replace(/width="\d+" height="\d+"/, 'height="88"')}</div>
<div class="card">${svg(leaves({ id: 'm96' }), 96, '229 229 566 566')}</div><div class="card">${svg(leaves({ hatch: 0, outline: 28 }), 32, '229 229 566 566')}</div></div>`)}
${section('02', 'App icon', `<div class="row">${[220, 120, 76, 44].map(tile).join('')}</div>`)}
${section(
  '03',
  'Colour',
  `<div class="row">${swatch('Paper', '#F4F3EF', 'the ground')}${swatch('Page', '#FFFFFF', 'cards, sheets')}${swatch('Ink', '#111111', 'text, needs')}${swatch(
    'Grey',
    '#6B6A66',
    'quiet text',
  )}${swatch('Rule', '#D9D7D0', 'section lines')}${swatch('Stone', '#CFCCC4', 'savings')}${swatch('Band', '#ECEAE4', 'chart selection')}${swatch(
    'Alert',
    '#8C2F25',
    'errors only',
  )}</div>`,
)}
${section(
  '04',
  'Type',
  `<div class="card type">
<div><small>hero · Geist ExtraLight 96</small><span style="font-weight:200;font-size:96px;line-height:96px;letter-spacing:-4.8px">$728</span></div>
<div><small>display · Geist Light 60</small><span style="font-weight:300;font-size:60px;line-height:60px;letter-spacing:-2.7px">October</span></div>
<div><small>headline · Geist Light 40</small><span style="font-weight:300;font-size:40px;letter-spacing:-1.4px">Where it went</span></div>
<div><small>body · Geist Regular 15</small><span style="font-size:15px;line-height:22px">About $104.03 a day for the 7 days left</span></div>
<div><small>figures · Geist Mono 14</small><span style="font-family:'Geist Mono';font-size:14px">−46.34   +680.00</span></div>
<div style="margin:0"><small>wordmark only · Instrument Serif Italic</small><span style="font-family:'Instrument Serif';font-style:italic;font-size:44px">xpense</span></div></div>`,
)}
${section(
  '05',
  'How money is drawn',
  `<div class="keys">${key('need', 'Needs')}${key('want', 'Wants')}${key('bills', 'Bills still due')}${key('savings', 'Savings')}${key('left', 'Left to spend')}${key(
    'ring',
    'Income',
  )}${key('planned', 'Planned')}</div>`,
)}
</div></body></html>`;
mkdirSync(out('docs', 'brand'), { recursive: true });
await page.setViewportSize({ width: 1400, height: 900 });
await page.setContent(sheet, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out('docs', 'brand', 'brand-sheet.png'), fullPage: true });
await browser.close();

console.log('Brand assets written:', [...Object.keys(files), 'assets/xpense.icon', ...rasters.map((r) => r.path), 'docs/brand/brand-sheet.png'].join('\n  '));
