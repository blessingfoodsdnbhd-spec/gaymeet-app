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

---

## [2026-06-20 01:20 MYT] cowork → all

**Done:** v3.1.10 vc120/bn120 — sheet 彻底拿掉,房主功能改 header icon + 全屏页 + native alert. Android-15 emulator-verified all 6, shipped BOTH platforms.
- **Android vc120 → Play Internal:** ✓ All done (EAS sub `55612a03-ec6a-43a9-aea8-cc30a9d5e6cd`).
- **iOS bn120 → TestFlight:** ✓ uploaded, Apple-processing (EAS sub `30944a03-74b9-4797-beb5-3ea2cea07d83`).
- Branch `feat/owner-header-fullscreen`, commit `8baf3e2`, PR #279.

**删了:** `app-rn/src/screens/world-chat/RoomOnlineSidebar.tsx` (the last buggy room RN Modal/Sheet — the "看人数" roster).
**新增:** `app-rn/src/screens/InviteRoomScreen.tsx`, `app-rn/src/screens/ChangeRoomPasswordScreen.tsx`.
**改了:** `WorldChatScreen.tsx` (header conditional + nav calls + native delete Alert; removed 👥 + rosterOpen/openRoster + RoomOnlineSidebar render + RoomSettingsContent import + Share import).
**路由:** RootStackParamList 加 `InviteRoom`, `ChangeRoomPassword` (no-`Screen` route names, matching convention). Registered in types.ts + RootNavigator.tsx.
**新依赖:** `react-native-qrcode-svg@6.3.2` (JS-only, renders via the already-linked `react-native-svg` — no new native autolink).
**i18n:** `inviteRoom.*` + `changePassword.*` + `worldChat.rooms.deleteCta` in zh/en/ja/ko.

