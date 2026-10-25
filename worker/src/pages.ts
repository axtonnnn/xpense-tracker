// The website, served by the AI server: a home page that introduces Xpense and links to the stores, plus
// the privacy policy, terms of use and support page that the App Store requires. The policy text lives in
// docs/*.md; {{TOKENS}} in it are filled from the [vars] in wrangler.toml. Fonts and screenshots are static
// files in worker/public. Everything is drawn in the app's sketchbook style: paper, white pages, black ink.
import privacyPolicy from '../../docs/privacy-policy.md';
import support from '../../docs/support.md';
import terms from '../../docs/terms.md';
import { framePaths, pen, pencilDrawing, receiptDrawing, seedOf } from '../../shared/sketch';
import { monthlyCap, trialLimit } from './entitlement';
import type { Env } from './env';
import { escapeHtml, renderMarkdown } from './markdown';

const DOCS: Record<string, string> = { '/privacy': privacyPolicy, '/terms': terms, '/support': support };
const DOC_LINKS = { 'privacy-policy.md': '/privacy', 'terms.md': '/terms', 'support.md': '/support' };

/** Marks a value that still has to be filled in; `npm run preflight` looks for it on the live pages. */
export const NOT_SET = 'NOT SET';

const HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'public, max-age=300',
  'Content-Security-Policy':
    "default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

type Setting = 'OWNER_NAME' | 'CONTACT_EMAIL' | 'GOVERNING_LAW' | 'LAST_UPDATED';
const SETTINGS: Setting[] = ['OWNER_NAME', 'CONTACT_EMAIL', 'GOVERNING_LAW', 'LAST_UPDATED'];

const isSet = (value: string | undefined): value is string => !!value?.trim() && !/REPLACE/i.test(value);
const setting = (env: Env, name: Setting) => {
  const value = env[name];
  return isSet(value) ? value.trim() : `[${NOT_SET}: ${name} in worker/wrangler.toml]`;
};

/** Names of the page settings that still need a value (reported by /health for `npm run preflight`). */
export const missingSettings = (env: Env) => SETTINGS.filter((name) => !isSet(env[name]));

function fill(markdown: string, env: Env): string {
  const email = setting(env, 'CONTACT_EMAIL');
  const values: Record<string, string> = {
    OWNER_NAME: setting(env, 'OWNER_NAME'),
    CONTACT_EMAIL: isSet(env.CONTACT_EMAIL) ? `[${email}](mailto:${email})` : email,
    GOVERNING_LAW: setting(env, 'GOVERNING_LAW'),
    LAST_UPDATED: setting(env, 'LAST_UPDATED'),
    FREE_TRIAL_SCANS: String(trialLimit(env)),
    PRO_MONTHLY_SCANS: String(monthlyCap(env, 'scan')),
    PRO_MONTHLY_CHECKS: String(monthlyCap(env, 'check')),
    PRO_MONTHLY_REVIEWS: String(monthlyCap(env, 'review')),
  };
  return markdown.replace(/\{\{([A-Z_]+)\}\}/g, (token, name: string) => values[name] ?? token);
}

// --- Drawing helpers ---

// The Xpense mark (same geometry as src/components/brand.tsx): solid needs leaves on "/", hatched wants on "\".
const LEAF = (() => {
  const [r0, R, w] = [14, 400, 86];
  const len = R - r0;
  return `M ${r0} 0 C ${r0 + len * 0.18} ${-w * 0.95} ${r0 + len * 0.62} ${-w * 1.02} ${R} 0 C ${r0 + len * 0.62} ${w * 1.02} ${r0 + len * 0.18} ${w * 0.95} ${r0} 0 Z`;
})();

