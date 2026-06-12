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
  doesn't overlap the button. No contention.

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