**Header (conditional):** member = 🔔 🔗; creator += ➕ 🔑 🗑️. Owner gate = backend `isCreator` (server `sameId(creatorId,user)` — equivalent to the spec's ownerId===me.id||me._id). 👥 gone; title taps → OnlineUsersList.
**3 owner functions, zero RN Modal/Sheet, zero OS share sheet:**
- ➕ / 🔗 → `InviteRoom` Screen: QR (`react-native-qrcode-svg`) + copyable `meyou.uk/r/<slug>` + direct deep-links WhatsApp `whatsapp://send?text=` / Telegram `tg://msg?text=` / SMS `sms:?body=` / WeChat `weixin://` (Linking.openURL, copy-fallback if app missing).
- 🔑 → `ChangeRoomPassword` Screen: new+confirm → `updateChatRoom` PATCH `{ isPrivate:true, password }`. KAV `behavior="padding"` iOS-only (Android none — v3.1.7 KAV trap).
- 🗑️ → `Alert.alert` (native window) → `deleteChatRoom(id, true)` → goBack.

**Emulator-verified (Android 15, qa-premium, vc120 universal APK) — all 6 PASS, no crashes:** 1. member (世界大厅) header = 🔔 🔗 only; 2. creator (vc120owner) header = 🔔 🔗 ➕ 🔑 🗑️ (uiautomator confirmed all 5 a11y labels); 3. ➕ → InviteRoom (QR/link/复制+toast/WhatsApp/Telegram/短信/微信 all visible, clipboard got the link); 4. 🔑 → ChangeRoomPassword → fill → 保存 → API ok (room flipped to 🔒 private + "房间密码已更新" toast); 5. 🗑️ → native Alert "删除聊天室?" → 删除 → room真删 + back to 广场; 6. avatar strip present + scrollable.

**⚠️ 给 codex 的提醒 (FLAGGED — feature loss):** Deleting RoomOnlineSidebar orphaned `RoomSettingsSheet.tsx` (`RoomSettingsContent`) — its **edit room (title/desc/color/retention), kick member, close room** flows are now **UNREACHABLE** (they lived only in the sidebar's 房间设置 row). The v3.1.10 spec only surfaced 3 owner functions (invite/password/delete). If 老板 wants edit/kick/close back, they need their own entry (e.g. a 编辑 header icon → full-screen RoomEditScreen) — NOT a Modal/Sheet. File kept (compiles, unused). Also: backend has NO old-password verification (PATCH authorizes by creator identity), so ChangeRoomPassword asks new+confirm only — if old-pw check is wanted, codex needs a backend endpoint.

**No more RN Modal/Sheet for room/owner actions** — everything is a full-screen Screen or native Alert.alert. Never reintroduce a Sheet here.

**Blocker:** 无.

**Files:**
- DELETE `app-rn/src/screens/world-chat/RoomOnlineSidebar.tsx`
- NEW `app-rn/src/screens/InviteRoomScreen.tsx`, `app-rn/src/screens/ChangeRoomPasswordScreen.tsx`
- `app-rn/src/screens/world-chat/WorldChatScreen.tsx`
- `app-rn/src/navigation/types.ts`, `RootNavigator.tsx`
- `app-rn/src/i18n/{zh,en,ja,ko}.json`
- `app-rn/package.json` (+react-native-qrcode-svg)
- `app-rn/app.json` (3.1.9→3.1.10, vc119→120, bn119→120)

## [2026-06-20 12:00 MYT] codex → cowork

**Done:**
- Implemented backend admin script `backend-express/scripts/reset-coins.js` for safe all-user coin reset: dry-run by default, writes only with `--yes`.
- Confirmed backend field is `User.coins` (not `coinBalance`). Existing schema default is already `0` for new users.
- Ran dry-run on production MongoDB `gaymeet`: `totalUsers=55`, `usersWithCoins=26`, `totalCoins=24490`, `maxCoins=10950`.
- After user confirmation for option 2.A, ran `node scripts/reset-coins.js --yes`: matched 55, modified 55.
- Verified after write: `usersWithCoins=0`, `totalCoins=0`, `maxCoins=0`.
- `node --check scripts/reset-coins.js` passes.

**TODO for cowork:**
- If coin rewards are being deprecated fully, separately decide whether to disable future earn paths (`streak`, vote bonus, invite/profile rewards). This task only reset current balances.

**Blocker:** 无

**Files:**
- `backend-express/scripts/reset-coins.js`
- `.agents/collab.md`

---

## [2026-06-20 02:00 MYT] cowork → all

**Done:** v3.1.11 vc121 — full-screen EditRoomScreen 接 4 个房主功能 (改名/改色/踢人/关闭), zero RN sheet. Android-15 emulator-verified all 6, shipped BOTH platforms.
- **Android vc121 → Play Internal:** ✓ All done (EAS sub `71dd911a-5a8d-494d-bf66-441bb02a7fde`).
- **iOS bn121 → TestFlight:** ✓ uploaded, Apple-processing (EAS sub `7b188449-e164-47e8-af0f-f61e707f7494`).
- Branch `feat/v3.1.11-edit-room`, commit `481c6bb`, PR #280.

**新增:** `app-rn/src/screens/EditRoomScreen.tsx` (route `EditRoom`).
**改了:** `WorldChatScreen.tsx` (6th owner header icon ⚙️ → EditRoom); `RootStackParamList` + RootNavigator; `api/worldChat.ts` (+`reopenChatRoom` stub); i18n `editRoom.*` zh/en/ja/ko; bump 3.1.10→3.1.11/vc121/bn121.

**Header:** member = 🔔 🔗 (unchanged); creator = 🔔 🔗 ➕ 🔑 🗑️ ⚙️ (6 icons now).
**EditRoomScreen — 4 sections, ALL inline / native Alert, ZERO RN Modal/Sheet:**
- a. 改名 — TextInput(1–30) + 保存 → `updateChatRoom({title})`.
- b. 改色 — **horizontal swatch row** (PALETTE, locked greyed) NOT a popup; tap = save now → `updateChatRoom({cardColor})` + live accent preview.
- c. 成员管理 — `getRoomMembers` mapped inline (no nested FlatList); non-self/non-creator rows get a red 踢出 → `Alert.alert` → `kickRoomMember`.
- d. 关闭/重开 — orange 关闭房间 → `Alert.alert` → `closeChatRoom` → goBack; closed room shows 重新开启 → `reopenChatRoom`.

**Emulator-verified (Android 15, qa-premium, vc121 universal APK) — all 6 PASS, no crashes:** 1. owner header 6 icons (uiautomator confirmed 房间通知/分享房间/邀请朋友/修改房间密码/删除/编辑房间); 2. ⚙️→EditRoom 4 sections visible; 3. 改名→保存→"房名已更新" toast + title changed (vc121edit→vc121ed, persisted, seen in header); 4. 改色→tap Lv2→header accent dot turned pink (live preview) + "颜色已更新" toast; 5. 成员 section renders, 踢出 button correctly HIDDEN for self/creator (only 1 member so Alert not triggerable — spec's skip case); 6. 关闭→native Alert "关闭房间?"→确定→header "· 已关闭" + "房间已关闭" toast + composer disabled. Cleaned up test room from prod.

**⚠️ API 后端 TODO (codex 帮忙补):**
- **`POST /world-chat/rooms/:id/reopen`** — does NOT exist (only `/close` does). The client `reopenChatRoom` stub 404s until you add it; EditRoom catches + toasts the error. Mirror the `/close` route but set `status='open'` (+ maybe re-broadcast a `world-chat:room-reopened`). **改名/改色/踢人/关闭 all use existing endpoints and are fully working** (updateChatRoom PATCH, kickRoomMember DELETE /kick/:userId, closeChatRoom POST /close).

**给 codex 的提醒:** All 4 ex-sidebar owner functions now live in `EditRoomScreen` (full-screen). The vc120 note about "edit/kick/close unreachable" is RESOLVED. Still: never reintroduce an RN Modal/Sheet for room/owner UI — full-screen Screen or native Alert only.

**Blocker:** 无.

**Files:**
- NEW `app-rn/src/screens/EditRoomScreen.tsx`
- `app-rn/src/screens/world-chat/WorldChatScreen.tsx`, `src/api/worldChat.ts`
- `app-rn/src/navigation/types.ts`, `RootNavigator.tsx`
- `app-rn/src/i18n/{zh,en,ja,ko}.json`
- `app-rn/app.json` (3.1.10→3.1.11, vc120→121, bn120→121)

---

## [2026-06-20 02:40 MYT] cowork → codex

**Backend TODO for v3.1.11 wallet changes (frontend already隐藏 UI / 改文案 in vc122):**

1. **DB migration:** `UPDATE users SET coin_balance = 0` — 所有用户金币清零。
2. **邀请奖励重做:**
   - 老逻辑: 邀请人成功邀新人 → 邀请人 +100 coins。
   - 新逻辑: 邀请人成功邀新人 → **邀请人 +30 天 premium, 被邀人 +30 天 premium**。
   - 防套利: `users` 表加 `inviter_bonus_claimed: boolean` (邀请奖励是否已领) + `invitee_bonus_claimed: boolean` (被邀奖励是否已领);任一字段为 true 时不再发放对应奖励。
   - 30 天 premium 实现: `users` 表加 `premium_expires_at: datetime`,发奖励就 `premium_expires_at = MAX(now, current_expires_at) + 30 days`。
3. **`me` 接口返回新字段:** `coinBalance = 0` (所有人)、`premiumExpiresAt: datetime | null`、`inviterBonusClaimed / inviteeBonusClaimed: bool`。
4. **充值接口暂时挂起** — 前端已 `RECHARGE_ENABLED = false` 隐藏 UI (WalletScreen.tsx),`getCoinPackages`/`purchaseCoins` 不会被调用;后端可保留接口不动。

**前端 (vc122) 已做:** 钱包页隐藏整个充值 section (feature flag),"如何赚取金币" 删掉旧"邀请好友加入 +100",换成"邀请好友 → 30 天会员 (双方各得,每账号一次)";余额数字读 `getCoinBalance()` (非 hardcode,后端清零后自然显示 0)。

**前端等你完成的:** `me` 返回 `premiumExpiresAt` + 两个 claimed 字段;邀请流程的 30天premium 奖励逻辑 (替换 +100 coins)。

**另一个独立 backend TODO (来自 vc121 EditRoom):** `POST /world-chat/rooms/:id/reopen` 还没有 (只有 /close) — `reopenChatRoom` 客户端 stub 会 404,EditRoom 已 catch+toast;照 /close 路由写,把 status 设成 'open'。

---

## [2026-06-20 02:50 MYT] cowork → all

**Done:** v3.1.11 vc122/bn122 — P1 OnlineUsersList loading fix + P2 EditRoom (already in vc121) + P3 wallet changes. Android-15 emulator-verified, shipped BOTH platforms. (vc121 had shipped P2-only; P1 is a priority bug so this carries P1+P2+P3 at vc122.)
- **Android vc122 → Play Internal:** ✓ All done (EAS sub `f92c33a9-3d65-4990-9c16-1b598af58e8a`).
- **iOS bn122 → TestFlight:** ✓ uploaded, Apple-processing (EAS sub `44ce71e8-78e0-4883-9647-4d5c64a2f02a`).
- Branch `feat/v3.1.11-edit-room`, commit `ff6b478`, PR #280.

**P1 (priority) — OnlineUsersList 在线/离线 永远转圈/空白 (vc118 bug):** 真凶 = 后端 `GET /rooms/:id/members` 第一行 `if (!isValidObjectId(id)) return 400`。世界大厅 roomId='world'(国家子板是 colon id)→ 400,而这些 virtual/广播房根本没有 DB membership。所以 `getRoomMembers` 在冷 dyno 上挂住(iOS 永远转)/返回空。**修复:** `OnlineUsersListScreen` 改用 **live WS roster**(头像条同源,对所有房都有效)作为"在线"真相,merge REST getRoomMembers 补离线行+徽章,且永不卡转(`rosterReady` gate + 2.5s 兜底 timer + `retry:1`)。**改了:** `OnlineUsersListScreen.tsx`。
**P3 — 钱包:** `RECHARGE_ENABLED=false` 隐藏整个充值 section(以后开回来改一行);"如何赚取金币"删旧"邀请好友加入 +100",换"邀请好友 → 双方各得 30 天会员(每账号一次)"带副标题;余额读 `getCoinBalance`(非 hardcode)。**改了:** `WalletScreen.tsx` + i18n `wallet.earn.{invite,inviteDesc,inviteReward}`.

**Emulator-verified (Android 15, qa-premium, vc122 universal APK):** P1: 进世界大厅→👁1→OnlineUsersList **在线 tab 立刻显示 QA Premium(我)** 绿点,离线/你关注的 instant 切换 EmptyState(世界大厅无 DB 成员,正确),**无永久 spinner**。P3: 进我的钱包 → **充值整段消失**(余额 hero 直接接"如何赚取金币")、列表无"邀请好友加入 +100"、新条目"邀请好友 30 天会员 + 副标题"、余额=0(动态)。P2 (6 项) 已在 vc121 验过,vc122 同码(member header 🔔🔗 在 vc122 世界大厅复确认)。

**Blocker:** 无。后端 TODO 见上一条 [cowork → codex] (P4: 金币清零 + 邀请→30天premium + me 字段 + reopen 路由)。

**Files:**
- `app-rn/src/screens/world-chat/OnlineUsersListScreen.tsx` (P1)
- `app-rn/src/screens/profile/WalletScreen.tsx` (P3)
- `app-rn/src/i18n/{zh,en,ja,ko}.json`
- `app-rn/app.json` (vc121→122, bn121→122)

---

## [2026-06-20 10:08 UTC] cowork(claude) → all

**Done:**
- Built Telegram polling daemon: `tg_daemon.sh` (long-poll loop, robust launchd PATH, exports env) + `tg_dispatch.py` (parse/inbox/trigger/dispatch). Loaded via launchd `com.meyou.tgdaemon` (KeepAlive, RunAtLoad). Verified running (curl child mid-longpoll).
- Behaviour: every human msg → `telegram_inbox.jsonl` (0 token). Triggers: `@codex`/`任务:`/`plan:`/`开始:` → `codex exec "..."`; `@claude`/`@cowork` → `cowork_alerts.txt` + TG ping. Bot msgs logged, never trigger.
- Seeded `.tg_last_update_id` to current max (684830489) so no backlog replay.

**KNOWN GAP for codex:**
- `codex` CLI is **not installed/in PATH** on this Mac (only `codexbar`). Until installed, `@codex`/`任务:` triggers degrade to `codex_alerts.txt` + a TG notice. Daemon re-checks `command -v codex` every cycle, so it auto-upgrades to real `codex exec` dispatch once the binary exists.
- Note: Telegram never echoes a bot's own messages, and bots can't see other bots' messages via getUpdates — so only HUMAN messages are ever ingested/triggered (by design).

**Files:** `.agents/tg_daemon.sh`, `.agents/tg_dispatch.py`, `~/Library/LaunchAgents/com.meyou.tgdaemon.plist`

---

## [2026-06-20 03:10 MYT] cowork → codex  (SUPERSEDES the earlier wallet TODO)

**Correction:** the app ALREADY has a dedicated 邀请朋友 screen (邀请码 + 复制/分享 + "双方各得 30 天 Premium" — it's correct). My earlier wallet P3 added a SECOND invite entry in the 钱包"如何赚取金币"列表 = duplicate. **Frontend fixed in vc123: removed that wallet list row** (list now only 每日签到/完成个人资料/参与投票). The dedicated 邀请朋友 screen is untouched.

**Updated v3.1.11 Backend TODO (replaces "邀请奖励重做"):**
1. **DB migration:** `UPDATE users SET coin_balance = 0` (unchanged).
2. **现有"邀请朋友" feature 已实现"双方 30 天 Premium",不重做。只加防套利:**
   - `users` 表加 `inviter_bonus_claimed: boolean` + `invitee_bonus_claimed: boolean`.
   - 该用户已发放过 inviter bonus → 第 2+ 个邀请只给被邀人 bonus,不再给邀请人.
   - 该用户已被发放过 invitee bonus → 不再发(被多人邀请只算第一次).
3. **充值接口暂时挂起**(前端已 `RECHARGE_ENABLED=false` 隐藏 UI).

(The `POST /world-chat/rooms/:id/reopen` route from P2 EditRoom is still TODO too.)

## [2026-06-20 10:15 MYT] codex → all

**Done:**
- Checked Telegram polling work after user asked "检查工作".
- Confirmed `tg_daemon.sh` + `tg_dispatch.py` exist and launchd job `com.meyou.tgdaemon` is running.
- Verified trigger policy in code: human messages are logged to `telegram_inbox.jsonl`; bot messages never trigger; `@codex`/`任务:`/`plan:`/`开始:` route to Codex; `@claude`/`@cowork` route to cowork alerts.
- Found and fixed daemon PATH gap: launchd script did not include `/Applications/Codex.app/Contents/Resources`, so it could fail to find the Codex CLI even though interactive shell can.
- Restarted launchd daemon successfully; new pid `71412` started and daemon PATH can resolve `/Applications/Codex.app/Contents/Resources/codex`.

**TODO for cowork:**
- If validating end-to-end, send a real human Telegram message containing `@codex` or `任务:`; bot-sent messages intentionally do not trigger.

**Blocker:** 无

**Files:**
- `.agents/tg_daemon.sh`
- `.agents/collab.md`

## [2026-06-20 10:25 MYT] codex → all

**Done:**
- Added local agent bus so Codex/Cowork can discuss work reliably while mirroring important messages to Telegram for the user.
- New tools: `.agents/bus_send.py` writes one bus message and mirrors it to Telegram; `.agents/bus_recv.py` reads messages addressed to an agent; `.agents/BUS.md` documents protocol.
- Updated `.agents/tg_dispatch.py` so human Telegram triggers (`@codex`, `任务:`, `plan:`, `开始:`, `@cowork`) are also appended to `.agents/bus.jsonl`.
- Updated `.gitignore` to exclude runtime bus/inbox/log/alert files.
- Validated Python syntax via `ast.parse` and tested dispatch in a temp directory: human `任务:` produced a `user → codex` bus entry and advanced last update id.
- Notified cowork via `bus_send.py codex cowork ...`, which wrote bus and mirrored to Telegram.

**TODO for cowork:**
- Use `python3 .agents/bus_send.py cowork codex "..."` for visible Cowork → Codex discussion, and `python3 .agents/bus_recv.py cowork` to read bus messages.

**Blocker:** 无

**Files:**
- `.agents/BUS.md`
- `.agents/bus_send.py`
- `.agents/bus_recv.py`
- `.agents/tg_dispatch.py`
- `.gitignore`
- `.agents/collab.md`

## [2026-06-20 10:30 MYT] codex → all

**Done:**
- Updated agent bus protocol per user instruction: the user should only chat in Telegram, not split attention across Telegram + bus/collab/logs.
- Clarified `.agents/BUS.md`: Telegram is the user's single chat surface; `bus.jsonl` and `collab.md` are agent-only coordination layers.
- Notified cowork/Claude via `bus_send.py` and Telegram mirror: do not ask the user to inspect bus/collab/alerts; mirror user-relevant agent discussion to Telegram.

**TODO for cowork:**
- Follow single user-facing channel rule: user-facing discussion in Telegram only; backend sync through bus/collab internally.

**Blocker:** 无

**Files:**
- `.agents/BUS.md`
- `.agents/collab.md`

---

## [2026-06-20 03:25 MYT] cowork → all

**Done:** v3.1.11 vc123/bn123 — wallet P3 duplicate fix. Removed the duplicate 邀请好友 row from the 钱包 "如何赚取金币" list (it duplicated the dedicated 邀请朋友 screen). List now = 每日签到 / 完成个人资料 / 参与投票 only. Recharge-hiding kept. Android-15 emulator-verified, shipped BOTH.
- **Android vc123 → Play Internal:** ✓ All done (EAS sub `bed4b1ab-af6f-4217-8ab3-7d60a9a96e3a`).
- **iOS bn123 → TestFlight:** ✓ uploaded, Apple-processing (EAS sub `f9781c51-4e2e-4ef0-b1bb-12442f0dff8a`).
- Branch `feat/v3.1.11-edit-room`, commit `7c774db`, PR #280.
- Emulator-verified: 我的钱包 → 充值 hidden + earn list shows exactly 3 rows, no 邀请好友 entry.
- P4 backend TODO corrected (see prior codex entry): don't redo invite reward (already both-sides 30d Premium) — only add anti-abuse flags `inviter_bonus_claimed`/`invitee_bonus_claimed`.

**Files:** `app-rn/src/screens/profile/WalletScreen.tsx`, `src/i18n/{zh,en,ja,ko}.json` (removed inviteDesc/inviteReward), `app-rn/app.json` (vc122→123, bn122→123).

## [2026-06-20 10:35 MYT] codex → all

**Done:**
- Re-checked cowork's note that Codex CLI was missing. Current state: Codex CLI exists at `/Applications/Codex.app/Contents/Resources/codex` and reports `codex-cli 0.140.0-alpha.2`.
- Confirmed `codex exec --help` is available.
- Confirmed `.agents/tg_daemon.sh` already includes `/Applications/Codex.app/Contents/Resources` in launchd PATH and launchd job `com.meyou.tgdaemon` is running as pid `71412`.
- Notified cowork via bus + Telegram mirror that the old "codex CLI not installed" warning was pre-PATH-fix state.

**TODO for cowork:**
- Retest with a human Telegram trigger (`@codex ...` or `任务: ...`). Bot messages intentionally do not trigger.

**Blocker:** 无

**Files:**
- `.agents/collab.md`

## [2026-06-20 10:45 MYT] codex → all

**Done:**
- Investigated why Telegram `@CodexAi8008_bot` did not reply. The daemon successfully spawned Codex, but Codex CLI inherited `~/.codex/config.toml` model `gpt-5.2-codex`, which the current ChatGPT account rejects with 400 `model is not supported`.
- Updated `.agents/tg_dispatch.py` to invoke `codex exec -m gpt-5.4-mini ...` by default (`CODEX_MODEL` env can override).
- Restarted launchd daemon; current `com.meyou.tgdaemon` pid is `3883`.
- Verified direct `codex exec -m gpt-5.4-mini` succeeds.
- Replied to cowork via bus + Telegram with backend TODO status: coins reset complete; invite anti-abuse not started; `/auth/me` already includes `premiumExpiresAt` but claimed flags absent; reopen route not started.

**TODO for cowork:**
- Retest from Telegram with a human `@codex` or `任务:` trigger. Bot messages intentionally do not trigger.
- Backend remaining work: add invite claimed flags + anti-abuse, expose flags in self serialization, add `POST /world-chat/rooms/:id/reopen`.

**Blocker:** 无

**Files:**
- `.agents/tg_dispatch.py`
- `.agents/collab.md`

---

## [2026-06-21 01:35 MYT] cowork → all

**Done:** v3.1.12 vc124/bn124 ship 双端 — 纯前端 2 个改动:
1. **NewMomentScreen (ComposerScreen)** 删右上 Publish 按钮 — 底部已有渐变「发布动态」入口,功能不变;编辑流程的 Save 按钮保留(header 按钮只在 isEditing 时渲染),加 26px spacer 保持标题居中。
2. **AddLocationScreen (MapPickerScreen)** 加圆形「找我位置」GPS 按钮(地图右下角)— expo-location `getCurrentPositionAsync` → `goTo(lat,lng,16)` 居中地图;无权限/拿不到位置 → native Alert(`Linking.openSettings` 引导设置),不飞不卡;moment 模式抬高到确认条之上避免重叠。i18n `mapPicker.*` zh/en/ja/ko。

**定位权限:** app.json 早已配齐(expo-location plugin + iOS NSLocationWhenInUseUsageDescription + Android ACCESS_FINE/COARSE_LOCATION)— 无需改 manifest。

**Android-15 emulator 验证 (qa-premium, vc124 universal APK):** 1. 新动态页右上无 Publish(只 ‹ + 标题),底部「发布动态」在 ✅;2. 添加位置→在地图上选择→MapPicker 右下角「找我位置」圆按钮在(uiautomator 确认 content-desc=找我位置 bounds [912,2075][1038,2201])✅;3. 点按钮 → getCurrentPositionAsync(给 emu geo fix 后成功居中 KL;无 fix 时弹 native Alert「无法获取位置」= 我的错误处理路径)✅;4. 不飞不卡,无崩溃 ✅。截图 /tmp/m3s.png(无 Publish)、/tmp/m7s.png(GPS 错误 Alert)、/tmp/m9s.png(GPS 按钮+地图)。

**Files:**
- `app-rn/src/screens/moments/ComposerScreen.tsx`
- `app-rn/src/screens/discover/MapPickerScreen.tsx`
- `app-rn/src/i18n/{zh,en,ja,ko}.json` (mapPicker.*)
- `app-rn/app.json` (3.1.11→3.1.12, vc123→124, bn123→124)

**Android submission:** `51ec740d-1783-4640-8c30-594fcc57ab0e` (Play Internal — All done).
**iOS submission:** `ac27b476-e0de-4058-afb4-0712e9d7e272` (TestFlight — uploaded, Apple-processing).
**Commit:** `58e9966` on `feat/v3.1.11-edit-room` (PR #280).

**Blocker:** 无 (codex 那 3 个后端 TODO — 邀请防套利 / me claimed flags / reopen 路由 — 继续;那是下一个组 build 的内容,跟这次纯前端无关)。

---

## [claude] meyou.uk 网站 audit + 内测 email 收集 (web only, 不动 app-rn/build)

**Phase 1 — 现状:** 落地页源码**不在本 repo**(direct-upload 到 Cloudflare Pages `meyou`,源 HTML 在 repo 外)。本 repo 只版本控制 `webpage/functions/`(r/ 房间分享 + .well-known + 现新增 api/)。Hosting = Cloudflare(headers `server: cloudflare` 确认)。线上结构:hero(遇見懂你/Real connection + App Store/Google Play "即將上線SOON" 占位 badge)→ 4 特色(实名/E2E/0容忍/24/7)→ 兴趣选择 demo → 三步如何运作 → 今日推荐卡 → 安全聊天 → 左右滑 → AI 破冰 → 我们的承诺 → FAQ → **email 表单(已存在)** → footer。中英双语 toggle 已具备。

**关键发现:** 表单 `#waitlist` **早已存在且写好**(校验 email、存 localStorage、若 `data-endpoint` 有值则 POST `{email,source}` JSON、成功显示 🎉「你已搶先入座」)——**但 `data-endpoint=""` 是空的,所以提交全丢进 localStorage,老板永远收不到。** 不需要从零做表单,只需接后端 + 填 endpoint。

**Phase 3 实现(已落地 repo):** 新增 `webpage/functions/api/waitlist.js` — Cloudflare Pages Function + KV(老板偏好的 A 方案,自管数据、免费、贴合现有 functions 架构):
- POST: 校验 email→写 KV `WAITLIST`(key=`email:<lower>`,天然去重)+ honeypot 防 bot + `meta:count` 计数;未绑 KV 也返回 ok 让前端正常显示感谢。
- GET `?key=<WAITLIST_ADMIN_KEY>` 导出 JSON;`&format=csv` 下 CSV;`?count=1` 公开计数(可做"N 人已预约"徽章)。
- node ESM 语法检查通过。README 已补文档 + 一次性 setup(建 KV namespace → 绑 `WAITLIST` → 设 `WAITLIST_ADMIN_KEY`)。

**需老板按一下(缺 CF 凭据,无法代部署):** 1) 源 index.html 把 `data-endpoint=""` 改成 `data-endpoint="/api/waitlist"`(一处);2) Pages 建 KV + 绑定 + 设 admin key;3) 把 `functions/` 随站点重新 upload。详见 `webpage/functions/README.md`。

**未动:** app-rn / vc124 build / 任何线上文件(read-only audit 完成,代码改动仅限 webpage/functions/)。Phase 2 audit 建议见我给老板的回复(P0:把下载 badge 改成"加入内测"指向表单;P1:首屏真机截图、隐私/条款已在 footer ✓、媒体/用户数信任信号;P2:暗黑模式等)。

---

## [2026-06-21 11:55 MYT] cowork → all

**Done:** v3.1.12 vc125/bn125 ship 双端 — vc124 已提交(Play 占用 124),所以 3 项一起进 vc125:
1. NewMomentScreen 删右上 Publish 按钮 (底部渐变 Post 入口保留, 编辑 Save 保留) — 同 vc124。
2. AddLocationScreen/MapPicker 加圆形「找我位置」GPS 按钮 (expo-location, 无权限 native Alert→openSettings) — 同 vc124。
3. **NEW BUG FIX — AnnouncementModal「今天不显示」永久消失:** 用户报 "按了今天不显示之后就再也不出来"。

**真凶:** dismiss handler 存了永久 `'1'` flag (`announcementDismissKey(id)='meyou:announcement:dismissed:<id>'`),AnnouncementBootstrap 把 `v==='1'` 当永久 dismissed 过滤掉 → 再也不显示。
**修法 (24h TTL):**
- `AnnouncementModal.onDontShow` → `multiSet([key, String(Date.now())])` (存时间戳, 不是 '1')。
- `AnnouncementBootstrap` → `DISMISS_TTL_MS=24h`;只在 `now - ts < 24h` 才算 dismissed。旧 `'1'` 解析成 ts=1 (1970) → 永远 > TTL → 当过期处理 → **stuck-forever bug 自愈** (无需显式 migration,下次 dismiss 自动覆盖成新时间戳)。
**Files:** `app-rn/src/components/AnnouncementModal.tsx`, `app-rn/src/components/AnnouncementBootstrap.tsx`。

**验证:** Android-15 emulator: 公告开机弹出 ✅;点「今後不顯示」→ relaunch → 隐藏 (24h 内, uiautomator 确认 count=0) ✅。TTL 边界 + 旧'1'自愈用 Node 逻辑测验全过 (fresh→隐藏, 23h→隐藏, 25h→显示, '1'→显示自愈, null/garbage→显示) —— emulator 无 root 无法改系统时钟做 +24h 实测,故用确定性逻辑测验证 24h 边界。NewMoment/GPS 同 vc124 已验。

**Android submission:** `aa948d93-658f-4215-9e4f-798a0dccb9ab` (Play Internal — All done)。
**iOS submission:** `3f2721ab-2b81-47df-a955-5e56ac5a2a2b` (TestFlight — uploaded, processing)。
**Commit:** `2558fab` on `feat/v3.1.11-edit-room` (PR #280)。

**注:** vc124 (sub 51ec740d / ac27b476) 已提交但被 vc125 取代 —— 老板装 vc125 即可,vc124 内容全包含在 vc125 里 + 公告修复。

**Blocker:** 无。codex 后端 3 个 TODO 继续。

---

## [2026-06-21 12:05 MYT] cowork → all

**Scope 收紧确认 (AnnouncementModal) — 无需重 build。** 老板最终指令:公告修复只做 TTL,**不要** Premium gate / 不动 3 秒倒计时 / 不加 sales upsell Alert(中途讨论过这些,全部撤销)。

**核对结果:已 ship 的 vc125 正好就是这个 scope** —— 我那一版从头到尾只改了 TTL,从没加过 premium/倒计时/upsell:
- `AnnouncementModal.onDontShow` → 存 `String(Date.now())` 时间戳(非 '1')。
- `AnnouncementBootstrap` → 24h `DISMISS_TTL_MS`,`now - ts < 24h` 才算 dismissed;旧 '1' 自愈。
- 现有 3 秒 `COUNTDOWN_SECS` 关闭倒计时 **未动**。
- **无** isPremium / upsell / InviteFriend / 按钮显隐改动(grep 确认 = 0)。

所以 vc125(Android sub aa948d93 + iOS sub 3f2721ab)= 最终正确版本,包含:① NewMoment 删 Publish ② AddLocation GPS 按钮 ③ AnnouncementModal **纯 TTL 24h 修**。不再 cut vc126(代码零变化,白占版本号没意义)。

**Blocker:** 无。

---

## [2026-06-21 12:35 MYT] cowork → all

**Done:** Meyou CRM admin dashboard + functions 合并,已部署线上(`wrangler pages deploy` → project `meyou`,deploy `https://3c0fcaac.meyou-e4s.pages.dev` → 主域 `https://meyou.uk/admin/`)。部署目录 `webpage/meyou-extract/`(非 gay repo;gay repo 仅 `webpage/functions/` 为源)。

**1) Functions 合并(部署隐患修复):** 部署目录原本只有 `u/`+`invite/`+`api/waitlist.js`,缺 `r/*`+`.well-known/*` → 全量 `pages deploy .` 会删线上深链。**curl 实测发现**:部署前线上 `/r/*`、`/.well-known/apple-app-site-association`、`/assetlinks.json` 三者**全部返回 HTML catch-all**(`/* /index.html 200`),即这些 function 此前根本没在线上生效,**也不存在已填好的 TEAMID/SHA256 真值**(任务背景里"线上已填好"与实测不符)。故从 gay repo `webpage/functions/` 复制 `r/[roomId].js` + `.well-known/*.js` 进部署目录一起 deploy:
- `/r/test` 现已正确代理房间 bounce 页(`gaymeet-api.onrender.com`),不再被 catch-all 吞。
- `/.well-known/*` 现返回正确 `application/json`,**但 appID=`TEAMID.com.meetupnearby.app`、sha256=`REPLACE_WITH_SHA256` 仍是占位** → app-link 验证仍不通,需老板填真值(`cd app-rn && eas credentials`)。因部署前线上是 HTML(本就不通),此举无回退、纯改善。

**2) Admin CRM(纯 vanilla JS/HTML/CSS,零框架,粉色品牌色 `#E25CAE` 对齐 `/u/` 页):**
- `admin/index.html` — 登录页,POST `/api/admin/login`,成功 set cookie→跳 dashboard;503 显示"未配置密码"。
- `admin/dashboard.html` — 4 卡片(总数/今天/本周/占位)+ 搜索框 + 可排序表格(邮箱|来源|相对时间)+ 前端生成 CSV 下载 + 空态"还没有人报名" + 401→跳登录。
- `functions/api/admin/login.js` `waitlist.js` `logout.js` — cookie 鉴权(token=`btoa(ts:password)`,24h,HttpOnly+Secure+SameSite=Strict);未配密码/未绑 KV 均 graceful 不 crash。

**Deploy 后 curl 验证(全过):** `/admin/`→200 登录页;`POST /api/admin/login {test}`→503 not_configured(密码未设,符合预期);`GET /api/admin/waitlist` 无 cookie→401;`/api/waitlist?count=1`→`{count:0}` 旧 API 未坏。

**需老板按一下(一次性,缺密码无法代设):** Pages→meyou→Settings→Environment variables 加 `WAITLIST_ADMIN_PASSWORD=<自选>`;Settings→Functions→KV bindings 绑 `WAITLIST`(同上个 waitlist task 那个 namespace)。设完即可登录看数据。**安全注记:** token 把密码 base64 进 HttpOnly cookie(任务指定的"简单版"),够单人后台用;若日后要更严,改 HMAC 不存明文密码。

**未动:** app-rn / vc125 build / 主站 hero / P0 audit 建议 / PR #281 内容。仅新增 admin 页 + 合并 functions。

**Blocker:** 无。

---

## [2026-06-21 14:40 MYT] cowork → all

**Done:** Meyou 首屏改版 — 訪客一進來就看到「內測開放」+ 立刻能填 email,已部署線上(`wrangler pages deploy` → project `meyou`,deploy `https://1d3d55b8.meyou-e4s.pages.dev` → `https://meyou.uk`)。

**改了 3 個檔(部署目錄 `webpage/meyou-extract/`):**
1. `index.html`(+ `Meyou.html` 備份同步,byte-identical):
   - Hero 頂部加**粉色 ribbon**「🟢 內測開放中 · 名額有限,先到先得」(solid `#E25CAE`,中英雙語 `data-lang-tc/en`)。
   - Hero 死的 App Store / Google Play 按鈕 → 換成**首屏 email 表單**(`#hero-waitlist`,`data-source="hero"`,複用既有 `.waitlist` 樣式 + 提交邏輯),含 🚀加入內測 按鈕 + microcopy +「🎉 已加入內測名單,優先邀請」成功態。
   - 底部 CTA 區的死按鈕 → 換成小字提示「內測期間,iOS / Android 雙端皆可獲邀請」。底部舊 `#waitlist` 表單**保留**(多入口)。
2. `script.js`:waitlist 提交 handler 從綁單一 `#waitlist` 改成 `querySelectorAll('form.waitlist')` 迴圈,每個 form 用自己的 email input + `data-source`(hero→`hero`,footer 維持預設 `meyou-website`,CRM 可分流量來源)。
3. `styles.css`:`.beta-banner` / `.hero-waitlist` 亮底變體(microcopy 用 `var(--ink-soft)` 不是白字,暗黑模式 var 自動翻轉)/ store-hint;`@media (max-width:600px)` 手機把 hero 表單**直排**(input 上、滿寬按鈕下)、藏信封 icon。

**i18n:** 中英雙語全做(沿用網站既有 CSS `data-lang-tc/en` 雙 span 機制,非 JS 字典)。

**Deploy 後驗證:** live curl 確認 hero 有「內測開放中 / Closed Beta Open」+ `#hero-waitlist` 表單 + 0 個死按鈕(`btn-store`/`data-soon` grep=0);headless Chrome 截圖桌面(表單橫排)+ 手機(表單直排、滿寬按鈕、banner 不擠)皆 OK。**注:headless Chrome 視窗最小寬 ~500px,真 375px 截不到 → 手機直排斷點設 600px 才能在 headless 驗證,真機 ≤600 皆直排。** 截圖 `/tmp/meyou-hero-mobile-375.png`、`/tmp/meyou-hero-desktop-1280.png`。

**未動:** admin CRM / app-rn / vc125 / 主站 hero 文案結構以外 / audit P1/P2(僅做內測+email 醒目化)。**Blocker:** 無。

---

## [2026-06-21 17:42 MYT] cowork → all

**Done:** 修 meyou.uk 手機版「看起來不 OK」(老板反饋),已部署(deploy `https://bfa92f12.meyou-e4s.pages.dev` → `https://meyou.uk`)。用 puppeteer-core 驅動本機 Chrome 做**真 375px** 量測(headless Chrome `--screenshot` 最小卡 500px,這次裝 puppeteer-core 才量得到真 375)。

**真凶(量測 + 截圖找出,2 個):**
1. **Nav 右側溢出被裁切。** Mobile 的 `.nav-cta` 有 4 件(🌙 + EN + 免費下載 + ☰),總寬撐到 right=404 > 375 → 最右的 ☰/免費下載被切出畫面外。而 ☰(`menuBtn`)JS 只是 `scrollIntoView('#download')`,跟「免費下載」按鈕**功能完全重複** → ☰ 純冗餘。
2. **Hero 字級偏大 + email CTA 偏低。** `.hero h1` 用 `clamp(40px,5.4vw,66px)`,手機吃到 40px 下限,顯得擠;email 表單在 812 視窗的 y≈474,偏中下。

**修了哪幾行(只動 `styles.css`,index/Meyou.html 不變仍同步):**
- `@media (max-width:760px)`:`.menu-btn{display:none}`(原 display:flex,移除冗餘 ☰)+ `.nav-cta{gap:9px}` + `.nav-cta .btn{padding:9px 15px;font-size:14px}` → nav-cta right 404→**355**,不再裁切。
- `@media (max-width:600px)`:新增 `.hero h1{font-size:31px;line-height:1.2}`(40→31)、`.hero .lede{font-size:15.5px}`、縮 `.hero` padding 與 banner/表單 margin → email input y 474→**404**(上移 70px,更靠首屏上方醒目)。

**驗證(真 375px puppeteer,live):** `docClientWidth=375`、`navCtaRight=355`(不溢出)、`menu-btn display:none`、hero 表單 `flex-direction:column` 直排、功能性元素溢出清單 = **空**。裝飾性 blob/glow 仍依設計微出血,被既有 `overflow-x:hidden` 裁掉、`visualViewport.scale=1`(無縮放),非問題。截圖 before `/tmp/mobile_375.png`、after `/tmp/mobile_AFTER_375.png`。

**未動:** admin CRM / app-rn / vc125 / 桌面版(改動全在 ≤760 與 ≤600 media query 內,桌面不受影響)。**Blocker:** 無。

---

## [2026-06-21 18:06 MYT] cowork → all

**真凶找到 = CSS 缓存,不是 CSS 没修对。** 老板手机看到旧版(汉堡还在/表单横排/按钮截字),但 live 实测 CSS **已经是修好的**。

**证据(curl + puppeteer 实测 live):**
- `styles.css` 响应头 `cache-control: public, max-age=14400`(浏览器缓存 **4 小时**)→ 老板 Safari 抓的是部署前的旧 CSS。
- `index.html` 是 `max-age=0, must-revalidate`(永远新)→ 新 hero markup 进来了,但 CSS 还是旧的 = **新 HTML + 旧 CSS** 错配,正好造成那 3 个症状(stack 规则/`.menu-btn{display:none}` 在旧 CSS 里没有)。
- fresh puppeteer(`setCacheEnabled(false)` + cache-bust URL)实测:`menu_btn_display:"none"`、`wl_row flexDirection:"column"`、input/button 各 309px(满宽直排)、button text `"🚀 加入內測"`(完整不截)、input_y=404。→ 我之前的截图不是 mock,是真的;两边差异纯粹是缓存。

**修法(`index.html`,2 行):** 给静态资源加版本号 `styles.css?v=20260621-beta3`、`script.js?v=20260621-beta3`。因为 index.html 永远新,浏览器一进来就看到新的 CSS URL(从没缓存过)→ 强制抓新 CSS,绕过那 4 小时缓存,**无需手动硬刷新**。已同步 Meyou.html + 部署(deploy `https://9785548d.meyou-e4s.pages.dev`)。

**验证:** live index.html 现引用 `?v=20260621-beta3`;该 URL CSS 含 `.menu-btn{display:none}` + `flex-direction:column`,`cf-cache-status: MISS`(新 key 新鲜)。截图 `/tmp/mobile_NOW.png`(已 cp 到 uploads)。

**未动:** 其他页 / admin / app-rn。**Blocker:** 无。

---

## [2026-06-22 19:08 MYT] cowork → all

**Done:** Meyou 高级化 mood board — 3 个 hero 风格 mini preview,部署到子路径供老板挑风格(deploy `https://f0bff3b7.meyou-e4s.pages.dev` → meyou.uk)。各自独立 HTML + inline CSS(不引主站 styles.css,零框架),只渲 hero + 小 footer 互跳。

- **A `/preview-a/` Editorial**(Wallpaper/It's Nice That):Fraunces serif 大标题 + Inter;米白 `#F5F2EA`/近黑 `#1A1A1A`/橄榄绿 `#6B7340`;不对称 grid(标题左 70%、supporting+form 右 30%)+ 细线 divider + "01 Founded with intent"。Copy「For people who *want* to be met. / 给希望被理解的人。」
- **B `/preview-b/` Soft Glass**(Vision Pro/Linear):Inter 粗细搭;dark gradient navy→purple `#0a0a1f→1a0f3d→2d1b5e`/白字/天蓝 `#7DD3FC`;居中 + 4 发光浮球 + CSS noise grain + 毛玻璃 card(`backdrop-filter:blur(20px)`)包 email form。英文优先中文小字。
- **C `/preview-c/` Boutique**(Aesop/Bottega):Cormorant Garamond italic 混搭 + Inter;cream `#EDE3D2`/暖棕 `#3D2F1F`/taupe `#A0826D`;居中单列大量留白(6rem+)+ 关键词 slow 下手绘 underline(inline SVG)+ hero.jpg 诗意图 + 极简下划线 email(无填充按钮)。Copy「Meet, in *slow* time. / 慢一点,认识彼此。」

三个表单都 POST `/api/waitlist`(source=preview-a/b/c,可分流量)。curl 三个 200 ✓,puppeteer 桌面截图三个都干净。**未动:** 主站 `/` / admin / app-rn。**Blocker:** 无。

---

## [2026-06-23 00:38 MYT] cowork → all

**Done:** 老板给的「公测开始!」插画 banner(3 个 Meyou 吉祥物 + 画出来的 email 表单)做成 hero,部署到 `/preview-d/`(deploy `https://a42ab089.meyou-e4s.pages.dev` → meyou.uk)。老板要点:照片里那个 email 输入框要变成真的能填。

**做法(关键):** 插画构图里表单卡片跟人物下半身重叠,无法干净裁切。所以用**整张图 + CSS mask 渐隐**:`mask-image:linear-gradient(to bottom,#000 60%,transparent 76%)` 把图底部(画出来的输入框/按钮/badges)溶进米色背景 → 看不到重复表单;然后在溶解区用负 margin 叠一个**真·可用表单**(白底圆角 input「请输入你的 email 地址」+ 信封 icon + 橙色「提交，成为公测朋友」按钮)+ 3 个 feature badge(🎁抢先体验/💬参与共建/🔔专属动态)+「期待你的加入♡」,全用真 HTML 重建、配色对齐插画(橙 #C8632A / 米 #FBEAD0)。POST `/api/waitlist` source=preview-d。
- 图片存 `assets/beta-hero.jpg`(1280×853,从 Downloads 那张)。
- 验证:desktop + 375px mobile puppeteer 截图都干净 —— 人物清晰、画出来的表单完全溶解无残影、真表单原生感、移动端 input/按钮/badges 直排可用。

**注意:放在 `/preview-d/`,没动主站 `/`**(延续 A/B/C mood-board 流程,可逆)。老板说一声就能把它提升成首页 hero。

**未动:** 主站 / admin / app-rn / A·B·C preview。**Blocker:** 无。

---

## [2026-06-23 00:50 MYT] cowork → all

**Done:** 老板拍板 — 把 preview-d 的「公测开始!」插画 hero（含真·email 表单）正式上到主站首页 `https://meyou.uk/`，**替换掉旧的「遇見懂咖啡」文字 hero + email 表单块**。deploy `https://acbd28f0.meyou-e4s.pages.dev`。

**改动（`index.html` + `styles.css`，Meyou.html 已同步）:**
- 整个旧 `<header class="hero">`（粉色 banner + 打字机标题「遇見懂…」+ lede + 旧表单 + store-hint + 右侧 hero 照片/float cards）**整块换成** `.beta-hero`：公测插画(`/assets/beta-hero.jpg`，CSS mask 底部渐隐)+ 溶解区叠真表单(信封 input「请输入你的 email 地址」+ 橙色「提交，成为公测朋友」)+ 3 feature badges + 「期待你的加入♡」。
- 表单复用站内既有 `form.waitlist` handler：`class="waitlist bh-form"` + `data-endpoint="/api/waitlist"` + `data-source="homepage-hero"`（CRM 里这个来源=首页 hero）。成功态用 `.bh-form.sent` 切换(隐表单+badges、显 🎉 已加入名单)。
- 新 hero CSS 全部 scope 在 `.beta-hero` 下，避免污染站内 `.wl-row/.wl-btn` 等。**踩坑修掉:** `.bh-t span{display:block}` 比站内 i18n `[data-lang-en]{display:none}` 特异性高 → badges 中英双显；改 `.bh-t>span`(直接子)修正,verify enVisible=false/tcVisible=true。
- 资源版本号 bump → `styles.css?v=20260623-d2`（绕 4h 缓存,老板无需硬刷）。

**验证(puppeteer live):** 桌面 hero row、手机 column 直排满宽按钮、overflowX=0、i18n 单语、成功态 row/feats→none + done→block、handler 绑定(waitlist class + endpoint + source) 全过。下方 stat strip 等 section 不受影响。

**注:** ① 插画是纯中文「公测开始」，EN 模式下海报仍中文(表单/badge 文案双语正常)——要 EN 海报得另出图。② 旧打字机标题「遇見懂…」+ 右侧照片已移除(整 hero 替换)；老板要保留旧标题做混搭随时说。preview-a/b/c/d 仍在原路径可参考。

**未动:** admin / app-rn / 其他 section。**Blocker:** 无。

## [2026-06-24 18:40 MYT] codex → all

**Done:**
- Picked up cowork bus task: grant 1 year Premium to `shadowlon3r@hotmail.com`.
- Confirmed existing script `backend-express/scripts/grant-premium.js` sets `isPremium=true` and `premiumExpiresAt` by `MONTHS`.
- Attempted `EMAIL=shadowlon3r@hotmail.com MONTHS=12 node scripts/grant-premium.js` against production MongoDB. DB connected, but script returned `User not found.`
- Ran read-only similarity checks: `shadow` = 0 users, `lon3r` = 0 users, `hotmail` = 3 users (`ethanyhw@hotmail.com`, `vincs1112@hotmail.com`, `wqyap762@hotmail.com`).
- No Premium write was made.
- Notified Telegram and cowork via bus: user must confirm email spelling or register first.

**TODO for cowork:**
- Ask for corrected email or confirm that the user has registered. Once corrected, rerun grant-premium with `MONTHS=12`.

**Blocker:** `shadowlon3r@hotmail.com` does not exist in production `users`.

**Files:**
- `.agents/collab.md`

---

## [2026-06-24 14:42 MYT] cowork → codex/all

**Done (cowork 侧):** admin dashboard 加了「🎁 发放 Premium」表单 + bridge Pages Function，已上线 `https://meyou.uk/admin/`。
- UI: `admin/dashboard.html` — email + 时长下拉(30/90/180/365/自定义) + 发放按钮 + 状态行,粉色 accent 对齐主 dashboard。
- Bridge: `functions/api/admin/grant-premium.js` — 验 admin cookie(同 /api/admin/* 方案)→ 转发 `POST {MEYOU_BACKEND_URL}/admin/users/:email/grant-premium`(Bearer `MEYOU_ADMIN_API_KEY`,body `{days}`)。未配 key 时返回 503「未配置」(graceful，点了不崩)。
- 验证: 无 cookie→401 ✓; 有 cookie→503 未配置 ✓; 表单 live ✓。

**TODO 给 codex(后端):** 加 `POST /admin/users/:email/grant-premium`(Bearer auth, body `{days}`, 行为 `premiumExpiresAt=MAX(now,existing)+days` 且 `isPremium=true`, 返回 `{premiumExpiresAt}`, 404 if 用户不存在)。生成 `ADMIN_API_KEY` 给我,我让老板填 Pages env(`MEYOU_BACKEND_URL`+`MEYOU_ADMIN_API_KEY`)。已 bus 通知 codex。

**⚠️ codex 链路仍然断:** `codex` CLI 没装在 PATH(`codex exec`→command not found),`.codex_pending` 队列也不接 agent 间 bus 消息。所以发给 codex 的 3 件事(① shadowlon3r +1y Premium ② 暂停 2 类推送 ③ 这个 grant-premium 后端 endpoint)目前**没有 codex 在跑、不会自动响应**。需老板装 codex CLI 或换人做后端。

**老板需做:** ① 装/修 codex CLI(后端那三件才动得了); ② codex 给出 ADMIN_API_KEY 后,在 Pages 填 `MEYOU_BACKEND_URL`+`MEYOU_ADMIN_API_KEY`,grant 表单才真能发 Premium。

**未动:** v3.1.11 build / 主站 / app-rn。

## [2026-06-24 18:50 MYT] codex → all

**Done:**
- Updated communication rule per user instruction: do not proactively notify Telegram for routine backend/task results.
- `.agents/BUS.md` now says to use `bus_send.py --no-telegram` for agent-only/background updates, and Telegram only for direct user replies or urgent blockers unless explicitly requested.
- Notified cowork via bus-only message, not Telegram.

**TODO for cowork:**
- Stop mirroring routine task completion/blocker updates to Telegram unless the user asks for it. Use bus/collab quietly.

**Blocker:** 无

**Files:**
- `.agents/BUS.md`
- `.agents/collab.md`

## [2026-06-24 14:43 MYT] cowork → all (更正上一条)

**更正:** 上一条说「codex 链路断了」是**错的** —— 那是我自己 shell 的 PATH 没有 codex 而已。实际 codex CLI 在 `/Applications/Codex.app/Contents/Resources/codex`(codex 06-20 已加进 tg_daemon launchd PATH),codex 通过 daemon 正常运行并已响应:
- **Premium for shadowlon3r@hotmail.com → BLOCKER(codex 14:39):** 该 email 在生产 users 不存在。codex 只读搜 shadow/lon3r=0,hotmail 仅 ethanyhw@/vincs1112@/wqyap762@。**未写入。** 老板需确认邮箱拼写或让用户先注册。
- **暂停 2 类推送:** 我刚 bus 通知 codex(14:40),codex 尚未回。
- **grant-premium 后端 endpoint:** 已 bus 通知 codex,待 codex 加 + 给 ADMIN_API_KEY。

**收到新规则(codex 14:41 转达老板):** 后台任务结果**不要再主动发 Telegram**,只写 bus/collab;Telegram 仅用于直接回答老板当前消息或紧急 blocker。→ cowork 后续 bus_send 一律加 `--no-telegram`(本轮那两条按老板当轮命令已 mirror,之后改正)。

## [2026-06-24 18:55 MYT] codex → all

**Done:**
- User clarified notification policy: for routine task status/results, write only to `.agents/collab.md`.
- Do not proactively send Telegram notifications.
- Do not use bus for routine task status unless agent coordination is specifically needed.
- Telegram is only for direct replies when the user is actively chatting there or explicitly asks to notify the group.

**TODO for cowork:**
- Follow this priority: routine updates → `collab.md` only; bus only for necessary agent coordination; Telegram only on explicit user request or direct active chat reply.

**Blocker:** 无

**Files:**
- `.agents/collab.md`

## [2026-06-24 18:59 MYT] cowork → codex

**Relayed Premium grant request (via bus, --no-telegram):**
- email: myvtwkmg5m@privaterelay.appleid.com (Apple Sign In relay)
- 操作: premiumExpiresAt = MAX(now, existing) + 365d; isPremium=true; email 查找 case-insensitive
- codex 完成后回 bus (--no-telegram) + append collab.md;user 不存在则报 not found。

cowork 侧 `codex exec` 在本 shell PATH 不可用(codex 在 /Applications/Codex.app/Contents/Resources/codex,不在我 PATH),故仅写 bus + 此条 collab。等 codex 处理。

## [2026-06-24 14:57 UTC] cowork → all

**Granted Premium 1y via direct MongoDB write** (boss-authorized option C):
- ✅ zhewynn@gmail.com → premiumExpiresAt 2027-06-24, isPremium true (was: null; matched=1 modified=1, re-read verified)
- ❌ myvtwkmg5m@privaterelay.appleid.com → **NOT FOUND** in users (same as shadowlon3r — Apple relay/email not in prod). No write made for this one.
- method: one-off Node script via mongoose raw `users` collection, MAX(now,existing)+365d, exact lowercase match (email field is lowercase+indexed); MONGODB_URI from backend-express/.env (not printed); script deleted after run; no other users touched.

## [2026-06-24 15:00 UTC] cowork → all

**Revoked Premium via direct MongoDB write** (boss-requested, urgent):
- hafiz@example.com (nickname Hafiz_Test) → isPremium false, premiumExpiresAt null (was: isPremium true, expiry 2026-06-28). matched=1 modified=1, re-read verified.
- Also reset inviterBonusClaimed/inviteeBonusClaimed → false (note: these fields aren't in current User schema, so set as-is; the effective revoke is isPremium:false + premiumExpiresAt:null).
- method: one-off node/mongoose raw users collection; only 1 hafiz candidate (unambiguous); MONGODB_URI from .env (not printed); script deleted; no other users touched.

---

## [2026-06-27 UTC] cowork → all

**vc126 / v3.1.13 — Apple App Review rejection fixes (iOS build 123 rejected: Guideline 2.1(b) IAP + 1.2 UGC)**

**Done (code):**
1. **Anonymous notes (小纸条) removed entirely.** Deleted `api/notes.ts`, `screens/chat/NotesInboxScreen.tsx`, `screens/chat/NoteDetailScreen.tsx`, `screens/chat/NoteShareCard.tsx`, `screens/discover/SendNoteSheet.tsx`, `utils/shareNoteCard.ts`. Stripped all entry points + routes: `navigation/types.ts` (NotesInbox/NoteDetail param types + InboxNote/SentNote import), `navigation/RootNavigator.tsx` (2 imports + 2 Stack.Screens), `utils/pushRouter.ts` ('note' push case), `screens/chats/ChatsListScreen.tsx` (NotesEntry inbox shortcut + notesUnread query), `screens/discover/AboutUserSheet.tsx` + `screens/profile/UserDetailScreen.tsx` (StickyNote buttons + SendNoteSheet; admin float btn re-positioned 102→58).
2. **Plaza Voice "随机配对" (voice:random-match) removed.** Backend config `backend-express/src/config/voiceRooms.js` drops the entry; `screens/world-chat/PlazaScreen.tsx` also filters the id client-side so it never renders even against an un-deployed backend. Other voice rooms (单身交友/广东话/普通话/英语/唱歌/游戏/老板/AI/树洞) kept.
3. **Premium row always visible** (was the real 2.1(b) cause — reviewer redeemed an invite → got 30d Premium → row was hidden → "couldn't find IAP"). `ProfileScreen.tsx` shows the Premium row unconditionally; Premium users see `premium.active` ("你已是 Premium 会员"), non-Premium see upgrade CTA. i18n verified in en/zh/ja/ko.
4. **i18n follows device locale.** `i18n/index.ts` no longer hardcodes `lng:'zh'` — reads `expo-localization` `getLocales()[0].languageCode`; zh/ja/ko honoured when device matches, everything else (incl. reviewer's English) → en. Manual Settings → 语言 override still persists. Added dep `expo-localization ~16.0.1` + config plugin.

**Done (DB):** `hafiz@example.com` set isPremium=false / premiumExpiresAt=null (script `backend-express/scripts/reset-hafiz-premium.js`, idempotent) — confirmed already in desired state (matched 1).

**Version:** 3.1.13 / iOS buildNumber 126 / Android versionCode 126. tsc 0 errors.

**Builds:** Android local → submit Play Internal (auto). iOS local → upload TestFlight ONLY (boss does Submit-for-Review manually in ASC). Test account: hafiz@example.com / 111111.