function mark(size: number, id: string): string {
  const unit = size / 566;
  const hatched = size >= 48;
  const gap = 4.5 / unit;
  const leaf = (angle: number, want: boolean) =>
    `<path transform="translate(512 512) rotate(${angle})" d="${LEAF}" fill="${want ? (hatched ? `url(#${id})` : 'var(--paper)') : 'var(--ink)'}"${
      want ? ` stroke="var(--ink)" stroke-width="${(1.2 / unit).toFixed(1)}"` : ''
    }/>`;
  const defs = hatched
    ? `<defs><pattern id="${id}" patternUnits="userSpaceOnUse" width="${gap.toFixed(1)}" height="${gap.toFixed(1)}" patternTransform="rotate(45)"><line x1="${(gap / 2).toFixed(1)}" y1="0" x2="${(gap / 2).toFixed(1)}" y2="${gap.toFixed(1)}" stroke="var(--ink)" stroke-width="${(gap * 0.26).toFixed(1)}"/></pattern></defs>`
    : '';
  return `<svg width="${size}" height="${size}" viewBox="229 229 566 566" aria-hidden="true">${defs}${[-45, 135].map((a) => leaf(a, false)).join('')}${[-135, 45]
    .map((a) => leaf(a, true))
    .join('')}</svg>`;
}

/** A sketched frame over its parent (the parent needs `position: relative`). */
function frame(key: string, weight = 1.3): string {
  const [a, b] = framePaths(seedOf(key));
  return `<svg class="sk" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${a}" style="stroke-width:${weight}"/><path class="p2" d="${b}"/></svg>`;
}

function rule(key: string): string {
  return `<svg class="rule" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true"><path d="${pen(seedOf(key)).seg(0.5, 3, 99.5, 3, 0.4, 1.4)}"/></svg>`;
}

const RECEIPT = receiptDrawing();
const PENCIL = pencilDrawing([154, 214], -21);

/** The receipt-and-pencil drawing from the app's sign-in screen, with its two margin notes. */
const receiptSketch = `<svg class="drawing" viewBox="0 0 326 222" role="img" aria-label="A receipt with a pencil: milk is a need, chocolate is a want">
<defs><pattern id="rhx" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)"><line x1="2" y1="0" x2="2" y2="4" stroke="#111" stroke-width="1"/></pattern></defs>
<g transform="rotate(-4 138 104)"><path d="${RECEIPT.fill}" fill="#fff"/><path class="ink" d="${RECEIPT.edge}" stroke-width="1.4"/><path class="ink faint" d="${RECEIPT.edge2}" stroke-width=".8"/>
<text x="138" y="31" text-anchor="middle" class="tiny">GREEN VALLEY</text><path d="${RECEIPT.needs}" fill="#111"/><path d="${RECEIPT.wants}" fill="url(#rhx)" stroke="#111"/>
<path class="ink" d="${RECEIPT.rows}" stroke-width="1.1"/><path class="ink" d="${RECEIPT.dash}" stroke-dasharray="2 3"/>
<text x="82" y="179" class="tiny">TOTAL</text><text x="194" y="179" text-anchor="end" class="tiny">50.00</text></g>
<path d="${PENCIL.body}" fill="var(--paper)"/><path class="ink" d="${PENCIL.lines}" stroke-width="1.4"/><path class="ink faint" d="${PENCIL.lines2}" stroke-width=".8"/><path d="${PENCIL.lead}" fill="#111"/>
<path class="ink" d="${RECEIPT.arrows}" stroke-width="1.2"/>
<text x="226" y="22" class="hand" transform="rotate(-3 226 22)">milk: a need</text>
<text x="228" y="84" class="hand" transform="rotate(2 228 84)">chocolate:</text><text x="228" y="104" class="hand" transform="rotate(2 228 104)">a want, fine</text></svg>`;

