// Checks that everything LAUNCH.md sets up is in place before you build for the App Store.
//
//   npm run preflight            # config files, Supabase and the live AI server
//   npm run preflight -- --ai    # also signs in with an email code and reads a sample receipt with the
//                                # real AI (costs about half a cent; you type the code from the email)
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WITH_AI = process.argv.includes('--ai');
const problems = [];

const ok = (message) => console.log(`  ✔ ${message}`);
const note = (message, fix) => console.log(`  • ${message}${fix ? `\n      → ${fix}` : ''}`);
const fail = (message, fix) => {
  problems.push(message);
  console.log(`  ✖ ${message}\n      → ${fix}`);
};
const section = (title) => console.log(`\n${title}`);
const placeholder = (value) => !value?.trim() || /REPLACE/i.test(value);

// --- App ---
section('App (app.json, eas.json)');
const app = JSON.parse(readFileSync(join(ROOT, 'app.json'), 'utf8')).expo;
const extra = app.extra ?? {};
const apiUrl = (extra.apiUrl ?? '').trim().replace(/\/+$/, '');

if (/^https:\/\/[^/\s]+/.test(apiUrl)) ok(`AI server URL: ${apiUrl}`);
else fail('expo.extra.apiUrl is not your AI server', 'Deploy the AI server (LAUNCH.md, step 3) and paste its https://… URL into app.json.');

const rcKey = (extra.revenueCatIosKey ?? '').trim();
if (/^appl_\w+$/.test(rcKey)) ok('RevenueCat iOS key');
else fail('expo.extra.revenueCatIosKey is missing (it starts with appl_)', 'RevenueCat → your project → API keys → copy the App Store public key into app.json.');

for (const key of ['privacyUrl', 'termsUrl', 'supportUrl']) {
  if (extra[key] && !/^https:\/\//.test(extra[key])) fail(`expo.extra.${key} must be an https:// link`, `Fix it, or empty it to use ${apiUrl || 'the AI server'}/${key.replace('Url', '')}.`);
}

const supabaseUrl = (extra.supabaseUrl ?? '').trim().replace(/\/+$/, '');
const supabaseKey = (extra.supabaseKey ?? '').trim();
if (/^https:\/\/[^/\s]+$/.test(supabaseUrl)) ok(`Supabase project: ${supabaseUrl}`);
else fail('expo.extra.supabaseUrl is not your Supabase project URL', 'Supabase → Project Settings → API → Project URL, into app.json (LAUNCH.md, step 3).');
if (/^sb_secret_/.test(supabaseKey)) fail('expo.extra.supabaseKey is a SECRET key', 'Never put the secret key in the app. Use the publishable key (sb_publishable_…) and rotate the secret one in Supabase.');
else if (/^(sb_publishable_\w+|eyJ[\w-]+\.[\w-]+\.[\w-]+)$/.test(supabaseKey)) ok('Supabase publishable key');
else fail('expo.extra.supabaseKey is missing', 'Supabase → Project Settings → API keys → copy the publishable key (sb_publishable_…) into app.json.');

if (app.ios?.supportsTablet) ok('Runs on iPad (and on Apple silicon Macs)');
else fail('ios.supportsTablet is off, so Xpense would be iPhone-only', 'Set "supportsTablet": true in app.json.');
if (app.ios?.usesAppleSignIn) ok('Sign in with Apple is switched on');
else fail('ios.usesAppleSignIn is off', 'Set "usesAppleSignIn": true in app.json.');

ok(`Version ${app.version}, bundle ID ${app.ios?.bundleIdentifier} (must match App Store Connect)`);
if (extra.eas?.projectId) ok('Linked to EAS');
else note('Not linked to EAS yet', 'Run: npx eas-cli@latest init (the first build also offers to do it).');

const eas = existsSync(join(ROOT, 'eas.json')) ? JSON.parse(readFileSync(join(ROOT, 'eas.json'), 'utf8')) : null;
if (eas?.build?.production) ok('eas.json has a production build profile');
else fail('eas.json has no production build profile', 'Restore eas.json from the repository.');

// --- AI server settings ---
section('AI server settings (worker/wrangler.toml)');
const toml = readFileSync(join(ROOT, 'worker', 'wrangler.toml'), 'utf8');
const kvId = /\[\[kv_namespaces\]\][^[]*?\bid\s*=\s*"([^"]*)"/.exec(toml)?.[1];
if (!placeholder(kvId)) ok('KV namespace id');
else fail('The USAGE KV namespace id is still a placeholder', 'In worker/: npx wrangler kv namespace create USAGE, then paste the id into wrangler.toml.');

