<!-- Served by the AI server at /privacy. {{TOKENS}} are filled in from the [vars] in worker/wrangler.toml. -->
# Xpense Privacy Policy

_Last updated: {{LAST_UPDATED}}_

Xpense ("we", "us") is a budgeting app that helps you track income and expenses and spend on what you need. This policy explains what data the app handles, where it's kept and why.

**Contact:** {{OWNER_NAME}}, {{CONTACT_EMAIL}}

## The short version

- You sign in with Apple or with a code sent to your email, so your budget is the same on your iPhone, iPad and Mac.
- Your entries are kept on your devices and in your private Xpense account. **Only you can see them.** No bank login, no advertising, no tracking, and we never sell data.
- AI features only run after you allow them. They send just what's needed to answer that request. **We don't keep it.**
- You can delete your account, and everything in it, from inside the app at any time.

## Your account

| Data | Why |
|---|---|
| Your email address (or, with Sign in with Apple, the address Apple gives us, which can be a private relay address) | To sign you in and to send sign-in codes |
| Your first name, if you give it (from Apple on your first sign-in, or typed during setup) | To greet you in the app |
| An account ID (a random identifier) | To keep your data together and link your Pro subscription |

Accounts are run by **Supabase**, our sign-in and database provider. Sign-in codes are sent by email through our email provider.

## Your budget

| Data | Where it's kept |
|---|---|
| Entries (amount, date, category, shop, notes, need/want split), receipt lines, repeating bills and paychecks | On your devices and in your Xpense account, so it syncs between them |
| Settings (currency, pay, savings goal and what you're saving for, hours per week) | On your devices and in your account |
| Receipt photos you save | **Only on the device that took them**. They are never uploaded to your account |
| App lock and AI permission | Only on that device |

Your account data is stored by Supabase in a database protected by row-level security: each account can only read and change its own records. It's encrypted in transit (HTTPS) and at rest. We access it only to keep the service running, to help you when you ask, or when the law requires it.

You can export your entries at any time with **Settings → Export as CSV** (Pro).

## AI features (optional)

Xpense asks for your permission before using AI. You can turn AI off at any time in **Settings → Allow AI features**.

When you use an AI feature, the app sends the following over an encrypted connection to our AI service, which runs on Cloudflare Workers:

| Feature | What is sent |
|---|---|
| Receipt & bill scanning | The photo you choose, your currency, locale and today's date |
| "Should I buy this?" | The item and price you type, your currency, and a few numbers about this month: what's safe to spend, days left, your pay and pay per hour, your savings goal and what you're saving for, and what you've spent on wants |
| Monthly review | This month's totals: income, spending, needs, wants, savings goal, what you're saving for, and per-category totals. No individual entries, shops or notes |

Our service forwards the request to **Anthropic's Claude API** to produce the answer and returns the answer to your device. **We do not store the photos, text or answers.** Anthropic processes this data as our service provider under its commercial terms. It does not use API data to train its models, and may keep requests for a limited period for safety and abuse monitoring, as described in [Anthropic's Privacy Policy](https://www.anthropic.com/legal/privacy).

AI answers can contain mistakes. Always check amounts before saving.

## Usage counters

To give free accounts their {{FREE_TRIAL_SCANS}} trial scans and to apply Pro's monthly fair-use limits, our AI service keeps small counters linked to your account ID: how many AI requests you made, and in which month. Monthly counters expire after about 40 days. They are deleted when you delete your account.

## Purchases

Subscriptions are processed by Apple (App Store) or Google (Google Play). We never see your payment details. We use **RevenueCat** to manage subscription status. RevenueCat receives your account ID and purchase information (product, dates, store transaction IDs) from the store, so Pro works on every device you sign in on. See [RevenueCat's privacy policy](https://www.revenuecat.com/privacy).

## Service providers

| Provider | Role |
|---|---|
| Supabase | Sign-in and the database that keeps your account's data |
| Our email provider | Sends sign-in codes |
| Cloudflare | Hosts our AI service and this website; processes network data such as IP addresses to deliver and protect them |
| Anthropic | Runs the AI model that reads receipts and answers questions |
| RevenueCat | Manages subscription status |
| Apple / Google | Sign in with Apple, app distribution and payments |

We do not use analytics, advertising or tracking SDKs, and we do not sell or share personal data for advertising. This website uses no cookies or analytics.

## Deleting your account

In the app, open **Settings → Delete account**. This deletes your sign-in, every entry, receipt line, repeat and setting in your account, your usage counters and your RevenueCat customer record, and erases the copy on that device. Copies on your other devices are removed the next time they open Xpense. If you subscribe to Pro, cancel the subscription in your App Store or Google Play account too; deleting your account doesn't stop the store from charging you.

Signing out keeps your account; the device keeps its copy until you sign in again.

## Children

Xpense is meant for people who earn or save their own money, including teenagers. It is not directed at children under 13, and we do not knowingly collect their personal information.

## Your choices and rights

- Turn off AI features in Settings at any time.
- Change your name, pay and goals in Settings, or delete your account there.
- Depending on where you live (for example under GDPR or CCPA), you may have additional rights to access, correct or delete your data. Contact us at {{CONTACT_EMAIL}} and we will respond within 30 days.

## Changes

We will update this page if our practices change and revise the date at the top.
