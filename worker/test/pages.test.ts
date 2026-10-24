import { describe, expect, it } from 'vitest';

import type { AIProvider } from '../src/ai/claude';
import type { Env, KV } from '../src/env';
import { createHandler } from '../src/index';
import { renderMarkdown } from '../src/markdown';

const kv: KV = { get: async () => null, put: async () => undefined };
const handle = createHandler({ ai: () => ({}) as AIProvider });

const filled: Partial<Env> = {
  OWNER_NAME: 'Jane Doe',
  CONTACT_EMAIL: 'help@xpense.example',
  GOVERNING_LAW: 'the State of New York, USA',
  LAST_UPDATED: '1 November 2026',
};

async function get(path: string, env: Partial<Env> = filled, method = 'GET') {
  const res = await handle(new Request(`https://xpense.example${path}`, { method }), { ANTHROPIC_API_KEY: 'k', USAGE: kv, ...env });
  return { res, html: await res.text() };
}

describe('renderMarkdown', () => {
  it('renders headings, lists, tables, emphasis and links', () => {
    const html = renderMarkdown(
      '# Title\n\nSome **bold** and _italic_ text\non two lines.\n\n- one\n- two [Terms](terms.md)\n\n| A | B |\n|---|---|\n| 1 | [mail](mailto:a@b.co) |',
      { 'terms.md': '/terms' },
    );
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<p>Some <strong>bold</strong> and <em>italic</em> text on two lines.</p>');
    expect(html).toContain('<ul><li>one</li><li>two <a href="/terms">Terms</a></li></ul>');
    expect(html).toContain('<thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td><a href="mailto:a@b.co">mail</a></td></tr></tbody>');
  });

  it('escapes HTML, drops comments and refuses unsafe links', () => {
    const html = renderMarkdown('<!-- note -->\n<script>alert(1)</script> [x](javascript:alert(1)) a_b_c');
    expect(html).not.toContain('note');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('href="javascript');
    expect(html).toContain('a_b_c');
  });
});

describe('public pages', () => {
  it('serves the privacy policy with the owner details filled in', async () => {
    const { res, html } = await get('/privacy');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    expect(html).toContain('<title>Xpense Privacy Policy</title>');
    expect(html).toContain('Jane Doe');
    expect(html).toContain('<a href="mailto:help@xpense.example">help@xpense.example</a>');
    expect(html).toContain('<em>Last updated: 1 November 2026</em>');
    expect(html).not.toContain('NOT SET');
    expect(html).not.toContain('{{');
  });

  it('shows the fair-use limits the server enforces', async () => {
    const { html } = await get('/terms', { ...filled, PRO_MONTHLY_SCANS: '250', FREE_TRIAL_SCANS: '5' });
    expect(html).toContain('250 receipt scans, 300 purchase checks and 30 monthly reviews');
    expect(html).toContain('Free accounts include 5 trial AI scans');
    expect(html).toContain('the laws of the State of New York, USA');
    expect(html).toContain('<a href="/privacy">Privacy Policy</a>');
  });

  it('highlights values that still need filling in', async () => {
    const { html } = await get('/support', { CONTACT_EMAIL: 'REPLACE with your support email' });
    expect(html).toContain('<mark>[NOT SET: CONTACT_EMAIL in worker/wrangler.toml]</mark>');
  });

  it('serves the home page, tolerates a trailing slash and answers HEAD', async () => {
    expect((await get('/')).html).toContain('Spend on what matters.');
    expect((await get('/support/')).res.status).toBe(200);
    const head = await get('/terms', filled, 'HEAD');
    expect(head.res.status).toBe(200);
    expect(head.html).toBe('');
  });

  it('adds an App Store button only for an https link', async () => {
    expect((await get('/', { APP_STORE_URL: 'https://apps.apple.com/app/id123' })).html).toContain('href="https://apps.apple.com/app/id123"');
    expect((await get('/', { APP_STORE_URL: 'javascript:alert(1)' })).html).not.toContain('javascript:');
  });

  it('reports which settings are present on /health, without their values', async () => {
    const health = JSON.parse((await get('/health', { CONTACT_EMAIL: 'help@xpense.example', REVENUECAT_SECRET_KEY: 'sk_secret' })).html);
    expect(health).toEqual({
      ok: true,
      configured: { anthropic_key: true, revenuecat_key: true, missing_page_settings: ['OWNER_NAME', 'GOVERNING_LAW', 'LAST_UPDATED'] },
    });
    expect(JSON.stringify(health)).not.toContain('sk_secret');
  });

  it('keeps unknown paths and the API unchanged', async () => {
    expect((await get('/nope')).res.status).toBe(404);
    expect((await get('/v1/scan')).res.status).toBe(405);
  });
});