const vars = Object.fromEntries([...toml.matchAll(/^([A-Z_]+)\s*=\s*"([^"]*)"/gm)].map((m) => [m[1], m[2]]));
if (placeholder(vars.SUPABASE_URL)) fail('SUPABASE_URL isn’t filled in', 'Set it in worker/wrangler.toml [vars] to the same project URL as in app.json.');
else if (vars.SUPABASE_URL.replace(/\/+$/, '') !== supabaseUrl) fail('SUPABASE_URL in wrangler.toml differs from supabaseUrl in app.json', 'Use the same project URL in both, then redeploy the server.');
else ok('SUPABASE_URL matches the app');
const pageVars = { OWNER_NAME: 'your name or company', CONTACT_EMAIL: 'your support email', GOVERNING_LAW: 'your country or state', LAST_UPDATED: 'the publish date' };
for (const [name, what] of Object.entries(pageVars)) {
  if (placeholder(vars[name])) fail(`${name} isn't filled in`, `Set it to ${what} in worker/wrangler.toml [vars], then redeploy (cd worker && npx wrangler deploy).`);
  else if (name === 'CONTACT_EMAIL' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(vars[name])) fail('CONTACT_EMAIL is not an email address', 'Fix it in worker/wrangler.toml [vars].');
  else ok(`${name}: ${vars[name]}`);
}

// The app's copy quotes the trial size and the Pro scan cap; they must match what the server enforces.
const appConfig = readFileSync(join(ROOT, 'src', 'lib', 'config.ts'), 'utf8');
for (const name of ['FREE_TRIAL_SCANS', 'PRO_MONTHLY_SCANS']) {
  const inApp = new RegExp(`${name} = (\\d+)`).exec(appConfig)?.[1];
  if (inApp === vars[name]) ok(`${name}: ${inApp} in the app and on the server`);
  else fail(`${name} is ${inApp} in src/lib/config.ts but ${vars[name]} in worker/wrangler.toml`, 'Make them the same (the app quotes this number to users).');
}

// --- Supabase ---
if (/^https:\/\//.test(supabaseUrl) && supabaseKey && !/^sb_secret_/.test(supabaseKey)) {
  section(`Supabase (${supabaseUrl})`);
  const headers = { apikey: supabaseKey };
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/settings`, { headers, signal: AbortSignal.timeout(15_000) });
    if (res.status === 401 || res.status === 403) {
      fail('Supabase rejected the publishable key', 'Copy it again from Supabase → Project Settings → API keys into app.json.');
    } else {
      const settings = await res.json();
      if (settings.external?.apple) ok('Sign in with Apple is enabled');
      else fail('The Apple provider is off', 'Supabase → Authentication → Sign In / Providers → Apple: turn it on and add your bundle ID as a Client ID (LAUNCH.md, step 3).');
      if (settings.external?.email) ok('Email sign-in is enabled');
      else fail('The Email provider is off', 'Supabase → Authentication → Sign In / Providers → Email: turn it on.');
      const table = await fetch(`${supabaseUrl}/rest/v1/records?select=id&limit=1`, { headers, signal: AbortSignal.timeout(15_000) });
      if (table.ok) ok('The records table exists (sync is ready)');
      else fail('The records table is missing', 'Supabase → SQL Editor → paste supabase/schema.sql → Run.');
    }
  } catch {
    fail('Couldn’t reach Supabase', 'Check expo.extra.supabaseUrl, and that the project isn’t paused (Supabase dashboard).');
  }
}

// --- Live server ---
if (/^https:\/\//.test(apiUrl)) {
  section(`Live AI server (${apiUrl})`);
  let health = null;
  try {
    health = await (await fetch(`${apiUrl}/health?deep=1`, { signal: AbortSignal.timeout(30_000) })).json();
  } catch {
    fail('Couldn’t reach the AI server', 'Check expo.extra.apiUrl, and deploy the server: cd worker && npx wrangler deploy');
  }
  if (health?.error?.code === 'slow_down') {
    fail('The server is limiting checks right now', 'Wait a minute and run npm run preflight again.');
  } else if (health?.ok && !health.keys) {
    fail('The deployed server is an older version', 'Redeploy it: cd worker && npx wrangler deploy');
  } else if (health?.ok) {
    ok('Server is up');
    const { anthropic, revenuecat, supabase } = health.keys;
    const { missing_page_settings: missing } = health.configured;
    if (anthropic === 'ok') ok('Anthropic accepted the API key');
    else if (anthropic === 'missing') fail('The ANTHROPIC_API_KEY secret is missing', 'cd worker && npx wrangler secret put ANTHROPIC_API_KEY');
    else if (anthropic === 'invalid') fail('Anthropic rejected the ANTHROPIC_API_KEY secret', 'Create a key at console.anthropic.com → API keys, then: cd worker && npx wrangler secret put ANTHROPIC_API_KEY');
    else fail('The server couldn’t reach Anthropic', 'Try again in a minute (status: status.anthropic.com).');
    if (revenuecat === 'ok') ok('RevenueCat accepted the secret key');
    else if (revenuecat === 'missing') fail('The REVENUECAT_SECRET_KEY secret is missing, so Pro subscribers would be refused AI', 'cd worker && npx wrangler secret put REVENUECAT_SECRET_KEY');
    else if (revenuecat === 'invalid') fail('RevenueCat rejected the REVENUECAT_SECRET_KEY secret', 'In RevenueCat → API keys, create a secret key with API version V1, then: cd worker && npx wrangler secret put REVENUECAT_SECRET_KEY');
    else fail('The server couldn’t reach RevenueCat', 'Try again in a minute (status: status.revenuecat.com).');
    if (supabase === 'ok') ok('Supabase accepted the server’s secret key (account deletion works)');
    else if (supabase === 'missing') fail('The server has no SUPABASE_URL or SUPABASE_SECRET_KEY, so sign-ins and account deletion fail', 'Set SUPABASE_URL in wrangler.toml, then: cd worker && npx wrangler secret put SUPABASE_SECRET_KEY');
    else if (supabase === 'invalid') fail('Supabase rejected the SUPABASE_SECRET_KEY secret', 'Supabase → Project Settings → API keys → secret key, then: cd worker && npx wrangler secret put SUPABASE_SECRET_KEY');
    else fail('The server couldn’t reach Supabase', 'Check SUPABASE_URL in wrangler.toml and that the project isn’t paused.');
    if (missing.length === 0) ok('The live pages have your details');
    else fail(`The live pages are missing ${missing.join(', ')}`, 'Fill them in worker/wrangler.toml [vars], then redeploy: cd worker && npx wrangler deploy');

    for (const path of ['/privacy', '/terms', '/support']) {
      const status = await fetch(apiUrl + path, { signal: AbortSignal.timeout(15_000) }).then((r) => r.status, () => 0);
      if (status === 200) ok(`${apiUrl}${path}`);
      else fail(`${path} answered ${status || 'nothing'}`, 'Redeploy the server: cd worker && npx wrangler deploy');
    }

    const token = WITH_AI && anthropic === 'ok' && supabase === 'ok' ? await signInWithEmailCode() : null;
    if (token) {
      section('Real AI scan (scripts/fixtures/sample-receipt.jpg, total 50.00)');
      console.log('  … reading the receipt; at max effort this can take up to a minute');
      const started = Date.now();
      try {
        const res = await fetch(`${apiUrl}/v1/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            image_base64: readFileSync(join(ROOT, 'scripts', 'fixtures', 'sample-receipt.jpg')).toString('base64'),
            media_type: 'image/jpeg',
            currency: 'USD',
            locale: 'en-US',
            today: new Date().toISOString().slice(0, 10),
          }),
          signal: AbortSignal.timeout(200_000),
        });
        const body = JSON.parse((await res.text()).trim());
        const seconds = Math.round((Date.now() - started) / 1000);
        if (body.receipt) {
          if (Math.abs((body.receipt.total ?? 0) - 50) < 0.01) ok(`Read it correctly in ${seconds} s (${body.receipt.merchant}, total ${body.receipt.total})`);
          else note(`It answered in ${seconds} s but read the total as ${body.receipt.total}`, 'The AI works; a misread on this sample is worth a second try.');
        } else {
          const { code, message } = body.error ?? {};
          const hint =
            {
              ai_error: 'Check that your Anthropic account has credit (console.anthropic.com → Billing). Watch errors live with: cd worker && npx wrangler tail',
              ai_busy: 'Anthropic is busy. Try again in a minute.',
              ai_unreachable: 'The server couldn’t reach Anthropic. Try again in a minute.',
              ai_timeout: 'The answer took too long. Try again.',
            }[code] ?? 'Watch the server while you retry: cd worker && npx wrangler tail';
          fail(`The scan failed: ${message ?? `status ${res.status}`} (${code ?? 'no code'})`, hint);
        }
      } catch (e) {
        fail(`The scan didn’t finish: ${e.message}`, 'Try again; if it keeps failing, watch the server with: cd worker && npx wrangler tail');
      }
    }
  }
}

