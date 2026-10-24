# Launch Xpense on the App Store

The app, the AI server, the policy pages and the App Store listing are ready. What's left are the accounts only you can open, a few keys to paste, and a submit button. Work through the steps in order and tick them off. `npm run preflight` (step 7) checks your setup before you build.

**What you'll pay**

| | Cost |
|---|---|
| Apple Developer Program | $99 a year |
| Cloudflare Workers Paid (runs the AI server) | $5 a month |
| Anthropic API (the AI) | pay as you go, about $0.002–0.008 per receipt scan |
| Expo EAS (cloud builds) and RevenueCat (subscriptions) | free plans are enough to launch |

**Time:** about 3 hours of your own time. On top of that, Apple takes a day or two to approve your developer membership and usually 1 to 3 days to review the app.

**You need:** a computer (Mac, Windows or Linux) with [Node.js](https://nodejs.org) 20 or newer and [Git](https://git-scm.com), and an iPhone for testing. No Mac is required, because Expo builds the app in the cloud.

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

Start here: approval can take a day or two, and you can do steps 2 to 4 while you wait.

- [ ] Enrol at [developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll) ($99 a year).
  - Your Apple ID needs two-factor authentication.
  - Enrolling as an **individual** shows your own name as the seller on the App Store.
  - Enrolling as an **organization** needs a D-U-N-S number.

## Step 2. Get an Anthropic API key

- [ ] Sign up at [console.anthropic.com](https://console.anthropic.com).
- [ ] **Billing:** add credit. $10 covers well over a thousand scans.
- [ ] **Limits:** set a monthly spend limit, for example $25. This is your hard cost cap.
- [ ] **API keys:** create a key and copy it (it starts with `sk-ant-`). You'll paste it in step 3.

## Step 3. Deploy the AI server (Cloudflare)

The server keeps your API key off the phone, checks who is subscribed, and also hosts your **privacy policy**, **terms** and **support** pages, so you don't need a separate website.

- [ ] Sign up at [dash.cloudflare.com](https://dash.cloudflare.com). Then open **Workers & Pages → Plans** and choose **Workers Paid** ($5 a month). The free plan is not enough:
  - It allows about 10 ms of computing time per request, and one AI answer measured 10 to 80 ms.
  - It allows only 1,000 usage-counter writes a day.
- [ ] Log in and create the usage store:

  ```bash
  cd worker
  npx wrangler login
  npx wrangler kv namespace create USAGE
  ```

  If Wrangler asks *"Would you like Wrangler to add it on your behalf?"*, answer **No**. Copy the `id` it prints. In `worker/wrangler.toml`, replace `REPLACE_WITH_YOUR_KV_NAMESPACE_ID` with that id.
- [ ] Fill in the four values at the top of `[vars]` in `worker/wrangler.toml`. They appear on your policy and support pages:

  | Setting | Example |
  |---|---|
  | `OWNER_NAME` | `Alex Smith` (your name, or your company's) |
  | `CONTACT_EMAIL` | `help@yourdomain.com`, the address users write to for support |
  | `GOVERNING_LAW` | `the State of California, USA` |
  | `LAST_UPDATED` | `1 November 2026`, the day you publish |

- [ ] Deploy, then add the Anthropic key:

  ```bash
  npx wrangler deploy
  npx wrangler secret put ANTHROPIC_API_KEY
  cd ..
  ```

  On your first deploy, Wrangler asks you to register a *workers.dev subdomain*: pick any name. When the deploy finishes it prints your server's address, something like `https://xpense-ai.yourname.workers.dev`. When `secret put` asks for the key, paste it.
- [ ] Paste that address into `app.json` as `"apiUrl"` (inside `"extra"`).
- [ ] Open `https://<your server>/privacy` in a browser. You should see your privacy policy with your details filled in. The `/terms` and `/support` pages work the same way.

## Step 4. Create an Expo account

- [ ] Sign up at [expo.dev](https://expo.dev) (free), then link the project:

  ```bash
  npx eas-cli@latest login
  npx eas-cli@latest init
  ```

  `init` adds your project ID to `app.json`.

## Step 5. Set up the app in App Store Connect

You need Apple's approval from step 1 for this.

- [ ] **Register the bundle ID.**
  - Go to [developer.apple.com → Identifiers](https://developer.apple.com/account/resources/identifiers/list) → **+** → **App IDs** → **App**.
  - Description: `Xpense`. Explicit Bundle ID: `com.axtonnnn.xpense`. In-App Purchase is included automatically.
  - Bundle IDs are unique worldwide. To use your own (for example `com.yourname.xpense`), change `ios.bundleIdentifier` in `app.json` to match.
- [ ] **Create the app.**
  - In [App Store Connect](https://appstoreconnect.apple.com), go to **Apps → + → New App**. Choose iOS, the name from [`docs/app-store/listing.md`](docs/app-store/listing.md), English (U.S.), your bundle ID, and the SKU `xpense-ios`.
  - Names are unique across the store; the listing file has alternatives if yours is taken.
- [ ] **Business:** accept the **Paid Apps** agreement and add your bank account and tax forms. Subscriptions don't work, even in testing, until this agreement is active.
- [ ] **Subscriptions.**
  - Go to **Monetization → Subscriptions** and create the group `Xpense Pro` with its two subscriptions, exactly as in the table in [`docs/app-store/listing.md`](docs/app-store/listing.md#in-app-purchases-subscriptions).
  - Each needs: product ID, price, display name, description, and `docs/app-store/iap-review.jpg` as the review screenshot.
  - On the yearly plan, add an **introductory offer**: Free, 1 week, all countries.
  - Each subscription should end up as **Ready to Submit**.
- [ ] **In-App Purchase key** (RevenueCat needs it to see purchases).
  - Go to **Users and Access → Integrations → In-App Purchase** and generate a key.
  - Download the `.p8` file (you can only download it once) and note the **Key ID** and the **Issuer ID** shown on that page.

## Step 6. Set up RevenueCat

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

## Step 7. Check everything

- [ ] Run:

  ```bash
  npm run preflight -- --ai
  ```

  It checks your config files and the live server, including whether Anthropic and RevenueCat accept your keys. `--ai` also reads a sample receipt with the real AI, which costs about half a cent. Every line marked ✖ says how to fix it. Run it again until it ends with **Ready to build**.

## Step 8. Build and upload

- [ ] Run:

  ```bash
  npx eas-cli@latest build --platform ios --profile production --auto-submit
  ```

  - Sign in with your Apple ID when asked, and answer **Yes** when EAS offers to create the certificate, the provisioning profile and an App Store Connect API key.
  - The build runs in the cloud (about 15 to 30 minutes) and is then uploaded to App Store Connect automatically.
  - Apple needs another 10 to 30 minutes to process it. You'll get an email when it's ready in **TestFlight**.
  - Build numbers go up automatically on every build.

## Step 9. Test it on your iPhone

- [ ] Install **TestFlight** from the App Store. In App Store Connect, open **TestFlight → Internal Testing**, add yourself, and accept the invite on your iPhone.
- [ ] Try the things App Review will try:
  - finish onboarding;
  - scan a real receipt, and allow AI when asked;
  - open **Settings → See Pro plans** and subscribe (TestFlight purchases are free sandbox purchases);
  - check that **Should I buy this?** now works;
  - delete and reinstall the app, then use **Restore purchases**.

## Step 10. Fill in the App Store page and submit

All the text is in [`docs/app-store/listing.md`](docs/app-store/listing.md). Replace `YOUR-SERVER` in it with your server's address.

- [ ] **App Information:** subtitle, category (Finance), content rights and age rating (4+).
- [ ] **Pricing and Availability:** Free, with in-app purchases. Pick your countries.
  - **EU users:** App Store Connect asks whether you're a "trader" under the EU Digital Services Act. If you sell subscriptions you most likely are, and your address, phone and email are then shown on the EU App Store.
  - If you'd rather not publish those, leave the EU countries out for now.
- [ ] **App Privacy:** enter the privacy policy URL and the answers from the listing file.
- [ ] **Version 1.0:**
  - promotional text, description, keywords, support URL, copyright;
  - the five screenshots from `docs/app-store/screenshots/`, in the 6.9" iPhone slot;
  - the build from step 8.
- [ ] **In-App Purchases and Subscriptions** (on the same version page): add both subscriptions. Apple reviews them together with the app's first version.
- [ ] **App Review Information:** sign-in not required, your contact details, and the review notes from the listing file.
- [ ] **Export compliance** is already answered in `app.json`, so you won't be asked.
- [ ] Choose **Automatically release this version**, then **Add for Review → Submit**.

Review usually takes 1 to 3 days. If Apple asks a question or rejects something, the message in App Store Connect says exactly what to change.

## After you're live

- [ ] Put your App Store link in `worker/wrangler.toml` as `APP_STORE_URL` and run `cd worker && npx wrangler deploy`. Your home page then gets a download button.
- [ ] Apply for the [App Store Small Business Program](https://developer.apple.com/app-store/small-business-program/) to pay 15% commission instead of 30%.
- [ ] Watch your AI spend at console.anthropic.com. To see the server's live log, run `cd worker && npx wrangler tail`.
- [ ] **Updates:**
  1. Change `"version"` in `app.json` (for example `1.0.1`).
  2. Run the step 8 command again.
  3. Add a new version in App Store Connect.

  If you change the policy text in `docs/` or the settings in `wrangler.toml`, redeploy the server with `cd worker && npx wrangler deploy`.

## If something goes wrong

| What you see | What to do |
|---|---|
| `npm run preflight` shows ✖ | Each line says what to fix. Run it again afterwards. |
| The app says "The AI service had a problem" | Check your Anthropic credit (console.anthropic.com → Billing), then run `npm run preflight -- --ai`. |
| The app says "Couldn't confirm your subscription" | The server's `REVENUECAT_SECRET_KEY` must be a **V1 secret** key. Preflight tells you if RevenueCat rejects it. |
| The paywall says "Plans are loading" in TestFlight | Check three things: the Paid Apps agreement is active, both subscriptions are Ready to Submit, and the RevenueCat offering is **current** with both packages. |
| A build fails | Open the build page link that EAS prints. A bundle ID that doesn't match App Store Connect is the most common cause. |
| App Review mentions guideline 3.1.2 (subscriptions) | The description in `listing.md` already has the subscription terms and the Terms and Privacy links. Make sure they made it into App Store Connect. |

## Android (optional, later)

1. Google Play costs $25 once. New personal accounts must run a closed test with at least 12 testers for 14 days before they can publish.
2. Add a Play Store app in RevenueCat and put its `goog_` key in `app.json` as `"revenueCatAndroidKey"`.
3. Build with `npx eas-cli@latest build --platform android --profile production` and submit with `npx eas-cli@latest submit --platform android`.
4. Answer the Play **Data safety** form the same way as the App Privacy answers.
