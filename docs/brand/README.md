# Xpense brand

![Brand sheet](brand-sheet.png)

## The idea

Xpense is a pocket sketchbook for your money: beige paper, white pages, black ink. It's made for people on their first paychecks, so it should feel personal and calm, like their own notebook, not like a bank.

Four slim leaves cross to make an **X**. One diagonal (**/**) is **needs**, drawn in solid ink; the other (**\\**) is **wants**, pencil-hatched:

- the leaves stand for saving and growing,
- the X stands for Xpense,
- the crossing point is the choice the app helps you make.

The same rule runs through the whole app, so nothing depends on colour: **needs are solid ink, wants are hatching, income is an open ring.**

## Logo

| File | Use |
|---|---|
| `assets/brand/logo.svg` | Mark + "xpense" wordmark |
| `assets/brand/mark.svg` | The mark alone (avatars, small spaces) |
| `assets/brand/icon.svg` | The app icon as a vector |

The wordmark is **Instrument Serif Italic**, lowercase. In the SVGs it is converted to outlines, so the files don't need the font installed.

In the app, use the components from `src/components/brand.tsx` rather than images:

- `<Logo />`: the mark plus the wordmark. `mark={false}` shows the wordmark alone.
- `<LogoMark />`: the mark alone. From 48 px up the wants leaves are hatched; below that they are outlines, so the mark never turns to mud.
- `<AppIcon />`: the rounded paper tile.

Rules:
- Keep clear space around the logo at least the width of one leaf.
- Don't use the mark below 16 px.
- Never swap the diagonals. Needs are always on the "/" diagonal.
- Ink on paper only. No colours, no gradients.

## Colour

Tokens live in `src/theme/tokens.ts`. The app is always light, like paper.

| Token | Hex | Used for |
|---|---|---|
| Paper | `#F6F2EA` | The ground every screen is drawn on |
| Page | `#FFFFFF` | Cards, inside a sketched frame |
| Sand | `#E7DFD0` | Bills still due, switch tracks |
| Ink | `#111111` | Text, lines, needs, buttons |
| Graphite | `#5E5A53` | Quiet text |
| Pencil | `#716B62` | Hints, placeholders, margin notes |
| Alert | `#8C2F25` | Errors and "delete account" only |

Every text pair meets WCAG AA (4.5:1): graphite on paper is 6.1:1, pencil on paper 4.7:1.

## Type

All three are under the SIL Open Font License and load from `@expo-google-fonts`. Each weight is its own family, so pick one through `fonts.*` or `<AppText weight="…">`, never with `fontWeight`.

| Style | Font | Size / line | Use |
|---|---|---|---|
| `hero` | Instrument Serif | 56 / 60 | The one big number on a screen (safe to spend) |
| `display` | Instrument Serif | 44 / 48 | Screen titles |
| `title` | Instrument Serif | 28 / 32 | Section titles |
| `number` | Instrument Serif | 30 / 34 | Amounts in tiles |
| `body` | Inter Regular | 16 / 23 | Text |
| `caption` | Inter Regular | 13 / 18 | Secondary text |
| `label` | Inter SemiBold, uppercase, +1.4 tracking | 12 / 16 | Section labels |
| `note` | Caveat Medium | 21 / 23 | Short pencil notes in the margins, never for anything you must read |

## Drawing

Frames, rules, scribbled underlines, rings and the illustrations are drawn by one seeded "pen" in `shared/sketch.ts`: lines run a little past their corners and bow slightly, and a fainter second pass sits under the first. The seed makes each drawing look hand-made but identical on every render. The app (`src/components/sketch.tsx`), the website (`worker/src/pages.ts`) and the store screenshots all use it.

- **Card:** white page, sketched frame.
- **Primary button:** an ink plate with 2 px corners. **Secondary:** a sketched outline.
- **Field:** a label and an ink underline, like writing on a line.
- **Stamp:** a tilted inked box with handwriting, for status ("on track", "sleep on it").
- **Selected tab:** a scribbled underline.

## App icon

| Platform | Source | Configured in `app.json` |
|---|---|---|
| iOS 26+ | `assets/xpense.icon`, an Icon Composer bundle: needs and wants are separate layers on a paper fill | `ios.icon` |
| Older iOS, App Store | `assets/images/icon.png` (1024 px, no transparency) | `icon` |
| Android | `android-icon-foreground.png` (leaves at 72% so they stay inside the safe zone), `android-icon-background.png` and `android-icon-monochrome.png` (Android 13 themed icons) | `android.adaptiveIcon` |
| Splash | `splash-icon.png` on paper | `expo-splash-screen` plugin |
| Web | `favicon.png` | `web.favicon` |

## Regenerating the files

```bash
npm run brand                                   # logos, icons, splash and this page's brand sheet
CHROME_PATH=/path/to/chromium npm run brand     # with any Chromium instead of Google Chrome
python3 scripts/brand/web-fonts.py              # the website's fonts (needs fonttools and brotli)
```

The geometry is in `scripts/brand/mark.mjs`. The in-app `<LogoMark />` and the website draw the same geometry; if you change a number in `mark.mjs`, change it in `src/components/brand.tsx` and `worker/src/pages.ts` too.

## Voice

The app talks like a friend who's good with money: calm, specific, never shaming. It states the fact, then gives one small step.

- "Wants are up 12% on the same days in September. A good week to pause the extras."
- "Sleep on it" rather than "Don't buy this".
- It says **needs** and **wants**, never "good" or "bad" spending.
- Pencil notes are short and lowercase: "guessed from "bus", tap below to change".
