# Agent Collaboration Log

This file is the shared scratchpad between **cowork** (Claude in Cowork mode, orchestrating dispatch tasks) and **codex** (OpenAI Codex CLI, running on the same Mac). Both read before starting a task and append after finishing.

## Protocol

- Add a new section every time you start or finish meaningful work.
- Format: `## [YYYY-MM-DD HH:MM TZ] <agent> → <agent>` (use `all` if for everyone).
- Inside the section:
  - **Done:** what you finished this turn
  - **TODO for <other>:** what you need them to pick up
  - **Blocker:** anything stuck, with details
  - **Files:** paths touched (so the other agent knows where to look)
- Keep newest at the bottom (chronological).
- Don't delete history — just append.
- When you start a task, `cat .agents/collab.md | tail -100` first.

## User-level rules

- Address xiuyi (the user) as 老板 in messages directed at them; in this file just use neutral phrasing.
- The user's preferred working style: ship fast, don't ask for verification, fix things ourselves, escalate only when blocked.
- Local builds only (`eas build --local`), never EAS cloud.
- Android build needs `JAVA_HOME=$(/usr/libexec/java_home -v 21)`.
- Build artifacts go to `/Volumes/BuildSSD/dev/eas-tmp/`. Dev caches (DerivedData / CoreSimulator / Gradle / Pods / npm / yarn / expo) are all symlinked to `/Volumes/BuildSSD/dev/`.
- Internal disk is 256 GB and small — don't generate big artifacts on `/` if you can help it.

---

## [2026-06-17 21:30 UTC] cowork → codex

**Done:**
- Shipped Android v3.1.6 vc115 to Play Internal (PR #275, commit d7a1e4f, branch `hotfix/v3.1.6-keptroom-header-unify`).
- Currently iOS v3.1.6 vc115 + a new vc116 build (both platforms) is in flight via the v3.1.6 code task.

**Recent fix context (so you can pick up tomorrow):**
- v3.1.4 added `keptRooms` zustand store (`src/store/keptRooms.ts`) — back press on a kept room should not re-prompt. Was missing on the second header branch in `WorldChatScreen.tsx`.
- v3.1.5 you (codex) fixed the "online count fly" by unifying WorldChatScreen's second header to use `openRoster` / `openRosterUser` with `InteractionManager.runAfterInteractions`, plus the `deferOpen()` rollout across ~16 files, plus `me.id / me._id` compat.
- v3.1.6 in progress: header unified to 3 icons (👥🔔🔗), 加好友 moved into the roster sheet, 举报 moved to message long-press. Roster is now an in-screen bottom sheet (not RN Modal) to avoid Android Modal handoff race.

**TODO for codex:**
- No active task. If you start work, append a new section.

**Blocker:**
- None.

**Files recently touched:**
- `app-rn/src/screens/world-chat/WorldChatScreen.tsx`
- `app-rn/src/store/keptRooms.ts`
- `app-rn/app.json` (versionCode/buildNumber)
