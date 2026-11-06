# Launch Xpense on the App Store

The app, the AI server and the App Store listing are ready. What's left are the accounts only you can open, a few keys to paste, and a submit button. Work through the steps in order and tick them off. `npm run preflight` (step 8) checks your setup before you build.

**Xpense launches free.** Payments are off (`"payments": false` in `app.json`, `PAYMENTS = "off"` in `worker/wrangler.toml`): every account gets every feature within fair monthly AI limits, and the app shows nothing about Pro or prices. So there are no subscriptions to set up now. When you decide to sell Xpense Pro, follow [Turning on Xpense Pro](#turning-on-xpense-pro) at the end.

**What you'll pay**

| | Cost |
|---|---|
| Apple Developer Program | $99 a year |
| Anthropic API (the AI, for everyone while Xpense is free) | pay as you go, about $0.002–0.008 per receipt scan; your monthly spend limit caps it |
| Supabase (accounts and sync), Cloudflare Workers (the AI server and the privacy and support pages), Expo EAS (builds) | free plans are enough to launch |

Only if you need them later: Cloudflare Workers Paid ($5 a month) if the server outgrows the free plan (see [If something goes wrong](#if-something-goes-wrong)), and a domain (about $10 a year) if you turn on email sign-in.

**Time:** about 4 hours of your own time. On top of that, Apple takes a day or two to approve your developer membership and usually 1 to 3 days to review the app.

**You need:** a computer (Mac, Windows or Linux) with [Node.js](https://nodejs.org) 20 or newer and [Git](https://git-scm.com), and an iPhone for testing (an iPad too, if you have one). No Mac is required, because Expo builds the app in the cloud.

**Try it first:** `npm run demo` opens the app in Expo Go on your phone with sample AI answers and a local preview account. It needs none of the steps below.

---

## Step 0. Get the code onto your computer

- [ ] Open a terminal and run:

  ```bash
  git clone -b claude/xpense-app-v1 https://github.com/axtonnnn/xpense-tracker.git
  cd xpense-tracker
  npm install
  cd worker && npm install && cd ..
  ```

  Every command below runs from this `xpense-tracker` folder unless it starts with `cd worker`.

## Step 1. Join the Apple Developer Program

Start here: approval can take a day or two, and you can do steps 2 to 5 while you wait.

- [ ] Enrol at [developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll) ($99 a year).
  - Your Apple ID needs two-factor authentication.
  - Enrolling as an **individual** shows your own name as the seller on the App Store.
  - Enrolling as an **organization** needs a D-U-N-S number.

## Step 2. Get an Anthropic API key

- [ ] Sign up at [console.anthropic.com](https://console.anthropic.com).
- [ ] **Billing:** add credit. $10 covers well over a thousand scans.
- [ ] **Limits:** set a monthly spend limit, for example $25. This is your hard cost cap.
- [ ] **API keys:** create a key and copy it (it starts with `sk-ant-`). You'll paste it in step 4.

## Step 3. Set up accounts and sync (Supabase)

People sign in with Apple, and their budget syncs between their iPhone, iPad and Mac. Supabase runs both. (Sign-in with a 6-digit email code is built in but off, `"emailSignIn": false` in `app.json`, so you need no email sender or domain. The two email items below are only for when you turn it on, for example for Android.)

- [ ] Sign up at [supabase.com](https://supabase.com) and create a project called `xpense`. Pick the region closest to most of your users, and save the database password somewhere safe (the app doesn't need it).
  - The free plan is enough to launch. Free projects pause after about a week with no activity at all; once people use the app every day that doesn't happen. Upgrading to Pro ($25 a month) removes the pause.
- [ ] **Create the table.** Open **SQL Editor → New query**, paste the whole of [`supabase/schema.sql`](supabase/schema.sql), and press **Run**. It creates one table, `records`, where each account can only see its own rows.
  - Already ran it for an earlier version? Run it again: it's safe to repeat, and the savings goal needs it to sync.
- [ ] **Sign in with Apple.** Open **Authentication → Sign In / Providers → Apple** and turn it on. Under **Client IDs**, enter your bundle ID: `com.axtonnnn.xpense` (or your own, see step 6). Leave the other fields empty: the app signs in with Apple's own sheet, so no secret key is needed. Save.
- [ ] **Email codes** (only with `"emailSignIn": true`).
  - In **Authentication → Sign In / Providers → Email**: make sure Email is on, and set **Email OTP Length** to `6`.
  - In **Authentication → Emails → Templates** (older dashboards: **Email Templates**), open **Magic Link**. Set the subject to `Your Xpense code`, and replace the whole body with the contents of [`supabase/email-code.html`](supabase/email-code.html): the sign-in code in the app's style. Save.
  - Do the same for the **Confirm signup** template (new accounts get that one).
  - Leave **Email OTP Expiration** at its default of one hour; the email says so.
- [ ] **Send emails from your own domain** (only with `"emailSignIn": true`). Supabase's built-in email is only for testing (it sends a few emails an hour, and only to your own team), so real users need your own sender:
  1. Buy a domain if you don't have one (any registrar, or Cloudflare Registrar).
  2. Sign up at [resend.com](https://resend.com) (free for 3,000 emails a month), add your domain under **Domains**, and add the DNS records it shows. Wait until it says **Verified**.
  3. In Resend, create an **API key**.
  4. In Supabase, open **Authentication → Emails → SMTP Settings** (older dashboards: **Project Settings → Authentication**), turn on custom SMTP and enter: host `smtp.resend.com`, port `465`, user `resend`, password = the Resend API key, sender `no-reply@yourdomain.com`, sender name `Xpense`.
  5. Under **Authentication → Rate Limits**, raise **emails per hour** to fit your users (for example 100).
- [ ] **Copy two values into `app.json`** (inside `"extra"`), from **Project Settings → API** and **API keys**:
  - the **Project URL** (like `https://abcd1234.supabase.co`) as `"supabaseUrl"`;
  - the **publishable key** (starts with `sb_publishable_`) as `"supabaseKey"`. It's safe in the app. Never put the **secret** key in the app.
- [ ] Keep the **secret key** (starts with `sb_secret_`) at hand: the AI server needs it in step 4 to delete accounts when people ask.

## Step 4. Deploy the AI server (Cloudflare)

The server keeps your API key off the phone, checks each person's sign-in, applies the monthly AI limits, deletes accounts on request, and hosts the **privacy policy**, **terms** and **support** pages that App Store Connect asks for. (It also serves a simple home page about Xpense; you don't need to use it yet.)

- [ ] Sign up at [dash.cloudflare.com](https://dash.cloudflare.com). The free plan is enough to start:
  - It allows 10 ms of computing time per request; waiting for the AI doesn't count, and a scan measured about 5 ms once the server is warm.
  - It allows 1,000 usage-counter writes a day. Past that, answers still arrive; they just aren't counted toward the monthly limits that day.
  - If scans start failing with a server error, open **Workers & Pages → Plans** and choose **Workers Paid** ($5 a month). Nothing else changes.
- [ ] Log in and create the usage store:

  ```bash
  cd worker
  npx wrangler login
  npx wrangler kv namespace create USAGE
  ```

  If Wrangler asks *"Would you like Wrangler to add it on your behalf?"*, answer **No**. Copy the `id` it prints. In `worker/wrangler.toml`, replace `REPLACE_WITH_YOUR_KV_NAMESPACE_ID` with that id.
- [ ] Fill in these values in `[vars]` in `worker/wrangler.toml`:

  | Setting | Example |
  |---|---|
  | `OWNER_NAME` | `Alex Smith` (your name, or your company's) |
  | `CONTACT_EMAIL` | `help@yourdomain.com`, the address users write to for support |
  | `GOVERNING_LAW` | `the State of California, USA` |
  | `LAST_UPDATED` | `1 November 2026`, the day you publish |
  | `SUPABASE_URL` | `https://abcd1234.supabase.co`, the same Project URL as in `app.json` |

  Leave `PAYMENTS = "off"` as it is: Xpense launches free.

- [ ] Deploy, then add the secrets:

  ```bash
  npx wrangler deploy
  npx wrangler secret put ANTHROPIC_API_KEY
  npx wrangler secret put SUPABASE_SECRET_KEY
  cd ..
  ```

  On your first deploy, Wrangler asks you to register a *workers.dev subdomain*: pick any name. When the deploy finishes it prints your server's address, something like `https://xpense-ai.yourname.workers.dev`. Paste each key when `secret put` asks for it.
- [ ] Paste that address into `app.json` as `"apiUrl"` (inside `"extra"`).
- [ ] Open the address with `/privacy` on the end in a browser: your privacy policy shows, with your details filled in. `/terms` and `/support` work the same way.
- [ ] Optional: to use your own domain for the server (for example `xpense.app`), open the Worker in the Cloudflare dashboard → **Settings → Domains & Routes → Add → Custom domain**. Then use that address for `"apiUrl"` and in the App Store listing instead.

## Step 5. Create an Expo account

- [ ] Sign up at [expo.dev](https://expo.dev) (free), then link the project:

  ```bash
  npx eas-cli@latest login
  npx eas-cli@latest init
  ```

  `init` adds your project ID to `app.json`.

## Step 6. Set up the app in App Store Connect

You need Apple's approval from step 1 for this.

- [ ] **Register the bundle ID.**
  - Go to [developer.apple.com → Identifiers](https://developer.apple.com/account/resources/identifiers/list) → **+** → **App IDs** → **App**.
  - Description: `Xpense`. Explicit Bundle ID: `com.axtonnnn.xpense`. Under **Capabilities**, tick **Sign In with Apple**. In-App Purchase is included automatically.
  - Bundle IDs are unique worldwide. To use your own (for example `com.yourname.xpense`), change `ios.bundleIdentifier` in `app.json` and the Apple **Client ID** in Supabase (step 3) to match.
- [ ] **Create the app.**
  - In [App Store Connect](https://appstoreconnect.apple.com), go to **Apps → + → New App**. Choose iOS, the name from [`docs/app-store/listing.md`](docs/app-store/listing.md), English (U.S.), your bundle ID, and the SKU `xpense-ios`.
  - Names are unique across the store; the listing file has alternatives if yours is taken.
## Step 7. Payments: nothing to do yet

Xpense launches free, so skip subscriptions and RevenueCat for now. They're in [Turning on Xpense Pro](#turning-on-xpense-pro) for when you want them.

## Step 8. Check everything

- [ ] Run:

  ```bash
  npm run preflight -- --ai
  ```

  It checks your config files, your Supabase project (Apple and email sign-in, the table) and the live server, including whether Anthropic, RevenueCat and Supabase accept your keys. `--ai` then signs in with an email code, just like the app (type your email, then the code from the email), and reads a sample receipt with the real AI, which costs about half a cent. Every line marked ✖ says how to fix it. Run it again until it ends with **Ready to build**.

## Step 9. Build and upload

- [ ] Run:

  ```bash
  npx eas-cli@latest build --platform ios --profile production --auto-submit
  ```

  - Sign in with your Apple ID when asked, and answer **Yes** when EAS offers to create the certificate, the provisioning profile and an App Store Connect API key. EAS also switches on the Sign in with Apple capability for your bundle ID if it isn't on yet.
  - The build runs in the cloud (about 15 to 30 minutes) and is then uploaded to App Store Connect automatically.
  - Apple needs another 10 to 30 minutes to process it. You'll get an email when it's ready in **TestFlight**.
  - One build covers iPhone, iPad and Apple silicon Macs. Build numbers go up automatically on every build.

## Step 10. Test it on your devices

- [ ] Install **TestFlight** from the App Store on your iPhone (and iPad or Mac). In App Store Connect, open **TestFlight → Internal Testing**, add yourself, and accept the invite.
- [ ] Try the things App Review will try:
  - sign in with Apple, finish the three setup pages;
  - sign out (Settings → Sign out) and sign in again with an email code;
  - scan a real receipt, and allow AI when asked; then try a photo that isn't a receipt, and turn on airplane mode and scan again (both should explain what went wrong);
  - in AI mode, try **Should I buy this?** and the monthly review;
  - add an expense and a repeating bill in Tracker, then find them in History and edit one;
  - add money to your savings goal and check what's safe to spend on the dashboard;
  - turn on **Settings → Lock with Face ID**, close the app and open it again;
  - check that nothing mentions Pro, prices or purchases;
  - sign in on your iPad or Mac with the same account: your entries should appear within a few seconds, with the sidebar layout;
  - delete the app and reinstall it, sign in, and check everything is back;
  - finally, try **Settings → Delete account** with a test account.

## Step 11. Fill in the App Store page and submit

All the text is in [`docs/app-store/listing.md`](docs/app-store/listing.md). Replace `YOUR-SERVER` in it with your server's address.

- [ ] **App Information:** subtitle, category (Finance), content rights and age rating (4+).
- [ ] **Pricing and Availability:** Free. Pick your countries. Under **iPhone and iPad Apps on Apple Silicon Macs**, keep Xpense available, so it's on the Mac App Store too.
  - **EU users:** App Store Connect asks whether you're a "trader" under the EU Digital Services Act. Answer for your situation (Apple's help page explains who counts). A trader's address, phone and email are shown on the EU App Store.
  - If you'd rather not publish those, leave the EU countries out for now.
- [ ] **App Privacy:** enter the privacy policy URL and the answers from the listing file.
- [ ] **Version 1.0:**
  - promotional text, description, keywords, support URL, marketing URL, copyright;
  - the five `iphone-*.jpg` screenshots in the **6.9" iPhone** slot, and the two `ipad-*.jpg` screenshots in the **13" iPad** slot (all in `docs/app-store/screenshots/`);
  - the build from step 9.
- [ ] **App Review Information:** sign-in required, the explanation and review notes from the listing file, and your contact details.
- [ ] **Export compliance** is already answered in `app.json`, so you won't be asked.
- [ ] Choose **Automatically release this version**, then **Add for Review → Submit**.

Review usually takes 1 to 3 days. If Apple asks a question or rejects something, the message in App Store Connect says exactly what to change.

## After you're live

- [ ] Watch your AI spend at console.anthropic.com. To see the server's live log, run `cd worker && npx wrangler tail`. Supabase's dashboard shows sign-ups under **Authentication → Users**.
- [ ] **Updates:**
  1. Change `"version"` in `app.json` (for example `1.0.1`).
  2. Run the step 9 command again.
  3. Add a new version in App Store Connect.

  If you change the policy text in `docs/` or the settings in `wrangler.toml`, redeploy the server with `cd worker && npx wrangler deploy`. If an update changes `supabase/schema.sql`, run it again in Supabase's SQL Editor before you release the app.

## Turning on Xpense Pro

Do this when you're ready to sell Pro. Until then everything is free and none of it is needed.

**1. App Store Connect** (Apple's membership from step 1 is enough):

- [ ] **Business:** accept the **Paid Apps** agreement and add your bank account and tax forms. Subscriptions don't work, even in testing, until this agreement is active.
- [ ] **Subscriptions.**
  - Go to **Monetization → Subscriptions** and create the group `Xpense Pro` with its two subscriptions, exactly as in the table in [`docs/app-store/listing.md`](docs/app-store/listing.md#in-app-purchases-subscriptions).
  - Each needs: product ID, price, display name, description, and `docs/app-store/iap-review.jpg` as the review screenshot.
  - On the yearly plan, add an **introductory offer**: Free, 1 week, all countries.
  - Each subscription should end up as **Ready to Submit**.
- [ ] **In-App Purchase key** (RevenueCat needs it to see purchases).
  - Go to **Users and Access → Integrations → In-App Purchase** and generate a key.
  - Download the `.p8` file (you can only download it once) and note the **Key ID** and the **Issuer ID** shown on that page.

**2. RevenueCat:**

- [ ] Sign up at [app.revenuecat.com](https://app.revenuecat.com) and create a project called **Xpense**.
- [ ] **Add an App Store app** with your bundle ID. Under its in-app purchase key settings, upload the `.p8` file with its Key ID and Issuer ID.
- [ ] **Products:** add `xpense_pro_monthly` and `xpense_pro_yearly`.
- [ ] **Entitlements:** create one with the identifier **`pro`**, exactly that, and attach both products.
- [ ] **Offerings:**
  - In the **default** offering (create it if needed, and make it current), add a **Monthly** package with `xpense_pro_monthly` and an **Annual** package with `xpense_pro_yearly`.
  - The app shows whatever this offering contains.
- [ ] **API keys:**
  - Copy the **App Store public key**, which starts with `appl_`, into `app.json` as `"revenueCatIosKey"`. Don't use a `test_` key.
  - Create a **secret API key** and choose **API version V1**. Give it to the server:

    ```bash
    cd worker
    npx wrangler secret put REVENUECAT_SECRET_KEY
    cd ..
    ```

- [ ] Optional but recommended: copy RevenueCat's **Apple Server Notification URL** (in the app's settings in RevenueCat) into App Store Connect under **App Information → App Store Server Notifications**, for both Production and Sandbox. Cancellations and refunds then reach RevenueCat right away.

RevenueCat knows each customer by their Xpense account ID, so Pro follows a person to every device they sign in on.

**3. Switch payments on** in both places, so the app and the server agree (preflight checks this):

- [ ] `app.json` → `"extra"`: set `"payments": true`.
- [ ] `worker/wrangler.toml`: set `PAYMENTS = "on"`, and check `PRO_PRICES` matches your App Store prices. Then `cd worker && npx wrangler deploy && cd ..`. From then on free accounts get the 3 trial scans, the rest is Pro, and the privacy, terms and support pages include the subscription text.

**4. Ship it as an update:**

- [ ] `npm run preflight -- --ai` until it says **Ready to build**; it now checks RevenueCat too.
- [ ] Raise `"version"` in `app.json` (for example `1.1.0`), run the step 9 build command, and test a sandbox purchase in TestFlight (**Settings → See Pro plans**).
- [ ] Optional: `npm run store:screenshots` remakes the screenshots and `docs/app-store/iap-review.jpg`, the subscription review screenshot.
- [ ] In App Store Connect, add a new version with the Pro texts from [`docs/app-store/listing.md`](docs/app-store/listing.md#when-you-turn-on-xpense-pro): the description, the review note and the Purchase History privacy answer. Add both subscriptions to that version, then submit.
- [ ] Apply for the [App Store Small Business Program](https://developer.apple.com/app-store/small-business-program/) to pay 15% commission instead of 30%.

If something goes wrong with Pro:

| What you see | What to do |
|---|---|
| The app says "Couldn't confirm your subscription" | The server's `REVENUECAT_SECRET_KEY` must be a **V1 secret** key. Preflight tells you if RevenueCat rejects it. |
| The paywall says "Plans are loading" in TestFlight | Check three things: the Paid Apps agreement is active, both subscriptions are Ready to Submit, and the RevenueCat offering is **current** with both packages. |
| App Review mentions guideline 3.1.2 (subscriptions) | The description in `listing.md` already has the subscription terms and the Terms and Privacy links. Make sure they made it into App Store Connect. |

## If something goes wrong

| What you see | What to do |
|---|---|
| `npm run preflight` shows ✖ | Each line says what to fix. Run it again afterwards. |
| The sign-in email has a link, not a code | Edit the **Magic Link** (and **Confirm signup**) email template to show `{{ .Token }}` (step 3). |
| Sign-in emails don't arrive | Check Resend's dashboard for the email and that your domain is **Verified**, then Supabase's custom SMTP settings and email rate limit (step 3). |
| "Sign in with Apple didn't work" | In Supabase, the Apple provider must be on with your exact bundle ID as a Client ID. The App ID needs the Sign In with Apple capability (step 6). |
| The app says "Please sign in again to use the AI" | The server's `SUPABASE_URL` must be your project's URL, exactly as in `app.json`. Preflight checks this. |
| The app says it reached this month's limit for an AI feature | That's the fair-use limit (300 scans, 300 buy checks and 30 reviews per account a month). Change `PRO_MONTHLY_SCANS`, `PRO_MONTHLY_CHECKS` or `PRO_MONTHLY_REVIEWS` in `worker/wrangler.toml` and redeploy. |
| Scans or buy checks fail with a server error, and `npx wrangler tail` shows "exceeded CPU" or "resource limits" | The Workers free plan's 10 ms limit. Choose **Workers Paid** ($5 a month) in **Workers & Pages → Plans**; nothing else changes. |
| `npx wrangler deploy` says rate limiting isn't available on your plan | Delete the `[[ratelimits]]` block (4 lines) in `worker/wrangler.toml` and deploy again. The monthly limits still apply. |
| The app says "The AI service had a problem" | Check your Anthropic credit (console.anthropic.com → Billing), then run `npm run preflight -- --ai`. |
| Entries don't show up on another device | Both must be signed in to the same account (Settings shows which). Settings → **Sync now** shows whether the device is online. Check the `records` table exists (preflight). |
| Entries sync but the savings goal doesn't | Your Supabase table is from before the savings goal. Run `supabase/schema.sql` again (step 3); the goal syncs on the next **Sync now**. |
| A build fails | Open the build page link that EAS prints. A bundle ID that doesn't match App Store Connect is the most common cause. |

## Android (optional, later)

1. Google Play costs $25 once. New personal accounts must run a closed test with at least 12 testers for 14 days before they can publish.
2. Only once you turn on Pro: add a Play Store app in RevenueCat and put its `goog_` key in `app.json` as `"revenueCatAndroidKey"`.
3. Sign in on Android uses the email code (Sign in with Apple is an Apple-device feature). Nothing else to set up.
4. Build with `npx eas-cli@latest build --platform android --profile production` and submit with `npx eas-cli@latest submit --platform android`.
5. Answer the Play **Data safety** form the same way as the App Privacy answers.