const STYLE = `
@font-face{font-family:"Instrument Serif";src:url(/fonts/instrument-serif.woff2) format("woff2");font-display:swap}
@font-face{font-family:"Instrument Serif";font-style:italic;src:url(/fonts/instrument-serif-italic.woff2) format("woff2");font-display:swap}
@font-face{font-family:Inter;font-weight:400;src:url(/fonts/inter-400.woff2) format("woff2");font-display:swap}
@font-face{font-family:Inter;font-weight:600;src:url(/fonts/inter-600.woff2) format("woff2");font-display:swap}
@font-face{font-family:Caveat;src:url(/fonts/caveat-500.woff2) format("woff2");font-display:swap}
:root{color-scheme:light;--paper:#F6F2EA;--page:#FFFFFF;--sand:#E7DFD0;--ink:#111111;--graphite:#5E5A53;--pencil:#716B62}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.6 Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--ink);text-underline-offset:3px}a:hover{color:var(--graphite)}
.wrap{max-width:1040px;margin:0 auto;padding:0 24px}
.narrow{max-width:720px}
header.top{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:28px 0 8px}
.brand{display:inline-flex;align-items:center;gap:10px;text-decoration:none}
.word{font-family:"Instrument Serif",Georgia,serif;font-style:italic;font-size:30px;line-height:1}
nav.links{display:flex;gap:20px;font-size:15px}nav.links a{color:var(--graphite);text-decoration:none}nav.links a:hover{color:var(--ink);text-decoration:underline}
.sk{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.sk path{fill:none;stroke:var(--ink);stroke-width:1.3;stroke-linecap:round;vector-effect:non-scaling-stroke}
.sk .p2{stroke-width:.7;opacity:.4}
.rule{display:block;width:100%;height:6px;overflow:visible;margin:8px 0}
.rule path{fill:none;stroke:var(--ink);stroke-width:1;opacity:.3;vector-effect:non-scaling-stroke}
.ink{fill:none;stroke:var(--ink);stroke-linecap:round;stroke-linejoin:round}.faint{opacity:.4}
.tiny{font:600 8.5px Inter,sans-serif;letter-spacing:1.6px;fill:var(--ink)}
.hand,.note{font-family:Caveat,"Bradley Hand",cursive;color:var(--graphite)}
.hand{font-size:21px;fill:var(--graphite)}
.note{font-size:24px;line-height:1.1}
h1,h2,h3{font-family:"Instrument Serif",Georgia,serif;font-weight:400;letter-spacing:-.01em}
.hero{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:48px;align-items:center;padding:48px 0 32px}
.hero h1{font-size:clamp(46px,7vw,76px);line-height:1;margin:6px 0 18px}
.lead{font-size:19px;line-height:1.55;color:var(--graphite);max-width:520px;margin:0}
.drawing{width:100%;height:auto;max-width:440px;display:block;margin:0 auto}
.stores{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px;align-items:center}
.store{display:inline-flex;align-items:center;gap:10px;height:52px;padding:0 22px;border-radius:2px;background:var(--ink);color:#fff;text-decoration:none;font-weight:600}
.store:hover{color:#fff;opacity:.88}
.store.outline{position:relative;background:transparent;color:var(--ink)}.store.outline:hover{color:var(--ink)}
.stamp{display:inline-block;transform:rotate(-4deg);border:1.4px solid var(--ink);border-radius:3px;padding:2px 12px;font:24px/1.1 Caveat,cursive}
.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;margin:24px 0 8px}
.card{position:relative;background:var(--page);padding:26px 24px}
.card h3{font-size:28px;line-height:1.1;margin:10px 0 8px}
.card p{margin:0;color:var(--graphite)}
.num{font-family:"Instrument Serif",Georgia,serif;font-size:22px;color:var(--pencil)}
section{padding:40px 0}
section>h2{font-size:clamp(34px,5vw,48px);line-height:1.05;margin:0 0 6px}
.legend{display:flex;flex-wrap:wrap;gap:28px;margin-top:20px}
.legend div{display:flex;align-items:center;gap:12px}
.sw{width:42px;height:26px;border-radius:2px}
.need{background:var(--ink)}
.want{box-shadow:inset 0 0 0 1.2px var(--ink);background-image:repeating-linear-gradient(-45deg,var(--ink) 0 1px,transparent 1px 5px)}
.ring{width:16px;height:16px;border-radius:50%;border:1.4px solid var(--ink)}
.split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px;margin-top:20px}
.phones{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:28px;margin-top:24px}
.phone{position:relative;margin:0;background:var(--page);padding:12px 12px 8px}
.phone img{display:block;width:100%;height:auto;background:var(--paper)}
.phone figcaption{display:block;text-align:center;font-size:22px;padding-top:6px}
.download{text-align:center}.download .lead{margin:0 auto}.download .stores{justify-content:center}
.plan ul{margin:12px 0 0;padding-left:20px;color:var(--graphite)}.plan li{margin:4px 0}
.plan h3{font-size:30px;margin:0}
.devices{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
.pill{display:inline-flex;align-items:center;height:36px;padding:0 14px;border-radius:999px;box-shadow:inset 0 0 0 1.2px var(--ink);font-size:14px}
main.doc{padding:8px 0 40px}
main.doc h1{font-size:clamp(40px,6vw,56px);line-height:1.05;margin:28px 0 8px}
main.doc h2{font-size:30px;line-height:1.15;margin:36px 0 6px}
main.doc h3{font-size:22px;margin:24px 0 4px}
main.doc p,main.doc li{color:#2b2925}
mark{background:#FDECC8;color:#5A3A00;padding:0 4px;border-radius:2px}
.table{overflow-x:auto;margin:16px 0;position:relative;background:var(--page);padding:6px 10px}
table{border-collapse:collapse;width:100%}
th,td{text-align:left;vertical-align:top;padding:10px 12px;border-bottom:1px solid rgba(17,17,17,.12);font-size:15px}
th{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:var(--graphite)}
tr:last-child td{border-bottom:0}
footer.bottom{padding:24px 0 48px;color:var(--pencil);font-size:14px}footer.bottom a{color:var(--graphite)}
@media (max-width:820px){.hero{grid-template-columns:1fr;gap:24px;padding-top:24px}.cards,.split{grid-template-columns:1fr}nav.links{display:none}
.phones{grid-template-columns:repeat(3,72%);overflow-x:auto;scroll-snap-type:x mandatory;margin:24px -24px 0;padding:0 24px 8px}.phone{scroll-snap-align:center}}`;

