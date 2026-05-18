# Meyou 密友 — React Native + Expo

The next-generation Meyou app: interest-based social/dating for Malaysia (KL / PJ / Penang / Subang). Built on Expo SDK 52.

This repository replaces the legacy Flutter app in `../app/`. See `../.claude/plans/app-vast-llama.md` for the full redesign plan.

## Quick start

```bash
npm install
npx expo start
```

Then press `i` for iOS simulator or `a` for Android emulator.

## Stack

- **Expo SDK 52** + React Native 0.76 (new architecture enabled)
- **React Navigation 7** — native stack + bottom tabs
- **Zustand** — state management
- **React Query** — server cache
- **Reanimated 3** + Gesture Handler — animations (card swipe etc.)
- **socket.io-client** — realtime
- **Apple / Google Sign-In** — auth providers (plus email OTP)

## Structure

```
src/
├── App.tsx               # Root w/ providers + NavigationContainer
├── theme/                # Design tokens, fonts, ThemeProvider
├── components/           # Atomic UI (Button, Chip, Avatar, Sheet, ...)
├── screens/              # Feature screens grouped by tab
│   ├── auth/             # Welcome, EmailEntry, OTPCode, InterestTagsPicker
│   ├── discover/         # Card stack + Nearby grid
│   ├── moments/          # Feed + composer
│   ├── chats/            # Threads list + ChatDetail
│   └── profile/          # Profile + settings sub-pages
├── navigation/           # RootNavigator, AuthStack, MainTabs
├── store/                # Zustand stores per domain
├── api/                  # axios client, REST helpers, WS
├── data/                 # Static data (interest tags)
├── i18n/                 # en/zh resources
└── utils/                # distance, time, permissions helpers
```

## Backend

Same backend as before: `https://gaymeet-api.onrender.com` (Node + Express + MongoDB on Render). Schema is evolving — see plan file.

## Design source

Visual & behavior spec lives in `/tmp/chatapp_design/design_handoff_meyou/` (unzipped from `chatapp.zip`):
- `README.md` — visual tokens, IA, components, screens
- `FUNCTIONAL_LOGIC.md` — end-to-end flows, WS events, error paths
