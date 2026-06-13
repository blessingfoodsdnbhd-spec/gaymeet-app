# Build 60 — chat-edit static diagnostics + console probes

Follow-up to the Build 59 report (long-press → 编辑 needs several tries; edit
TextInput needs a 2nd tap). A friend's hypothesis was that three symptoms (map
multi-tap / keyboard fly-to-top / edit multi-tap) share **one** root cause:
overlay touch-interception + focus management. The static sweep below tests that
hypothesis for the **chat-edit** path; the console probes will confirm with
real-device data.

## A. `pointerEvents` overlay sweep

Searched all `pointerEvents="none" | "box-none" | "box-only"` in `src/`.

**Nothing covers the message list or the edit button.** The matches on the chat
path are all benign:

| Site | Why benign |
|------|-----------|
| `components/SwipeToReply.tsx:88` `none` | reply glyph sits **behind** the row in an absolute-fill that explicitly does **not** capture touches |
| `components/ChatComposer.tsx:381` `none` | decorative element inside the composer, below the list |
| `components/MessageBanner.tsx` `box-none` | app-wide **top** toast; `box-none` passes through except on its own children (a top banner, not over the bubbles) |
| `components/Toast.tsx`, `ToastProvider.tsx`, `RadarPulse.tsx` `none` | pure pass-through overlays |

