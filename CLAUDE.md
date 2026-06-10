# Meetup Nearby - Project Guidelines

## Working Principles
- 先思考后行动。在编写代码之前先阅读现有文件。
- 输出要简洁，但推理要全面。
- 倾向于编辑而不是重写整个文件。
- 不要重新读取你已经读过的文件，除非该文件可能已更改。
- 在声称完成之前测试你的代码。
- 不要使用谄媚的开场白或冗余的结尾。
- 保持解决方案简洁直接。
- 用户指令始终优先于此文件。

## Project Structure
- `/app/` — Flutter mobile app (195 dart files, 32 feature modules)
- `/backend-express/` — Node.js + Express + MongoDB backend
- `/backend/` — Legacy NestJS (not used)

## Key Info
- Bundle ID: com.meetupnearby.app
- API: https://gaymeet-api.onrender.com
- MongoDB: m0free.lusat6n.mongodb.net (database: gaymeet)
- GitHub: blessingfoodsdnbhd-spec/gaymeet-app
- Test account: hafiz@example.com / password123

## Common Commands
- APK build: `cd app && flutter build apk --release`
- iOS build: `cd app && flutter build ios --no-codesign`
- Backend local: `cd backend-express && node server.js`
- Seed data: `cd backend-express && node src/seed.js`
- Local dev: `flutter run --dart-define=API_URL=http://localhost:3000`

## 32 Feature Modules
auth, business, calendar, call, chat, date_room, discover, dm, events, gifts, groups, health, home, location, maintenance, matches, moments, nearby, onboarding, places, premium, profile, questions, referral, safety, saw_you, secret_code, security, settings, stickers, stories, verification

## Backend Routes (37)
account, auth, blocks, boost, business, calendar, calls, date-rooms, direct-messages, energy, events, follows, gifts, groups, matches, moments, notifications, photos, places, plates, popular, private-photos, promotions, questions, referrals, safe-date, secret-codes, shouts, status, stickers, stories, subscriptions, swipes, two-factor, users, verification

## Status
- Flutter analyze: 0 errors
- Backend: deployed and connected to MongoDB
- iOS: builds successfully
- Android APK: builds but crashes on launch (Firebase issue being fixed)
- Apple Developer: registered

---

# Design System (Meyou 密友 — RN app)

> **Single source of truth: `app-rn/src/theme/tokens.ts`, consumed via `useTheme()`.**
> NEVER hardcode a hex, font size, radius, spacing value, or icon size in a
> component. Pull it from `theme.*`. If a value you need isn't a token, add it
> to `tokens.ts` first, then use it. New code should prefer the **semantic**
> color names (`primary`, `success`, `error`, …) over raw functional ones.
>
> Usage: `const theme = useTheme();` → `theme.colors.primary`,
> `theme.typography.size.h1`, `theme.spacing.l`, `theme.radius.l`,
> `theme.iconSize.m`, `theme.shadows.card`.

## Colors (`theme.colors`)
Light theme (the only theme shipping for v2; `colors.dark.*` are placeholders).

| Token | Hex | Use |
|-------|-----|-----|
| `bg` | `#FAFAFC` | Screen background |
| `surface` | `#FFFFFF` | Cards, sheets, inputs |
| `surface2` | `#F4F4F8` | Inset / secondary surface |
| `line` | `#E6E5EC` | Hairline borders, dividers |
| `text` | `#1F1E29` | Primary text |
| `text2` | `#605F70` | Secondary text |
| `muted` / `textMuted` | `#8E8DA0` | Tertiary / placeholder text |
| `primary` | `#E25CAE` | Brand pink — primary actions, active state |
| `primarySoft` | `#FCE3F0` | Tinted primary background |
| `primaryDeep` | `#B23D87` | Pressed / emphasis primary |
| `secondary` | `#8B5CD8` | Brand purple — secondary accent |
| `success` | `#3CC479` | Positive (also `online`, `like`) |
| `error` | `#E14B5C` | Destructive / errors (also `danger`) |
| `warning` | `#F0A23C` | Caution |
| `info` | `#4F8FE8` | Informational (also `brandBlue`) |

**Brand gradient** (`brandGradient`): 4-stop sweep blue→purple→pink→orange
(`#4F8FE8 #8B5CD8 #E25CAE #F08A4A`), 135° (top-left→bottom-right). Use with
`expo-linear-gradient` for hero/logo surfaces only.

**Avatar gradients** (`avatarGradients[avatarIdx % 10]`): deterministic pair per user.

## Typography (`theme.typography`)
Font: system (PingFang SC / Noto CJK on device); `fontDisplay: 'Fraunces'` italic for the wordmark only.

| `size.*` | px | Weight | Use |
|----------|----|--------|-----|
| `display` / `displayLg` | 48 / 64 | extrabold | Splash / marketing |
| `h1` | 26 | bold (700) | **Tab screen titles** (via `TopBar title=`) |
| `h2` | 28 | bold | Large headings |
| `h3` | 18 | semibold (600) | Section / sheet headings |
| `cardName` | 22 | bold | Swipe-card name |
| `body` | 15 | regular | Body copy |
| `bodySm` | 14 | regular | Dense body, secondary rows |
| `caption` | 13 | regular | Captions, meta |
| `captionSm` / `eyebrow` | 12 | — | Smallest text / eyebrows |
| `label` | 11 | bold | ALL-CAPS micro labels, badges |

