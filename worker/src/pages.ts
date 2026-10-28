// The website, served by the AI server: a home page that introduces Xpense and links to the stores, plus
// the privacy policy, terms of use and support page that the App Store requires. The policy text lives in
// docs/*.md; {{TOKENS}} in it are filled from the [vars] in wrangler.toml. Fonts and icons are static files
// in worker/public. Everything is in the app's Gallery style: bone paper, black ink, square corners.
import privacyPolicy from '../../docs/privacy-policy.md';
import support from '../../docs/support.md';
import terms from '../../docs/terms.md';
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

// The Xpense mark (same geometry as src/components/brand.tsx): solid needs leaves on "/", wants on "\",
// hatched at large sizes and outlined below 48 px.
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
      want ? ` stroke="var(--ink)" stroke-width="${(1.6 / unit).toFixed(1)}"` : ''
    }/>`;
  const defs = hatched
    ? `<defs><pattern id="${id}" patternUnits="userSpaceOnUse" width="${gap.toFixed(1)}" height="${gap.toFixed(1)}" patternTransform="rotate(45)"><line x1="${(gap / 2).toFixed(1)}" y1="0" x2="${(gap / 2).toFixed(1)}" y2="${gap.toFixed(1)}" stroke="var(--ink)" stroke-width="${(gap * 0.26).toFixed(1)}"/></pattern></defs>`
    : '';
  return `<svg width="${size}" height="${size}" viewBox="229 229 566 566" aria-hidden="true">${defs}${[-45, 135].map((a) => leaf(a, false)).join('')}${[-135, 45]
    .map((a) => leaf(a, true))
    .join('')}</svg>`;
}

const APPLE = '<svg width="16" height="19" viewBox="5 3 15 19" aria-hidden="true"><path fill="#fff" d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.6 1.1 8.75.73 1.05 1.6 2.24 2.73 2.2 1.1-.05 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.83-1.22 1.18-2.41 1.2-2.47-.03-.01-2.3-.88-2.32-3.5zM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.65-1.05 1.69-.92 2.68.97.08 1.96-.49 2.56-1.23z"/></svg>';

const STYLE = `
@font-face{font-family:Geist;font-weight:200;src:url(/fonts/geist-200.woff2) format("woff2");font-display:swap}
@font-face{font-family:Geist;font-weight:300;src:url(/fonts/geist-300.woff2) format("woff2");font-display:swap}
@font-face{font-family:Geist;font-weight:400;src:url(/fonts/geist-400.woff2) format("woff2");font-display:swap}
@font-face{font-family:Geist;font-weight:500;src:url(/fonts/geist-500.woff2) format("woff2");font-display:swap}
@font-face{font-family:"Geist Mono";font-weight:400;src:url(/fonts/geist-mono-400.woff2) format("woff2");font-display:swap}
@font-face{font-family:"Instrument Serif";font-style:italic;src:url(/fonts/instrument-serif-italic.woff2) format("woff2");font-display:swap}
:root{color-scheme:light;--paper:#F4F3EF;--page:#FFFFFF;--ink:#111111;--grey:#6B6A66;--rule:#D9D7D0;--line:#E4E2DC;--stone:#CFCCC4}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font:400 16px/1.5 Geist,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--ink);text-underline-offset:4px}a:hover{color:var(--grey)}
.wrap{max-width:1200px;margin:0 auto;padding:0 clamp(16px,4vw,48px)}
.mono{font-family:"Geist Mono",ui-monospace,monospace}
.quiet{color:var(--grey)}
header.top{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:16px;padding:28px 0;border-bottom:1px solid var(--rule)}
.brand{display:inline-flex;align-items:center;gap:8px;text-decoration:none}
.word{font-family:"Instrument Serif",Georgia,serif;font-style:italic;font-size:30px;line-height:30px}
nav.links{display:flex;flex-wrap:wrap;align-items:center;gap:24px;font-size:15px}
nav.links a{text-decoration:none}nav.links a:hover{text-decoration:underline}
.btn{height:52px;padding:0 22px;display:inline-flex;align-items:center;gap:10px;background:var(--ink);color:#fff;font-size:15px;font-weight:500;text-decoration:none;transition:transform .12s cubic-bezier(.2,0,0,1)}
.btn:hover{color:#fff}.btn:active{transform:scale(.97)}
.btn.small{height:40px;padding:0 16px;gap:8px}
.btn.outline{background:transparent;color:var(--ink);border:1px solid var(--ink)}.btn.outline:hover{color:var(--ink)}
.soon{display:inline-flex;align-items:center;height:52px;padding:0 22px;border:1px dashed var(--ink);font-size:15px}
section{padding:clamp(40px,6vw,72px) 0;border-top:1px solid var(--rule)}
section.intro{border-top:0;padding:clamp(56px,10vw,120px) 0 clamp(40px,6vw,72px)}
.eyebrow{font-family:"Geist Mono",monospace;font-size:12px;line-height:16px;color:var(--grey)}
h1{margin:16px 0 0;max-width:980px;font-weight:200;font-size:clamp(52px,9vw,128px);line-height:.95;letter-spacing:-.055em}
h2{margin:0;font-weight:300;font-size:clamp(36px,5vw,60px);line-height:1.05;letter-spacing:-.045em}
h3{margin:10px 0 0;font-weight:400;font-size:24px;line-height:30px;letter-spacing:-.02em}
.lead{margin:28px 0 0;max-width:560px;font-size:clamp(17px,1.6vw,20px);line-height:1.5;color:var(--grey)}
.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:36px}
.bar{display:flex;height:20px;border:1px solid var(--ink);background:var(--page)}
.bar span{display:block;transform-origin:left;animation:grow .7s cubic-bezier(.2,0,0,1) both}
.bar span:nth-child(2){animation-delay:.06s}.bar span:nth-child(3){animation-delay:.12s}.bar span:nth-child(4){animation-delay:.18s}
@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.need{background:var(--ink)}
.want{background:repeating-linear-gradient(-45deg,var(--ink) 0 1px,#fff 1px 4px)}
.bills{background-color:#fff;background-image:radial-gradient(var(--ink) .8px,transparent 1.1px);background-size:3px 3px}
.savings{background:var(--stone)}
.ticks{position:relative;height:24px;font-family:"Geist Mono",monospace;font-size:11px;line-height:14px;color:var(--grey)}
.ticks span{position:absolute;top:0}.ticks i{position:absolute;bottom:0;height:8px;border-left:1px solid var(--ink)}
.phones{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:clamp(24px,4vw,48px)}
figure{margin:0}
.phone{aspect-ratio:390/600;padding:28px 22px;border:1px solid var(--ink);border-radius:28px;background:var(--paper);display:flex;flex-direction:column;overflow:hidden}
figcaption{margin-top:14px;font-size:15px;line-height:22px}
.p-xs{font-size:10px;color:var(--grey)}.p-s{font-size:11px;color:var(--grey)}
.p-title{font-weight:300;font-size:34px;line-height:36px;letter-spacing:-.04em}
.p-big{font-weight:200;font-size:56px;line-height:58px;letter-spacing:-.05em}
.p-mid{font-weight:200;font-size:44px;line-height:46px;letter-spacing:-.05em}
.p-name{font-weight:300;font-size:22px;line-height:26px;letter-spacing:-.03em}
.p-bar{display:flex;height:8px;border:1px solid var(--ink);background:#fff}
.p-row{display:flex;justify-content:space-between;align-items:center;padding-bottom:8px;border-bottom:1px solid var(--line);font-size:12px}
.tag{padding:2px 6px;background:var(--ink);color:#fff;font-size:10px}.tag.o{padding:1px 5px;background:transparent;color:var(--ink);border:1px solid var(--ink)}
.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:32px;margin-top:40px}
.steps>div{padding-top:18px;border-top:1px solid var(--ink)}
.steps p{margin:10px 0 0;font-size:15px;line-height:22px;color:var(--grey)}
.plans{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:32px;margin-top:40px}
.plan{padding:28px;border:1px solid var(--rule);background:var(--page)}.plan.pro{border:2px solid var(--ink)}
.plan h3{margin:0}
.plan ul{margin:18px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:10px;font-size:15px;line-height:22px}
.plan li{display:grid;grid-template-columns:20px 1fr}.plan li::before{content:"";width:6px;height:6px;margin-top:8px;background:var(--ink)}
.private{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:32px}
.private ul{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:14px;font-size:17px;line-height:26px}
.private li{padding-bottom:14px;border-bottom:1px solid var(--rule)}.private li:last-child{border:0;padding:0}
section.get{text-align:center;border-top:1px solid var(--ink);padding:clamp(56px,8vw,96px) 0}
section.get h2{font-weight:200;font-size:clamp(44px,7vw,96px);line-height:1;letter-spacing:-.05em}
section.get .actions{justify-content:center;margin-top:32px}
footer.bottom{display:flex;flex-wrap:wrap;justify-content:space-between;gap:16px;padding:28px 0 40px;border-top:1px solid var(--rule);font-size:13px;line-height:18px;color:var(--grey)}
footer.bottom nav{display:flex;gap:20px}footer.bottom a{color:var(--grey)}
main.doc{max-width:720px;padding:8px 0 56px}
main.doc h1{font-weight:300;font-size:clamp(40px,6vw,60px);line-height:1.02;letter-spacing:-.045em;margin:40px 0 12px}
main.doc h2{font-weight:400;font-size:24px;line-height:30px;letter-spacing:-.02em;margin:40px 0 8px;padding-top:24px;border-top:1px solid var(--rule)}
main.doc h3{font-weight:500;font-size:17px;margin:24px 0 4px}
main.doc p,main.doc li{line-height:1.6}
mark{background:var(--ink);color:#fff;padding:0 4px}
.table{overflow-x:auto;margin:16px 0;border-top:1px solid var(--ink)}
table{border-collapse:collapse;width:100%}
th,td{text-align:left;vertical-align:top;padding:10px 12px 10px 0;border-bottom:1px solid var(--line);font-size:15px}
th{font-family:"Geist Mono",monospace;font-weight:400;font-size:11px;color:var(--grey)}
@media (max-width:640px){.phone{aspect-ratio:auto}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}`;

function page(title: string, description: string, body: string, env: Env): string {
  const owner = isSet(env.OWNER_NAME) ? ` · © ${new Date().getUTCFullYear()} ${escapeHtml(env.OWNER_NAME.trim())}` : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="theme-color" content="#F4F3EF">
<link rel="preload" href="/fonts/geist-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/geist-200.woff2" as="font" type="font/woff2" crossorigin>
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<style>${STYLE}</style></head>
<body><div class="wrap">
<header class="top"><a class="brand" href="/" aria-label="Xpense home">${mark(26, 'hm')}<span class="word">xpense</span></a>
<nav class="links" aria-label="Site"><a href="/#how">How it works</a><a href="/#pro">Pro</a><a href="/support">Support</a><a class="btn small" href="/#get">Get Xpense</a></nav></header>
${body}
<footer class="bottom"><span>Xpense · budgeting suggestions, not financial advice${owner}</span><nav aria-label="Legal"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/support">Support</a></nav></footer>
</div></body></html>`;
}

const https = (u: string | undefined) => (u && /^https:\/\//.test(u.trim()) ? u.trim() : null);

function storeButtons(env: Env): string {
  const apple = https(env.APP_STORE_URL);
  const play = https(env.PLAY_STORE_URL);
  const buttons = [
    apple ? `<a class="btn" href="${escapeHtml(apple)}">${APPLE}Download on the App Store</a>` : '',
    play ? `<a class="btn outline" href="${escapeHtml(play)}">Get it on Google Play</a>` : '',
  ].join('');
  return buttons || '<span class="soon">Xpense is coming soon to the App Store</span>';
}

/** Three phones drawn in HTML: what's safe to spend, a sorted receipt, the history. */
const PHONES = `<div class="phones">
<figure><div class="phone" aria-hidden="true">
<span class="p-s">Sunday evening, Sam</span><span class="p-title" style="margin-top:6px">October</span>
<span class="p-xs" style="margin-top:26px">Safe to spend</span><span class="p-big" style="margin-top:2px">$728</span>
<span class="p-bar" style="margin-top:16px"><span class="need" style="width:55%"></span><span class="want" style="width:6%"></span><span class="savings" style="width:12%"></span></span>
<span style="margin-top:26px;border-top:1px solid var(--rule)"></span><span style="margin-top:14px;font-size:13px">Saving for a laptop</span>
<span class="p-name" style="margin-top:6px">$420 <span class="p-s">of $1,200</span></span>
<span class="p-bar" style="margin-top:8px"><span class="savings" style="width:35%;border-right:1px solid var(--ink)"></span></span>
<span style="margin-top:22px;border-top:1px solid var(--rule)"></span><span class="p-xs" style="margin-top:12px">Recent</span>
<span class="p-row" style="margin-top:8px"><span>Corner Café</span><span class="mono">−5.67</span></span>
<span class="p-row" style="margin-top:8px"><span>Green Valley Market</span><span class="mono">−46.34</span></span>
</div><figcaption>What’s safe to spend, after rent, bills and saving.</figcaption></figure>
<figure><div class="phone" aria-hidden="true" style="gap:10px">
<span class="p-name">Green Valley Market</span><span class="p-mid">$46.34</span>
<span class="p-bar"><span class="need" style="width:74%"></span><span class="want" style="flex:1"></span></span>
<span class="p-row" style="margin-top:6px"><span>Whole milk</span><span class="tag">Need</span></span>
<span class="p-row"><span>Chicken breast</span><span class="tag">Need</span></span>
<span class="p-row"><span>Brown rice</span><span class="tag">Need</span></span>
<span class="p-row"><span>Craft soda</span><span class="tag o">Want</span></span>
<span class="p-row"><span>Chocolate bar</span><span class="tag o">Want</span></span>
<span class="p-row"><span>Paper towels</span><span class="tag">Need</span></span>
<span class="p-xs" style="margin-top:4px">Tax is shared between needs and wants.</span>
</div><figcaption>A receipt, typed in and sorted for you.</figcaption></figure>
<figure><div class="phone" aria-hidden="true" style="gap:10px">
<span class="p-title">History</span><span class="p-xs" style="margin-top:6px">Saturday 24</span>
<span class="p-row"><span>Corner Café</span><span class="mono">−5.67</span></span>
<span class="p-row"><span>Green Valley Market</span><span class="mono">−46.34</span></span>
<span class="p-xs" style="margin-top:4px">Friday 23</span>
<span class="p-row"><span>Paycheck</span><span class="mono">+680.00</span></span>
<span class="p-row"><span>Luigi’s Pizza</span><span class="mono">−18.75</span></span>
<span class="p-xs" style="margin-top:4px">Monday 19</span>
<span class="p-row"><span>Bus pass</span><span class="mono">−30.00</span></span>
<span class="p-row"><span>Corner Café</span><span class="mono">−4.85</span></span>
</div><figcaption>Every day, written down like a ledger.</figcaption></figure>
</div>`;

function home(env: Env): string {
  const trial = trialLimit(env);
  const scans = monthlyCap(env, 'scan');
  const prices = env.PRO_PRICES?.trim();
  const devices = https(env.PLAY_STORE_URL) ? 'iPhone, iPad and Mac with Apple silicon. Android too.' : 'For iPhone, iPad and Mac with Apple silicon.';
  const body = `
<main>
<section class="intro" aria-label="Introduction">
  <span class="eyebrow">A budget for your first paychecks</span>
  <h1>Spend on what matters.</h1>
  <p class="lead">Xpense shows what’s safe to spend after rent, bills and saving. Snap a receipt and the AI types it in, every line sorted into a need or a want.</p>
  <div class="actions">${storeButtons(env)}</div>
  <div aria-hidden="true" style="margin-top:clamp(48px,8vw,96px)">
    <div class="ticks"><span style="left:0">needs 55%</span><span style="left:55%">wants 5%</span><span style="left:73%">left 27%</span>
      <i style="left:0"></i><i style="left:54.56%"></i><i style="left:59.92%"></i><i style="left:73.23%"></i><i style="right:0"></i></div>
    <div class="bar"><span class="need" style="width:54.56%"></span><span class="want" style="width:5.36%"></span><span class="bills" style="width:2.28%"></span><span class="savings" style="width:11.03%"></span></div>
  </div>
</section>

<section aria-label="A look inside">${PHONES}</section>

<section id="how" aria-label="How it works">
  <h2>How it works</h2>
  <div class="steps">
    <div><span class="mono quiet" style="font-size:12px">01</span><h3>Tell it your pay</h3><p>Weekly shifts or a monthly salary. Add rent and bills once, and they repeat on their own.</p></div>
    <div><span class="mono quiet" style="font-size:12px">02</span><h3>Snap your receipts</h3><p>The AI reads every line and sorts it into needs and wants. You check it and save.</p></div>
    <div><span class="mono quiet" style="font-size:12px">03</span><h3>Know what’s safe</h3><p>One number for what you can still spend this month, and how close you are to what you’re saving for.</p></div>
  </div>
</section>

<section id="pro" aria-label="Free and Pro">
  <h2>Free, with Pro when you want it</h2>
  <div class="plans">
    <div class="plan"><h3>Free</h3><ul><li>Expenses, income, history and search</li><li>What’s safe to spend, and a savings goal</li><li>Weekly and monthly charts</li><li>Up to 3 repeating bills or paychecks</li><li>${trial} free AI receipt scans</li></ul></div>
    <div class="plan pro"><h3>${prices ? `Pro · ${escapeHtml(prices)}` : 'Xpense Pro'}</h3><ul><li>Up to ${scans} AI receipt scans a month</li><li>“Should I buy this?”, checked against your budget</li><li>A monthly review with three tips</li><li>Six-month and yearly trends</li><li>Unlimited repeats, CSV export, your own categories</li></ul></div>
  </div>
</section>

<section aria-label="Private by design">
  <div class="private">
    <h2>Private by design</h2>
    <ul><li>No bank login. You choose what to write down.</li><li>The AI asks first, and we don’t keep your photos.</li><li>No ads, no tracking, and we never sell your data.</li><li>iPhone, iPad and Mac, kept in sync with your account.</li></ul>
  </div>
</section>

<section id="get" class="get" aria-label="Get Xpense">
  <h2>Start with this month.</h2>
  <div class="actions">${storeButtons(env)}</div>
  <p class="quiet" style="margin:16px 0 0;font-size:13px;line-height:18px">${devices}</p>
</section>
</main>`;
  return page('Xpense: spend on what matters', 'A simple budget app for your first paychecks. Snap receipts, see what’s safe to spend, and save for what you want.', body, env);
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
      .replace(new RegExp(`\\[${NOT_SET}: [^\\]]+\\]`, 'g'), (m) => `<mark>${m}</mark>`);
    html = page(title, `${title}.`, `<main class="doc">${body}</main>`, env);
  } else {
    return null;
  }
  return new Response(method === 'HEAD' ? null : html, { headers: HEADERS });
}