**Decisive point:** the actions sheet and the edit sheet are RN `<Modal>`s —
each a **separate Android Dialog window** that renders *above* every one of those
app-level overlays. So no `pointerEvents` layer can intercept a tap on the **edit
button** (it lives inside the actions Modal's own window) nor on the **edit
TextInput** (inside the edit Modal's window). The overlay-interception
hypothesis does **not** explain the edit-path symptoms.

## B. Gesture-handler nesting around the long-press

The message row is:

```
<SwipeToReply>                       // RNGH GestureDetector(Pan)
  <View>
    <Pressable onLongPress delayLongPress={350}>   // RN Pressable
      <Bubble/>
```

- `SwipeToReply`'s Pan is correctly constrained: `activeOffsetX(12)` +
  `failOffsetY([-12,12])` → it only engages on a horizontal drag and yields to
  vertical scroll, so a **stationary long-press never activates the Pan** and the
  inner Pressable's `onLongPress` fires. No `RectButton` / `BaseButton`, no
  `stopPropagation`. Confirmed empirically: the actions sheet **does** open — the
  long-press is not the failing step.
- The edit button is a plain `Pressable` (ActionRow) inside the Sheet's
  `GestureHandlerRootView`; the Sheet's only Pan is the drag-handle strip, which
  doesn't overlap the button. **No *Pan* contention — but see the Build 61 update
  below: RN `Pressable` ↔ RNGH-root first-touch contention was missed here.**

## Conclusion

For the chat-edit path the shared root cause is **not** overlay interception —
it's the **two-separate-`<Modal>` architecture + Android Dialog teardown/focus
races**:

- **Bug A** (编辑 needs several tries): the actions Dialog hadn't finished tearing
  down when the edit Dialog mounted → the new Dialog landed behind it. Fixed:
  `requestAnimationFrame` + 360ms handoff (was 160ms).
- **Bug B** (TextInput needs 2nd tap): the first `focus()` inside a freshly
  mounted nested Modal is dropped on Android Fabric → keyboard never rose. Fixed:
  Android-only retry-focus at 650ms gated on `KeyboardController.isVisible()`.

The map multi-tap symptom is the **same class** (Modal/navigation handoff race,
already addressed by `navigateAfterSheetClose`, PR #224), which corroborates
"handoff timing", not "overlay interception", as the family root cause.

## Build 61 update — device repro pins a SECOND, deeper root cause

A device repro narrowed it precisely: in the moment **add-location** sheet, the
"🗺 在地图上选择" button **needs several taps — UNLESS you first scroll the city
list, after which one tap works.** The button sits *above* the ScrollView, so the
ScrollView isn't intercepting it; rather, **the first touch anywhere in the
sheet is consumed**, and the scroll just happens to be that first (sacrificial)
touch.

Root cause: **RN `Pressable` (JS responder system) contends with RNGH's native
gesture system inside the Sheet's `GestureHandlerRootView`.** On Android the
first touch after the sheet mounts is eaten establishing the gesture context, so
the first `onPress` never fires. This is a known RNGH-on-Android issue; the fix
is to use **RNGH's own `Pressable`** (`react-native-gesture-handler`), which
participates in the same native gesture system and responds on the first tap.

This is almost certainly the **real** root of "编辑 needs several taps" too — the
`ActionRow` (edit/copy/delete row) is an RN `Pressable` in the same
`GestureHandlerRootView`, so its first tap was eaten *before* `onPress`, which no
handoff-timing fix can rescue. The Build 60 rAF+360ms handoff still helps the
*second* race (Dialog teardown once the tap does fire), so both fixes stay.

**Applied in Build 61:**
- `MomentLocationSheet` + `VirtualLocationSheet`: RN `Pressable` → RNGH
  `Pressable` (all rows incl. the map button); ScrollViews get
  `keyboardShouldPersistTaps="handled"` + `nestedScrollEnabled` (insurance).
- `ChatDetailScreen.ActionRow`: RN `Pressable` → RNGH `Pressable` (aliased
  `GHPressable`). Screen-level Pressables (header, message rows) stay on RN's —
  they're not inside a Sheet.
- Un-gated MomentLocationSheet's existing `LOCATION_*` tap probes (were `__DEV__`,
  invisible on the release Play build the user actually tests) so device logcat
  now shows one `MAP_PRESS_IN`/`MAP_CLICK` per tap — confirming the fix.
- Keyboard-bearing sheets (`FriendPickerSheet`, `FiltersSheet`, `RoomSettingsSheet`)
  already carry `keyboardShouldPersistTaps="handled"` — left as-is.

> Why not `setInputMode(SOFT_INPUT_ADJUST_NOTHING)` (still on the audit list):
> native `KeyboardControllerModuleImpl.setSoftInputMode` targets
> `currentActivity.window` (the host activity), **not** the Sheet Modal's own
> Dialog window — so it can't govern the Modal's pan and risks stranding the
> activity in `ADJUST_NOTHING`. While a Modal Dialog is up it owns focus and its
> own soft-input mode, so the activity-window mode is moot anyway. The edit
> Modal's "don't pan the keyboard" intent is **already met** by #227's
> KeyboardProvider + the Sheet's reanimated `ty+kbHeight` lift (this is what fixed
> the Build 56/57 fly-to-top). Adding `setInputMode` would be cargo-cult — skipped
> deliberately. (Happy to add it if desired, but it won't move the needle.)

## Build 62 update — voice recording UI (same family)

The voice mic showed the same symptoms (giant pink mic stuck on screen / record
needs several taps). Two distinct causes, both fixed:

1. **`ChatVoiceRecorderSheet`** (the tap-to-record bottom sheet — its 84×84 pink
   `bigBtn` Mic IS the "giant pink mic"): its record/stop/play buttons were RN
   `Pressable` inside the Sheet's `GestureHandlerRootView` → the **same first-tap
   contention** as the location/edit buttons, so "tap mic to start recording"
   needed several taps. **Fix:** RN `Pressable` → RNGH `Pressable`. Added
   `debugTag="voice"` (→ `SHEET_SHOW`/`SHEET_CLOSE voice`) + a `VOICE_RECORD_TAP`
   probe to confirm on device.
2. **Inline hold-to-record overlay** (`ChatComposer`): the mic Pan used `.onEnd()`
   only. RNGH fires `onEnd` ONLY on a clean finger-lift; a **cancelled/interrupted**
   gesture skips it, so `voicePhase` stuck on `'recording'` and the recording
   overlay **never dismounted** ("overlay 没关掉"). **Fix:** add
   `.onFinalize((_e, success) => { if (!success) cancelStuckHold() })` — a safety
   net that discards + resets to idle on a non-successful finalize (a `locked`
   hands-free HUD already ended successfully, so it's left alone). The overlay is
   already `pointerEvents="none"`, so it never blocked touches — the bug was
   purely the stuck mount, not interception.

## Console probes shipped in this build (readable on the release Play install)

This project has **no** `transform-remove-console` babel plugin, so `console.*`
survives the release AAB and is readable via:

```
adb logcat -s ReactNativeJS:V | grep -E "EDIT_BUTTON_TAP|TEXTINPUT_FOCUS|SHEET_SHOW|SHEET_CLOSE"
```

| Log | Where | Reads |
|-----|-------|-------|
| `EDIT_BUTTON_TAP <ts>` | edit ActionRow `onPress` | a line **every** tap → button gets the event (handoff fault); a line only every few taps → tap intercepted upstream |
| `TEXTINPUT_FOCUS_{100,300,500,800,1200}ms <isFocused> kbVisible <bool>` | edit-sheet mount effect | when `isFocused` flips false→true and whether the IME follows |
| `SHEET_SHOW`/`SHEET_CLOSE <tag> <ts>` (`tag` = `actions` \| `edit`) | shared `Sheet` via `debugTag` | the gap between actions-CLOSE and edit-SHOW (the handoff window) |

These are **diagnostic** and intentionally ungated (a `__DEV__` gate would strip
them from the very release build the user tests). Remove them in the next build
once we have device data.
