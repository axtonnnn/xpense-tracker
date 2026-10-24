# Xpense brand

![Brand sheet](brand-sheet.png)

## The idea

Four slim leaves cross to make an **X**. One diagonal (**/**) is **needs**, the other (**\\**) is **wants**:

- the leaves stand for conservation,
- the X stands for Xpense,
- the crossing point is the choice the app helps you make.

The look is evergreen on parchment, which keeps it calm and safe rather than loud.

## Logo

| File | Use |
|---|---|
| `assets/brand/logo.svg` | Mark + "xpense" wordmark on light backgrounds |
| `assets/brand/logo-dark.svg` | The same on dark backgrounds |
| `assets/brand/mark.svg`, `mark-dark.svg` | The mark alone (avatars, small spaces) |
| `assets/brand/icon.svg` | The app icon as a vector |

The wordmark is **Manrope ExtraBold**, lowercase, tracked −3%. In the SVGs it is converted to outlines, so the files don't need the font installed.

In the app, use the components from `src/components/brand.tsx` rather than images:

- `<Logo />`: the mark plus the wordmark. `mark={false}` shows the wordmark alone, as on the welcome screen under the icon.
- `<LogoMark />`: the mark alone. Variants are `light`, `dark`, `icon` and `mono`.
- `<AppIcon />`: the rounded evergreen tile.

Rules:
- Keep clear space around the logo at least the width of one leaf.
- Don't use the mark below 16 px. Leaf ribs only appear from 64 px up.
- Never swap the diagonals. Needs are always on the "/" diagonal.
- Don't recolour the leaves outside the palette below, and don't put the light mark on dark backgrounds (use `mark-dark`).

## Colour

Tokens live in `src/theme/tokens.ts`. Every screen reads them through `useColors()`, so light and dark mode stay in step.

| Role | Light | Dark | Used for |
|---|---|---|---|
| Evergreen (primary) | `#1E5B4F` | `#55AE95` | Buttons, links, selected states, trust |
| Parchment (background) | `#F6F4EE` | `#0F1A17` | Screen background |
| Surface | `#FFFFFF` | `#16231F` | Cards |
| Ink | `#1B2421` | `#E9EFEC` | Text |
| Need | `#008A6E` | `#1A9878` | Needs in charts, need chips |
| Want | `#B06F12` | `#C4862A` | Wants in charts, want chips (amber: caution, not alarm) |
| Income | `#2F6BC4` | `#5A86DA` | Money coming in |
| Danger | `#B53F36` | `#E06A5F` | Over budget, delete (used rarely) |
| Hero gradient | `#1A5A4D` → `#123F36` | `#1A4F44` → `#0E2D27` | The one most important card on a screen |
| Mint / Gold | `#8FD3B6` / `#F0BE5C` | same | Leaves on the icon and on dark or hero backgrounds |

The logo's own leaf colours are need `#0E8066` and want `#CC8418` on light backgrounds, and mint and gold on dark ones.

Two things were checked:
- **Chart colours:** under simulated protanopia, deuteranopia and tritanopia, needs, wants and income stay at least ΔE 14 apart in both themes. Income is also drawn as dots or a line, never as bars, and every chart has a legend and a table view.
- **Text pairs:** every text-on-colour pair the screens use meets WCAG AA in both themes: 4.5:1 for text, 3:1 for large text. For example, muted hero text `#CFE3DB` on `#1A5A4D` is 5.99:1.

## Type

**Manrope** (SIL Open Font License) is loaded with `@expo-google-fonts/manrope`. Each weight is its own font family, so pick a weight through `fonts.*` or `<AppText weight="…">` and never with `fontWeight`.

| Style | Size / line | Weight | Use |
|---|---|---|---|
| `hero` | 44 / 50 | ExtraBold | The one big number on a screen (safe-to-spend) |
| `display` | 28 / 34 | ExtraBold | Screen titles |
| `title` | 19 / 25 | Bold | Card titles |
| `body` | 16 / 22 | Medium | Text |
| `caption` | 13 / 18 | Medium | Secondary text, chips |
| `label` | 12 / 16, uppercase, +0.7 tracking | Bold | Section labels |

## App icon

| Platform | Source | Configured in `app.json` |
|---|---|---|
| iOS 26+ | `assets/xpense.icon`, an Icon Composer bundle: needs and wants are separate glass layers on an evergreen fill, so the icon works in the light, dark and tinted modes | `ios.icon` |
| Older iOS, App Store | `assets/images/icon.png` (1024 px, no transparency) | `icon` |
| Android | `android-icon-foreground.png` (leaves at 72% so they stay inside the safe zone), `android-icon-background.png` and `android-icon-monochrome.png` (Android 13 themed icons) | `android.adaptiveIcon` |
| Splash | `splash-icon.png` / `splash-icon-dark.png` on parchment / dark parchment | `expo-splash-screen` plugin |
| Web | `favicon.png` | `web.favicon` |

## Regenerating the files

Every logo and icon file above, and this page's brand sheet, comes from one script:
- the geometry and colours are in `scripts/brand/mark.mjs`,
- the drawing is done by `scripts/brand/render.mjs`.

```bash
npm run brand                                   # uses an installed Google Chrome
CHROME_PATH=/path/to/chromium npm run brand     # or any Chromium
```

The in-app `<LogoMark />` draws the same geometry with `react-native-svg`. If you change a number in `mark.mjs`, change it in `src/components/brand.tsx` too.

## Voice

The app speaks calmly and never shames anyone. It states the fact, then gives one small step:

- "Wants are up 12% vs Sep. A good time to pause the extras."
- "Sleep on it" rather than "Don't buy this".
- It says **needs** and **wants**, never "good" or "bad" spending.
