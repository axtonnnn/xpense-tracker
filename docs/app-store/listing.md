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
Your first paycheck, your first rent, your first real budget. Snap a receipt, see what's safe to spend, and keep money for what you need.
```

**Description** (4,000 max)

```text
Xpense is a simple budget for people who've just started earning: a first job, a part-time job next to school, or saving up for something big. It helps you spend on what you need, not on what you want, without a spreadsheet.

SNAP A RECEIPT, AI DOES THE TYPING
Take a photo of a receipt or bill. Xpense reads every item, the total and the date, and sorts each line into a need or a want. Check it, change anything with a tap, and save.

KNOW WHAT'S SAFE TO SPEND
After rent, bills still due and your savings goal, Xpense shows what's left to spend this month, and about how much that is per day. Paid weekly or monthly, it works either way.

PAUSE BEFORE YOU BUY
Thinking about something new? "Should I buy this?" shows the price in hours of your work and checks it against your own budget this month, with an honest second opinion and a cheaper idea.

DRAWN LIKE A SKETCHBOOK
No colour-coded guilt. Needs are solid ink, wants are pencil hatching, and your week reads at a glance.

ON ALL YOUR DEVICES
Sign in with Apple or an email code, and your budget is the same on your iPhone, iPad and Mac.

PRIVATE
• Your budget is private to your account; no bank login
• AI features ask first, and we don't keep your photos
• No ads, no tracking, and we never sell your data
• Face ID lock, and delete your account any time in Settings

FREE
• Expense and income tracking with history and search
• Weekly and monthly charts of needs and wants
• What's safe to spend, and need/want tagging
• Up to 3 repeating bills or paychecks
• 3 free AI receipt scans

XPENSE PRO
• Up to 300 AI receipt and bill scans a month
• "Should I buy this?" checks and a monthly AI review
• 6-month and yearly trends, and spending by category
• Unlimited repeating bills and paychecks, your own categories and CSV export

Xpense Pro is an auto-renewing subscription: $2.99 a month, or $19.99 a year with a 1-week free trial. Prices are in US dollars and may vary by country. Payment is charged to your Apple ID account when you confirm the purchase. The subscription renews automatically unless you cancel at least 24 hours before the end of the current period, and your account is charged for the renewal within 24 hours before the period ends. Manage or cancel it any time in your App Store account settings.

Terms of Use: https://YOUR-SERVER/terms
Privacy Policy: https://YOUR-SERVER/privacy

Xpense gives budgeting suggestions, not financial advice.
```

**Keywords** (100 max, commas without spaces; words already in the name or subtitle are left out)

```text
budget,receipt,scanner,money,savings,first job,paycheck,student,bills,saving,spending,planner,rent
```

**Support URL**

```text
https://YOUR-SERVER/support
```

**Marketing URL** (optional; your server's home page introduces Xpense and links to the App Store)

```text
https://YOUR-SERVER/
```

**Copyright**

```text
2026 Your Name
```

**Screenshots** (made by `npm run store:screenshots`, in `docs/app-store/screenshots/`):

- **6.9" iPhone** slot: the five `iphone-*.jpg` images (1320 × 2868), in order. App Store Connect uses them for the smaller iPhones too.
- **13" iPad** slot: the two `ipad-*.jpg` images (2752 × 2064). They're required because Xpense runs on iPad. The same layout is what people see on a Mac.

## App Privacy

**Privacy Policy URL**

```text
https://YOUR-SERVER/privacy
```

**Data collection:** choose **Yes, we collect data**, then:

| Data type | Purpose | Linked to the user? | Used for tracking? |
|---|---|---|---|
| Contact Info → **Email Address** (to sign in) | App Functionality | Yes | No |
| Contact Info → **Name** (first name, if given) | App Functionality | Yes | No |
| Financial Info → **Other Financial Info** (entries, pay and goals kept in the account; totals sent for AI answers) | App Functionality | Yes | No |
| Identifiers → **User ID** (the account ID) | App Functionality | Yes | No |
| Purchases → **Purchase History** (through RevenueCat) | App Functionality | Yes | No |
| Usage Data → **Other Usage Data** (how many AI requests an account made this month) | App Functionality | Yes | No |
| Photos or Videos → **Photos** (receipt scans, sent to the AI and not kept) | App Functionality | No | No |

Nothing is used for tracking or advertising.

## App Review Information

**Sign-in required:** Yes. Under **Sign-in information**, leave the user name and password empty and explain in the notes that Sign in with Apple creates an account (there are no passwords). Add your name, phone number and email as the contact.

**Notes**

```text
Sign-in: please use Sign in with Apple on the first screen. It creates an account in one step; Xpense has no passwords. (Sign-in with a 6-digit email code also works.)

AI features: before anything is sent, the app asks for permission (guideline 5.1.2(i)) and explains that receipt photos go to our AI service, which uses Anthropic's Claude. Every account gets 3 free scans. To test: AI mode > Take photo (or Choose from photos) > any receipt. Reading takes 10 to 60 seconds.

Xpense Pro is an auto-renewable subscription (monthly, or yearly with a 1-week free trial). It can be bought with a sandbox account from any locked feature, for example Dashboard > "6 months", or from Settings > See Pro plans. Restore purchases is on the Pro screen and in Settings > More.

Account deletion (guideline 5.1.1(v)): Settings > Delete account deletes the account and all its data.

Xpense runs on iPhone, iPad and Apple silicon Macs; on iPad and Mac the tabs become a sidebar.
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
