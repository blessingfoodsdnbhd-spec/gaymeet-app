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

## [2026-06-18 10:15 MYT] codex → cowork

**Done:**
- Ran QC on app-rn Android emulator for announcement modal + world chat room online roster/settings path.
- Fixed Android announcement modal close buttons: moved controls below status-bar area and isolated modal root/backdrop touch layers.
- Fixed RoomSettingsSheet duplicate React keys by de-duping member/friend API results and using stable unique list keys.
- Fixed roster → room settings same-frame handoff by using `deferOpen(() => setSettingsOpen(true))` after closing roster.
- `cd app-rn && npm run lint` passes.

**TODO for cowork:**
- If continuing release QA, re-test user-created room path on a clean Android emulator/device: open room → tap online count/👥 → tap 聊天室设置 → confirm settings sheet opens.
- Watch for lingering emulator-only noise: system Binder “No space left on device” appeared during adb/uiautomator dumps.

**Blocker:** 无

**Files:**
- `app-rn/src/components/AnnouncementModal.tsx`
- `app-rn/src/screens/world-chat/RoomSettingsSheet.tsx`
- `app-rn/src/screens/world-chat/WorldChatScreen.tsx`

## [2026-06-18 10:20 MYT] codex → cowork

**Done:**
- Backfilled earlier Codex work from this thread into the shared collaboration log.
- Confirmed project focus remains `app-rn` + `backend-express`; legacy Flutter `/app` should stay untouched unless explicitly fixing old Android crash.
- Investigated user report: new/user-created world chat rooms had online-count/roster/settings tap problems, especially compared with official rooms that have fewer header actions.
- Created/used Android emulator QA path for world chat rooms including `codex-test` and existing `Bbzai` room.
- Found that Android dev Element Inspector can make the UI appear unresponsive during QA; disabled it before continuing manual checks.
- Observed no fatal React Native crash in the tested chat path after fixes; prior duplicate-key warning came from duplicate room members.

**TODO for cowork:**
- Continue QA checklist by private chat, world chat, push, voice/image, read/unread, and Android keyboard if time permits.
- If building release, include the three current source fixes and re-run a clean-device smoke test before submitting.

**Blocker:** 无

**Files:**
- `.agents/collab.md`
- `app-rn/src/components/AnnouncementModal.tsx`
- `app-rn/src/screens/world-chat/RoomSettingsSheet.tsx`
- `app-rn/src/screens/world-chat/WorldChatScreen.tsx`

## [2026-06-18 13:00 MYT] codex → cowork

**Done:**
- Re-investigated the user report that the visible `聊天室设置` row inside the online roster sheet cannot open settings.
- Root cause clarified: the tap does fire and closes the online roster, but the separate `RoomSettingsSheet` open is lost during Android/Fabric same interaction handoff. The issue is not just icon count or hit target size.
- Replaced direct/delayed open with a parent-level pending handoff: `pendingRoomSettingsOpen` is set when the settings row is tapped, roster closes, then a `useEffect` observes `rosterOpen === false` and opens `RoomSettingsSheet` after an Android delay.
- `cd app-rn && npm run lint` passes.

**TODO for cowork:**
- Verify on a real Android device/custom room: open room → tap 👥/online count → tap `聊天室设置`; expected result is the settings sheet opens after roster closes.
- If still flaky, next escalation should be to render room settings as a mode inside `RoomOnlineSidebar` instead of chaining to a separate RN Modal.

**Blocker:** Emulator reload sometimes jumps back to the voting tab / loses room context, making coordinate-only validation unreliable. No TypeScript or fatal runtime errors observed.

**Files:**
- `app-rn/src/screens/world-chat/WorldChatScreen.tsx`
- `.agents/collab.md`

## [2026-06-18 13:40 MYT] codex → cowork

**Done:**
- Confirmed the user's report on Android emulator: in custom room `Bbzai`, tapping `在线名单` opened the roster, but tapping visible `聊天室设置` previously closed the roster without showing settings.
- Fixed the root cause by avoiding roster-sheet → separate settings-sheet handoff on Android. `RoomSettingsContent` can now render inline inside `RoomOnlineSidebar`, so `聊天室设置` switches the existing bottom sheet into settings mode instead of closing one layer and opening another.
- Re-tested on Android emulator: `Bbzai` → `在线名单` → `聊天室设置` now shows `邀请好友 / 查看成员 / 退出聊天室`; `查看成员` opens the member list.
- `cd app-rn && npm run lint` passes.

**TODO for cowork:**
- If preparing release, smoke-test one creator-owned custom room too, to confirm the creator edit/save/delete controls render correctly inside the inline settings mode.

**Blocker:** 无

**Files:**
- `app-rn/src/screens/world-chat/RoomSettingsSheet.tsx`
- `app-rn/src/screens/world-chat/RoomOnlineSidebar.tsx`
- `app-rn/src/screens/world-chat/WorldChatScreen.tsx`
- `.agents/collab.md`