function page(title: string, description: string, body: string, env: Env): string {
  const owner = isSet(env.OWNER_NAME) ? ` · © ${new Date().getUTCFullYear()} ${escapeHtml(env.OWNER_NAME.trim())}` : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="theme-color" content="#F6F2EA">
<link rel="preload" href="/fonts/instrument-serif.woff2" as="font" type="font/woff2" crossorigin>
<style>${STYLE}</style></head>
<body><div class="wrap">
<header class="top"><a class="brand" href="/" aria-label="Xpense home">${mark(34, 'hm')}<span class="word">xpense</span></a>
<nav class="links" aria-label="Site"><a href="/#how">How it works</a><a href="/#pro">Pro</a><a href="/#download">Download</a><a href="/support">Help</a></nav></header>
${body}
<footer class="bottom">${rule('footer')}<a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/support">Support</a>${owner}</footer>
</div></body></html>`;
}

function storeButtons(env: Env): string {
  const https = (u: string | undefined) => (u && /^https:\/\//.test(u.trim()) ? u.trim() : null);
  const apple = https(env.APP_STORE_URL);
  const play = https(env.PLAY_STORE_URL);
  const appleIcon =
    '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M16.37 12.6c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.76 2.27-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.37-3.68zM14.1 5.86c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.61-2.66 1.37-.58.67-1.09 1.75-.96 2.79 1.02.08 2.05-.52 2.68-1.27z"/></svg>';
  const buttons = [
    apple ? `<a class="store" href="${escapeHtml(apple)}">${appleIcon}Download on the App Store</a>` : '',
    play ? `<a class="store outline" href="${escapeHtml(play)}">${frame('play-button')}Get it on Google Play</a>` : '',
  ].join('');
  return buttons || '<span class="stamp">coming soon to the App Store</span>';
}

function home(env: Env): string {
  const trial = trialLimit(env);
  const scans = monthlyCap(env, 'scan');
  const body = `
<main>
<div class="hero">
  <div>
    <div class="note">a pocket sketchbook for your money</div>
    <h1>Spend on what matters.</h1>
    <p class="lead">Your first paycheck, your first rent, your first real budget. Xpense helps you keep money for what you need and spend less on what you don’t. Snap a receipt and AI sorts every line into needs and wants.</p>
    <div class="stores">${storeButtons(env)}</div>
  </div>
  <div>${receiptSketch}</div>
</div>

<section id="how">
  <h2>How it works</h2>
  <div class="cards">
    <div class="card">${frame('how-1')}<span class="num">1</span><h3>Snap a receipt</h3><p>Take a photo of a receipt or bill. The AI types in every item, the total and the date, and marks each line as a need or a want.</p></div>
    <div class="card">${frame('how-2')}<span class="num">2</span><h3>See what’s safe</h3><p>After rent, bills still due and your savings goal, Xpense shows what’s left to spend this month, and about how much a day.</p></div>
    <div class="card">${frame('how-3')}<span class="num">3</span><h3>Pause before you buy</h3><p>Ask “should I buy this?” and see it in hours of your work, against your own budget, with a kind second opinion.</p></div>
  </div>
</section>

<section id="look">
  <h2>A look inside</h2>
  <div class="phones">
    <figure class="phone">${frame('shot-1')}<img src="/screens/dashboard.jpg" width="390" height="844" loading="lazy" alt="The dashboard: what’s safe to spend this month, and a chart of needs and wants by week"><figcaption class="hand">what’s safe to spend</figcaption></figure>
    <figure class="phone">${frame('shot-2')}<img src="/screens/review.jpg" width="390" height="844" loading="lazy" alt="A scanned receipt, every line sorted into needs and wants"><figcaption class="hand">a receipt, sorted for you</figcaption></figure>
    <figure class="phone">${frame('shot-3')}<img src="/screens/history.jpg" width="390" height="844" loading="lazy" alt="History: every entry by day, like a ledger"><figcaption class="hand">every day, like a ledger</figcaption></figure>
  </div>
</section>

<section>
  <h2>Drawn in black and white</h2>
  <p class="lead">No colour-coded guilt. Needs are solid ink, wants are pencil hatching, money coming in is an open ring.</p>
  <div class="legend">
    <div><span class="sw need"></span><span><b>Needs</b><br><span class="hand" style="font-size:20px">rent, groceries, the bus</span></span></div>
    <div><span class="sw want"></span><span><b>Wants</b><br><span class="hand" style="font-size:20px">takeaway, games, the new hoodie</span></span></div>
    <div><span class="ring"></span><span><b>Income</b><br><span class="hand" style="font-size:20px">paychecks, side gigs, allowance</span></span></div>
  </div>
</section>

<section>
  <h2>On all your devices</h2>
  <p class="lead">Sign in with Apple or an email code, and your budget is the same on your iPhone, iPad and Mac. It’s private to your account: no bank login, and your data is never sold.</p>
  <div class="devices"><span class="pill">iPhone</span><span class="pill">iPad</span><span class="pill">Mac</span><span class="pill">Android</span></div>
</section>

<section id="pro">
  <h2>Free, with Pro when you want it</h2>
  <div class="split">
    <div class="card plan">${frame('plan-free')}<h3>Free</h3><ul><li>Track spending and income</li><li>Needs vs wants, safe to spend, history</li><li>Up to 3 repeating bills and paychecks</li><li>${trial} free AI receipt scans</li></ul></div>
    <div class="card plan">${frame('plan-pro', 2)}<h3>Xpense Pro</h3><ul><li>Up to ${scans} AI receipt scans a month</li><li>“Should I buy this?” against your budget</li><li>A short monthly review with three tips</li><li>6-month and yearly trends, CSV export</li></ul></div>
  </div>
</section>

<section id="download" class="download">
  <h2>Get Xpense</h2>
  <p class="lead">Free to download. Sign in with Apple or your email, and start with what you spent today.</p>
  <div class="stores">${storeButtons(env)}</div>
</section>
</main>`;
  return page('Xpense: spend on what matters', 'A simple budget app for your first paychecks. Snap receipts, see what’s safe to spend, and keep money for what you need.', body, env);
}

/** The HTML response for a public page, or null when the path isn't one. */
export function pageResponse(pathname: string, method: string, env: Env): Response | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  let html: string;
  if (path === '/') {
    html = home(env);
  } else if (DOCS[path]) {
    const markdown = fill(DOCS[path], env);
    const title = /^#\s+(.+)$/m.exec(markdown)?.[1] ?? 'Xpense';
    const body = renderMarkdown(markdown, DOC_LINKS)
      .replace(new RegExp(`\\[${NOT_SET}: [^\\]]+\\]`, 'g'), (m) => `<mark>${m}</mark>`)
      .replace(/<div class="table">/g, () => `<div class="table">${frame(`table-${path}`)}`);
    html = page(title, `${title}.`, `<main class="doc narrow">${body}</main>`, env);
  } else {
    return null;
  }
  return new Response(method === 'HEAD' ? null : html, { headers: HEADERS });
}
