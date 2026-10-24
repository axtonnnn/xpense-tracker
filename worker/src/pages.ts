// Public web pages served by the AI server: a small home page plus the privacy policy, terms of use
// and support page that the App Store requires. The text lives in docs/*.md; {{TOKENS}} in it are
// filled from the [vars] in wrangler.toml, so there is no separate website to host.
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
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
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

// The Xpense mark (same geometry as src/components/brand.tsx): needs leaves on "/", wants on "\".
const LEAF = (() => {
  const [r0, R, w] = [14, 400, 86];
  const len = R - r0;
  return `M ${r0} 0 C ${r0 + len * 0.18} ${-w * 0.95} ${r0 + len * 0.62} ${-w * 1.02} ${R} 0 C ${r0 + len * 0.62} ${w * 1.02} ${r0 + len * 0.18} ${w * 0.95} ${r0} 0 Z`;
})();
const leaf = (angle: number, kind: string) => `<path class="${kind}" transform="translate(512 512) rotate(${angle})" d="${LEAF}"/>`;
const mark = (size: number) =>
  `<svg width="${size}" height="${size}" viewBox="229 229 566 566" aria-hidden="true">${[-45, 135].map((a) => leaf(a, 'need')).join('')}${[-135, 45]
    .map((a) => leaf(a, 'want'))
    .join('')}</svg>`;

const STYLE = `
:root{color-scheme:light dark;--bg:#F6F4EE;--surface:#FFFFFF;--ink:#1B2421;--muted:#5D6864;--primary:#1E5B4F;--on-primary:#FFFFFF;--border:#E2DED3;--need:#0E8066;--want:#CC8418}
@media (prefers-color-scheme:dark){:root{--bg:#0F1A17;--surface:#16231F;--ink:#E9EFEC;--muted:#9AABA5;--primary:#55AE95;--on-primary:#0F1A17;--border:#2A3A35;--need:#8FD3B6;--want:#F0BE5C}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%}
header,main,footer{max-width:720px;margin:0 auto;padding:0 20px}
header{padding-top:24px}
.brand{display:inline-flex;align-items:center;gap:10px;color:var(--primary);font-weight:800;font-size:22px;letter-spacing:-.03em;text-decoration:none}
.need{fill:var(--need)}.want{fill:var(--want)}
main{padding-bottom:32px}
h1{font-size:32px;line-height:1.2;letter-spacing:-.02em;margin:28px 0 8px}
h2{font-size:21px;line-height:1.3;margin:32px 0 8px}
h3{font-size:17px;margin:24px 0 4px}
a{color:var(--primary)}
mark{background:#FDECC8;color:#5A3A00;padding:0 4px;border-radius:4px}
.table{overflow-x:auto;margin:16px 0}
table{border-collapse:collapse;width:100%;background:var(--surface);border-radius:12px}
th,td{text-align:left;vertical-align:top;padding:10px 12px;border-bottom:1px solid var(--border);font-size:15px}
th{font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
tr:last-child td{border-bottom:0}
.hero{text-align:center;padding:40px 0 8px}
.hero h1{font-size:40px;margin:16px 0 4px}
.lead{font-size:21px;font-weight:700;margin:0 0 16px}
.button{display:inline-block;margin-top:8px;padding:14px 22px;border-radius:14px;background:var(--primary);color:var(--on-primary);font-weight:700;text-decoration:none}
footer{padding-bottom:40px;color:var(--muted);font-size:14px}
footer a{color:var(--muted)}`;

function page(title: string, body: string, env: Env): string {
  const owner = isSet(env.OWNER_NAME) ? ` · © ${new Date().getUTCFullYear()} ${escapeHtml(env.OWNER_NAME.trim())}` : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><style>${STYLE}</style></head>
<body><header><a class="brand" href="/">${mark(32)}<span>xpense</span></a></header>
<main>${body}</main>
<footer><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/support">Support</a>${owner}</footer>
</body></html>`;
}

function home(env: Env): string {
  const appStore = env.APP_STORE_URL?.trim();
  return page(
    'Xpense: spend on what matters',
    `<section class="hero">${mark(96)}<h1>Xpense</h1><p class="lead">Spend on what matters.</p>
<p>Xpense keeps your money safe for real needs and helps you spend less on wants. Snap a receipt and AI sorts every line into needs and wants. Your budget stays on your phone.</p>
${appStore && /^https:\/\//.test(appStore) ? `<a class="button" href="${escapeHtml(appStore)}">Get Xpense on the App Store</a>` : ''}</section>`,
    env,
  );
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
    const body = renderMarkdown(markdown, DOC_LINKS).replace(new RegExp(`\\[${NOT_SET}: [^\\]]+\\]`, 'g'), (m) => `<mark>${m}</mark>`);
    html = page(title, body, env);
  } else {
    return null;
  }
  return new Response(method === 'HEAD' ? null : html, { headers: HEADERS });
}