## [2026-06-18 19:15 MYT] cowork → all

**Done:** Fixed the *remaining* roster-sheet touch bug — after codex's inline-settings fix, the rows (`聊天室设置`, user rows) were STILL untappable on Android wherever chat content overlapped them. Built vc117, Android-15 emulator-verified all 6 cases, shipped Play Internal.

**真凶 (root cause):** Two compounding defects in the vc115/116 *in-screen* roster overlay — NOT a handoff issue:
  1. `RoomOnlineSidebar` `modalRoot` used `StyleSheet.absoluteFillObject` (a `position:absolute` root). Under Fabric/newArch that gives the native root view a **broken hit region** → it swallows child touches. (`Sheet.tsx` documents this exact trap and uses `flex:1`.)
  2. The overlay was a mere **sibling of the chat**, relying on `elevation/zIndex`. That lifts it *visually* but does NOT win **touch** order against the message list + composer that physically overlap the sheet — so taps on the row labels (sitting over a message bubble / the composer) landed on the chat behind. Proven via uiautomator: rows were `clickable=true` with correct bounds, the chat subtree was drawn ON TOP in the overlap region, and tapping the clear left edge (no chat overlap) worked while the label area didn't.

  This is exactly why every prior `zIndex`/`elevation` attempt failed: zIndex only reorders **draw** order, not the Fabric hit region nor the sibling-subtree touch order.

**改了哪里 (fix):** `app-rn/src/screens/world-chat/RoomOnlineSidebar.tsx` — render the roster inside the shared `<Sheet>` (a real RN `<Modal>` = separate window that always wins touch and never overlaps the chat) with a `flex:1` GestureHandlerRootView root, `animationType="none"` + `statusBarTranslucent` (no Android-15 fly), swipe-to-dismiss. Settings stays INLINE (codex's `settingsContent`/setMode) so there's no second-Modal handoff. vc116→117.

**给 codex 的提醒:** For an Android "touch dead but visually fine" bug, an **in-screen absolute-fill overlay can never reliably win touch** against sibling content (chat/composer) — `elevation`/`zIndex` only fix visuals. Use a real `<Modal>` (separate window) — i.e. the shared `<Sheet>` — and never use a `position:absolute` root for a touch surface under Fabric (use `flex:1`). The user's KeyboardAvoidingView hunch was directionally right (the chat *is* wrapped in that KAV and was drawn on top), but the precise fix is the Modal, not touching the KAV.

**Blocker:** 无. uiautomator dies on the Fabric WorldChatScreen (returns 1 node) — revive with `adb shell pkill -f uiautomator`.

**Files:**
- `app-rn/src/screens/world-chat/RoomOnlineSidebar.tsx`
- `app-rn/app.json` (vc117)
- `.agents/collab.md`

---

## [2026-06-19 22:25 MYT] cowork → all

**Done:** Built v3.1.8 vc118/bn118 (在线人数 redesign), Android-15 emulator-verified, shipped BOTH platforms.
- **Android vc118 → Play Internal:** ✓ "Submitted to Google Play Store" (EAS submission `58f3b2ab-369c-4459-93fe-920f0dc68a93`).
- **iOS bn118 → TestFlight:** ✓ uploaded to App Store Connect, processing (EAS submission `3dae8b6a-b8ce-496b-b261-fc6ec99e40df`); appears at appstoreconnect.apple.com/apps/6762375260/testflight/ios.
- Branch `feat/online-avatar-strip`, commit `31b13c7`, PR #278.

**改了什么 (在线人数: sheet → inline strip + 全屏 list):**
- **NEW** `OnlineAvatarStrip.tsx` — horizontal avatar strip pinned under the room header (replaces the old "在线 N 人" → sheet entry). Live WS roster, sorted self → creator → admin → followed → rest (stable index tiebreak). Self = green ring, creator = 👑. Trailing **👁 N** pill → full-screen list. A **flex child, NOT `position:absolute`** (carries the vc117 Fabric hit-region lesson forward).
- **NEW** `OnlineUsersListScreen.tsx` — a real **Screen** (route `OnlineUsersList`, `slide_from_right`), NOT a Sheet — sidesteps the vc115/117 sheet touch bugs entirely. 3 tabs 在线/离线/你关注的 + 🔍 search (autofocus) + virtualized FlatList. Data: `getRoomMembers` + `getFollowing`; optimistic 关注 toggle; EmptyState for empty rooms. Row tap → shared action sheet.
- **NEW** `utils/useUserActionSheet.ts` — shared 查看资料/添加好友/私聊 native action sheet (deferOpen guard), reused by the strip, the full list, and the existing roster sheet.
- `WorldChatScreen.tsx` — roster WS handler now stores the FULL `PlazaRosterUser[]` (superset of mention candidates, so @mention still works); `followingQ` drives strip follow-priority; strip wired under header; new route registered in `types.ts` + `RootNavigator.tsx`.
- i18n `worldChat.onlineList.*` in zh/en/ja/ko. `tsc --noEmit` clean.

**Emulator verification (Android 15, qa-premium, vc118 universal APK) — all 6 PASS, no crashes:**
1. Strip renders under header (flex, no hit bug); 2. self green ring + creator 👑 crown (seen on 憨 in list); 3. 👁 N → full-screen list; 4. 3 tabs + search toggle (pink active icon + autofocus); 5. row tap → native action sheet (查看资料/添加好友/私聊/取消), self correctly skipped (QA Premium row has no 添加好友); 6. rows load from getRoomMembers with badges/crown/online-offline/follow button, correct sort; EmptyState for empty rooms (world lobby REST roster is empty — strip still shows live WS online via 👁 N).

**给 codex 的提醒:** 在线人数 is no longer a Sheet — it's the inline strip + the `OnlineUsersList` Screen. The strip reflects the **live WS roster** (online presence); the full list reflects **REST `getRoomMembers`** (all members, `isOnline` from REST which lags WS — that's why the world-lobby 在线 tab can be empty while 👁 shows 1). If you extend presence, reconcile those two sources.

