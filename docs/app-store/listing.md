# App Store listing

Everything App Store Connect asks for, ready to paste. Replace `YOUR-SERVER` with your AI server's address (for example `xpense-ai.yourname.workers.dev`). `npm run store:check` confirms every field still fits Apple's limits after you edit it.

## App information

**Name** (30 characters max). Names are unique across the App Store; if this one is taken, try the alternatives.

```text
Xpense: AI Expense Tracker
```

Alternatives: `Xpense – Needs vs Wants`, `Xpense: Budget & Receipts AI`. The name under the icon on the home screen stays "Xpense" either way.

**Subtitle** (30 max)

```text
Spend on needs, not wants
```

**Category:** Finance. Secondary (optional): Productivity.

**Content rights:** No, it doesn't contain, show or access third-party content.

**Age rating:** answer **None** or **No** to every question (no violence, gambling, contests, medical content, user-generated content, messaging, ads, web browsing or parental controls). The result is **4+**.

## Version page

**Promotional text** (170 max, can be changed without a new version)

```text
Snap a receipt and AI sorts every item into needs and wants. See what's safe to spend this month and keep more of your money for what matters.
```

**Description** (4,000 max)

```text
Xpense helps you spend on what you need, not on what you want, without a spreadsheet.

SNAP A RECEIPT, AI DOES THE TYPING
Take a photo of a receipt or bill. Xpense reads every item, the total and the date, and sorts each line into a need or a want. Check it, change anything with a tap, and save.

SEE WHERE YOUR MONEY REALLY GOES
Your dashboard shows needs and wants week by week, against your income. Spot when the extras creep up and watch your savings grow.

KNOW WHAT'S SAFE TO SPEND
Xpense works out how much you can still spend this month after your bills and your savings goal, and what that means per day.

PAUSE BEFORE YOU BUY
Thinking about something new? "Should I buy this?" shows the price in hours of your work and as a share of your safe-to-spend, gives an honest second opinion and suggests a cheaper alternative.

PRIVATE BY DESIGN
• No account and no bank login
• Your budget is stored only on your phone
• AI features ask first, and we don't keep your photos
• Face ID lock, and delete everything with one tap

FREE
• Expense and income tracking with history and search
• Weekly and monthly progress charts
• Safe-to-spend and need/want tagging
• Up to 3 repeating bills or paychecks
• 3 free AI receipt scans

XPENSE PRO
• Up to 300 AI receipt and bill scans a month
• "Should I buy this?" checks and a monthly AI review with a safety score
• 6-month and yearly trends, and spending by category
• Unlimited repeating bills and income, custom categories and CSV export

Xpense Pro is an auto-renewing subscription: $2.99 a month, or $19.99 a year with a 1-week free trial. Prices are in US dollars and may vary by country. Payment is charged to your Apple ID account when you confirm the purchase. The subscription renews automatically unless you cancel at least 24 hours before the end of the current period, and your account is charged for the renewal within 24 hours before the period ends. Manage or cancel it any time in your App Store account settings.

Terms of Use: https://YOUR-SERVER/terms
Privacy Policy: https://YOUR-SERVER/privacy

Xpense gives budgeting suggestions, not financial advice.
```

**Keywords** (100 max, commas without spaces; words already in the name or subtitle are left out)

```text
budget,receipt,scanner,money,savings,finance,bills,income,planner,spending,saving,frugal,personal
```

**Support URL**

```text
https://YOUR-SERVER/support
```

**Marketing URL** (optional)

```text
https://YOUR-SERVER/
```

**Copyright**

```text
2026 Your Name
```

**Screenshots:** upload the five images in `docs/app-store/screenshots/` (1320 × 2868) to the **6.9" iPhone** slot, in order. App Store Connect uses them for the smaller iPhones too. No iPad screenshots are needed because the app is iPhone-only.

## App Privacy

**Privacy Policy URL**

```text
https://YOUR-SERVER/privacy
```

**Data collection:** choose **Yes, we collect data**, then:

| Data type | Purpose | Linked to the user? | Used for tracking? |
|---|---|---|---|
| Photos or Videos → **Photos** (receipt scans) | App Functionality | No | No |
| Financial Info → **Other Financial Info** (items and prices you check, monthly totals for the review) | App Functionality | No | No |
| Identifiers → **User ID** (the anonymous install ID) | App Functionality | Yes | No |
| Purchases → **Purchase History** (through RevenueCat) | App Functionality | Yes | No |
| Usage Data → **Other Usage Data** (how many AI requests an install made this month) | App Functionality | Yes | No |

Nothing is used for tracking or advertising, and the budget data itself never leaves the phone.

## App Review Information

**Sign-in required:** No. Add your name, phone number and email as the contact.

**Notes**

```text
Xpense has no accounts. All budgeting data is stored on the device.

AI features: before anything is sent, the app asks for permission (guideline 5.1.2(i)) and explains that receipt photos go to our AI service, which uses Anthropic's Claude. Every install gets 3 free scans. To test: AI mode > Take photo (or Choose from photos) > any receipt. Reading takes 10 to 60 seconds.

Xpense Pro is an auto-renewable subscription (monthly, or yearly with a 1-week free trial). It can be bought with a sandbox account from any locked feature, for example Dashboard > "6 months", or from Settings > See Pro plans. Restore purchases is on the Pro screen and in Settings > About.

Settings > Your data > Delete all data erases everything on the device.
```

## In-app purchases (subscriptions)

Create one subscription group and two subscriptions in **Monetization → Subscriptions**.

**Subscription group:** reference name `Xpense Pro`. Add an English localization with the display name `Xpense Pro`.

| | Monthly | Yearly |
|---|---|---|
| Reference name | `Xpense Pro Monthly` | `Xpense Pro Yearly` |
| Product ID | `xpense_pro_monthly` | `xpense_pro_yearly` |
| Duration | 1 month | 1 year |
| Price | $2.99 | $19.99 |
| Introductory offer | none | Free, 1 week, all countries |
| Display name | `Xpense Pro Monthly` | `Xpense Pro Yearly` |
| Description | `AI scans, buy checks and reviews` | `A year of AI scans, checks and reviews` |

For both, the **Review Information** screenshot is `docs/app-store/iap-review.jpg`, with this note:

```text
Shown on the Xpense Pro screen: Settings > See Pro plans, or any locked feature such as Dashboard > "6 months".
```