`weight`: regular 400 · medium 500 · semibold 600 · bold 700 · extrabold 800.
`letterSpacing`: tight −0.4 (big titles) · normal 0 · eyebrow 0.72 (uppercase 12px).

## Spacing (`theme.spacing`) — 4-pt grid
`xs 4 · s 8 · m 12 · l 16 · xl 20 · xxl 24 · xxxl 32 · huge 48`.
Compounds: `cardPadding 18 · fieldPaddingV 14 · fieldPaddingH 16 · topbarV 8 · topbarH 20`.

## Border radius (`theme.radius`)
`s 10 · m 14 · l 16 · xl 22 · xxl 28 · pill 999`.
Cards use `l` (16); sheets `xxl` (28) top corners; chips/buttons `pill`.

## Shadows (`theme.shadows`) — 4 elevations
`soft` (raised surface) · `card` (cards) · `pop` (modals/sheets) · `cta` (coloured glow under primary buttons). All use a purple-tinted `shadowColor`.

## Icon sizes (`theme.iconSize`) — lucide-react-native
`xs 14 · s 16 · m 20 · l 24 · xl 28`. Default action icon = `m` (20); header actions = `l` (24); empty-state glyph = `xl` (28). `strokeWidth` 1.6 default, 2+ for active/emphasis.

## Component conventions
- **TopBar** (`components/TopBar.tsx`): every tab/screen header. `title` renders at `h1`; optional `subtitle` is a 12px muted line under it; `right` holds `IconButton`s.
- **IconButton**: 38×38 circular, `surface` bg + `line` border. Wrap header/action icons in it for a consistent tap target.
- **EmptyState**: centered emoji + `title` + `subtitle` + up to 2 `Button`s (+ optional retry link). Use on every blank list (keeps screens alive — Apple 4.3(b)).
- **Button**: variants `solid` (primary, `cta` shadow) / `soft` (tinted). Height `layout.ctaHeight` 52.
- **Sheet**: bottom modal, `surface` bg, `radius.xxl` top corners, `pop` shadow.
- **Chip / TagChip**: `pill` radius, `surface2` bg, `primaryDeep` text when active.

## Rule of thumb for new screens
1. `<SafeAreaView edges={['top']} bg={theme.colors.bg}>`.
2. `<TopBar title={t('tabs.x')} />` at top (h1).
3. Content padding `spacing.xl` (20) horizontal.
4. Empty/error → `<EmptyState>`. Loading → centered `ActivityIndicator color={primary}`.
5. All sizes/colors from `theme.*` — zero magic numbers.

---

# Crash reporting (Sentry)

Client crash reporting is **scaffolded but dormant** — a complete no-op until a
DSN is supplied, so current builds are unaffected. Code: `app-rn/src/lib/sentry.ts`
(`initSentry()` / `captureException()`), wired through
`app-rn/src/components/ErrorBoundary.tsx` and `app-rn/src/App.tsx`.

It activates only when ALL hold: a DSN is present, not `__DEV__`, and
`@sentry/react-native` is installed. To **enable** (needs a new EAS build — native
module):
1. `cd app-rn && npx expo install @sentry/react-native`
2. In `app-rn/app.json`: set `expo.extra.sentryDsn = "<your DSN>"` and add the
   `"@sentry/react-native/expo"` plugin to `expo.plugins`.
   - Get the DSN from Sentry → Project → Settings → Client Keys (DSN).
   - Prefer an EAS build secret / env read via `expo.extra` over hardcoding a DSN.
3. Rebuild (EAS). Verify with a forced `captureException(new Error('test'))`.

No backend Sentry yet; backend errors log to Render stdout.

# Performance & bundle audit

- **Metro `inlineRequires` is ON** (`app-rn/metro.config.js`) — modules evaluate
  lazily on first use, improving cold-start TTI. If a module misbehaves due to
  import-time side effects, import it eagerly at the entrypoint rather than
  disabling the flag.
- **Bundle visualizer**: `cd app-rn && npx react-native-bundle-visualizer`
  (fetched on demand via npx — intentionally NOT a pinned devDependency to avoid
  lockfile churn). Opens a treemap; look for oversized/duplicated deps.
- **Images**: remote images use `expo-image` (disk+memory cache); chat images go
  through `app-rn/src/utils/imageCache.ts`. Prefer `expo-image` over RN `Image`
  for any new remote image so it shares the cache.
- **Heavy/rare screens** (admin dashboards, MapPicker, MyAnalytics): keep imports
  leaf-only so `inlineRequires` can defer them. If a future screen pulls a large
  dep, lazy-load with `React.lazy` + `Suspense` (screens use **named** exports —
  `lazy(() => import('./X').then(m => ({ default: m.XScreen })))`).