**Blocker:** 无.

**Files:**
- `app-rn/src/screens/world-chat/OnlineAvatarStrip.tsx` (new)
- `app-rn/src/screens/world-chat/OnlineUsersListScreen.tsx` (new)
- `app-rn/src/utils/useUserActionSheet.ts` (new)
- `app-rn/src/screens/world-chat/WorldChatScreen.tsx`
- `app-rn/src/navigation/types.ts`, `RootNavigator.tsx`
- `app-rn/src/i18n/{zh,en,ja,ko}.json`
- `app-rn/app.json` (3.1.6→3.1.8, vc117→118, bn117→118)

---

## [2026-06-20 00:30 MYT] cowork → all

**Done:** Fixed "开新的房间还是有问题" + shipped v3.1.9 vc119/bn119 BOTH platforms, Android-15 emulator-verified end-to-end.
- **Android vc119 → Play Internal:** ✓ All done (EAS sub `0526f160-9e98-4f16-82d2-da5bcdf247e8`).
- **iOS bn119 → TestFlight:** ✓ uploaded, Apple-processing (EAS sub `4d5a2734-e5b6-4ee2-a12f-c72f7ebbccf2`).
- Branch `feat/online-avatar-strip`, commits `ccdc5bf` (fix) + `08605b8` (bump), PR #278.

**真凶 (root cause):** NOT the create API — creating a room works fine. The 广场 **热门** landing tab's 「我开的房间」empty hint says "你还没创建房间,点右下角『＋』新建一个", but **the 热门 tab had no ＋ FAB**. The create-room FAB lived only inside the per-channel `ChannelRoomsScreen` (3 levels deep: 广场 → 交友/语音 tab → tap a specific channel → ChannelRoomsScreen). Users landing on 热门 followed the hint, found no ＋, concluded room creation was broken. Tell: `Plus` was imported-but-unused in `PlazaHotList.tsx` (a FAB was meant to be here and got dropped).

**改了哪里 (fix):** `PlazaHotList.tsx` — added the ＋ 创建聊天室 FAB the hint already promises, mirroring ChannelRoomsScreen's proven pattern (small leaf `Pressable` + `position:absolute` bottom-right — NOT the vc117 absolute-fill ROOT trap). Hub-created rooms hang under the general **世界大厅 ('world')** channel (`isValidChannel('world')` ✓; backend mirrors countryCode='world'). tsc clean.

**Emulator-verified (Android 15, qa-premium, vc119 universal APK) END-TO-END:** 广场 热门 now shows the ＋ 创建聊天室 FAB → tap → CreateRoom labeled "在「世界大厅」中创建" → 名称 + 创建 → room "vc119hub" created + opened (welcome msg, avatar strip with my creator 👑, composer active). 我开的房间 reflects the new room.

**Cleanup:** deleted the 2 emulator test rooms from prod (vc118test @ friend:buddies, vc119hub @ world) + their memberships via a mongoose script.

**给 codex 的提醒:** Every UGC room MUST belong to a 二级频道 (channelId). When adding a create entry point from a context with no specific channel (the hub), default channelId to **'world'** (世界大厅) — it's a valid UGC parent and the most general bucket. The per-channel `ChannelRoomsScreen` FABs are unchanged.

**Blocker:** 无.

**Files:**
- `app-rn/src/screens/world-chat/PlazaHotList.tsx`
- `app-rn/app.json` (3.1.8→3.1.9, vc118→119, bn118→119)
