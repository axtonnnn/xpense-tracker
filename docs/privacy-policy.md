<!-- Served by the AI server at /privacy. {{TOKENS}} are filled in from the [vars] in worker/wrangler.toml. -->
# Xpense Privacy Policy

_Last updated: {{LAST_UPDATED}}_

Xpense ("we", "us") is a budgeting app that helps you track income and expenses and spend on what you need. This policy explains what data the app handles and why.

**Contact:** {{OWNER_NAME}}, {{CONTACT_EMAIL}}

## The short version

- Your transactions, receipt photos, income, settings and history are stored **only on your device**. We cannot see them.
- There is **no account**, no bank login, no advertising, no tracking and no sale of data.
- AI features only run after you allow them. They send just what's needed (a receipt photo, an item and its price, or your monthly totals) to read or answer that request. **We don't keep it.**

## Data stored on your device

| Data | Purpose |
|---|---|
| Transactions (amount, date, category, merchant, notes, need/want split) | Core budgeting features |
| Receipt photos you save | Shown with the transaction they belong to |
| Settings (currency, expected income, savings goal, hours per week, preferences) | Safe-to-spend and "hours of work" calculations |

This data stays in the app's private storage on your phone. If you back up your phone to iCloud or a computer, the backup includes it, and we can't access those backups. It is removed when you use **Settings → Delete all data** or uninstall the app. You can export it at any time with **Settings → Export as CSV** (Pro).

## AI features (optional)

Xpense asks for your permission before using AI. You can turn AI off at any time in **Settings → Allow AI features**.

When you use an AI feature, the app sends the following over an encrypted connection (HTTPS) to our AI service, which runs on Cloudflare Workers:

| Feature | What is sent |
|---|---|
| Receipt & bill scanning | The photo you choose, your currency, locale and today's date |
| "Should I buy this?" | The item name and price you type, and your currency |
| Monthly review | This month's totals: income, spending, needs, wants, savings goal and per-category totals. No individual transactions, merchants or notes |

Our service forwards the request to **Anthropic's Claude API** to produce the answer and returns the answer to your phone. **We do not store the photos, text or answers.** Anthropic processes this data as our service provider under its commercial terms. It does not use API data to train its models, and may keep requests for a limited period for safety and abuse monitoring, as described in [Anthropic's Privacy Policy](https://www.anthropic.com/legal/privacy).

AI answers can contain mistakes. Always check amounts before saving.

## Anonymous install ID

On first launch the app creates a random identifier (a UUID) and stores it securely on your device. It is not linked to your name, email, phone number or advertising ID. We use it to:

- count your free trial scans and monthly fair-use limits (stored as small counters on our server: the ID, a count and a month),
- link your Pro subscription to this install through RevenueCat.

Monthly usage counters expire automatically after about 40 days. The free-trial counter is kept to prevent abuse of the free trial. Email {{CONTACT_EMAIL}} with your Support ID (Settings → About) if you want it removed.

## Purchases

Subscriptions are processed by Apple (App Store) or Google (Google Play). We never see your payment details. We use **RevenueCat** to manage subscription status. RevenueCat receives your anonymous install ID and purchase information (product, dates, store transaction IDs) from the store. See [RevenueCat's privacy policy](https://www.revenuecat.com/privacy).

## Service providers

| Provider | Role |
|---|---|
| Cloudflare | Hosts our AI service; processes network data such as IP addresses to deliver and protect it |
| Anthropic | Runs the AI model that reads receipts and answers questions |
| RevenueCat | Manages subscription status |
| Apple / Google | App distribution and payments |

We do not use analytics, advertising or tracking SDKs, and we do not sell or share personal data for advertising. This website uses no cookies or analytics.

## Children

Xpense is not directed at children under 13, and we do not knowingly collect their personal information.

## Your choices and rights

- Turn off AI features in Settings at any time.
- Delete all on-device data in Settings, or uninstall the app.
- Contact us to ask about, or delete, the anonymous counters linked to your install ID. You'll find it in **Settings → About → Support ID**.

Depending on where you live (for example under GDPR or CCPA), you may have additional rights to access or delete data. Contact us at {{CONTACT_EMAIL}} and we will respond within 30 days.

## Changes

We will update this page if our practices change and revise the date at the top.