/** Signs in like the app does (email code), which also proves the email template and the server's token check. */
async function signInWithEmailCode() {
  section('Sign in with an email code');
  if (!process.stdin.isTTY) {
    note('Skipped: run npm run preflight -- --ai in a terminal to type the code');
    return null;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const email = (await rl.question('  Email to sign in with (a test account is fine): ')).trim();
    if (!email) return null;
    const headers = { apikey: supabaseKey, 'Content-Type': 'application/json' };
    const sent = await fetch(`${supabaseUrl}/auth/v1/otp`, { method: 'POST', headers, body: JSON.stringify({ email, create_user: true }) });
    if (!sent.ok) {
      const body = await sent.json().catch(() => ({}));
      fail(`Supabase didn’t send the code: ${body.msg ?? body.message ?? sent.status}`, 'Check the email provider settings and custom SMTP (LAUNCH.md, step 3).');
      return null;
    }
    const code = (await rl.question('  Type the 6-digit code from the email: ')).trim();
    const verified = await fetch(`${supabaseUrl}/auth/v1/verify`, { method: 'POST', headers, body: JSON.stringify({ type: 'email', email, token: code }) });
    const session = await verified.json().catch(() => ({}));
    if (!session.access_token) {
      fail('That code didn’t sign in', 'If the email had a link instead of a code, edit the Magic Link template to show {{ .Token }} (LAUNCH.md, step 3).');
      return null;
    }
    ok('Signed in with an email code');
    return session.access_token;
  } finally {
    rl.close();
  }
}

console.log('');
if (problems.length) {
  console.log(`✖ ${problems.length} thing${problems.length > 1 ? 's' : ''} to fix before building (LAUNCH.md has each step).`);
  process.exitCode = 1;
} else {
  console.log('✔ Ready to build: npx eas-cli@latest build -p ios --profile production --auto-submit');
  if (!WITH_AI) console.log('  Tip: run npm run preflight -- --ai once to test a real AI scan.');
}
