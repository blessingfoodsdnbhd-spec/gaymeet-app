import { Platform } from 'react-native';
import { KeyboardController } from 'react-native-keyboard-controller';

/**
 * Android edge-to-edge soft-input PAN guard.
 *
 * Since edge-to-edge landed (Build 53, #216), Android pans the active Modal
 * window to the top of the screen whenever the soft keyboard is up as that
 * Modal mounts — throwing bottom Sheets / action sheets over the header. Wait
 * for any live keyboard to FULLY retract BEFORE opening the Sheet so the
 * freshly-mounted Modal never inherits a keyboard to be panned by.
 *
 * `KeyboardController.dismiss()` (react-native-keyboard-controller) resolves its
 * promise only once the native IME hide animation has completed — so we open the
 * Sheet on `.then(open)` rather than firing `open()` in the same tick we ask the
 * keyboard to close. That ordering is the real fix: the old
 * `Keyboard.dismiss(); open()` raced the still-animating keyboard and the Modal
 * could mount mid-pan. Resolves instantly when nothing is focused, so it's a
 * harmless no-op on iOS (no such window pan) and on an idle screen.
 *
 * Use this at every call site that opens a `<Sheet>` / `<Modal>` (long-press
 * action sheets, "tag friends", "add location", settings sheets…) where a
 * composer / search keyboard may be up at the moment of opening.
 * Generalises the ChatDetailScreen long-press fix from #220.
 */
export function openSheetAfterKeyboardDismiss(open: () => void) {
  KeyboardController.dismiss().then(open).catch(open);
}

/**
 * Close a bottom Sheet / Modal and THEN navigate — safely on Android.
 *
 * Every `<Sheet>` (and the Android safety menu) is a RN `<Modal>`, i.e. a native
 * Android Dialog window. Dispatching a navigation in the SAME tick you close that
 * Modal makes Android drop the navigation mid-Dialog-teardown — the target screen
 * opens only after several taps. This is the documented "open only after 4–5 taps"
 * race behind the MapPicker fix in ComposerScreen (#190/#204) and AboutUserSheet's
 * `onMore`; the same race silently affected every other close-then-navigate site.
 *
 * Fire `close()` now (starts the sheet slide-out), then defer `go()` past the
 * ~220ms slide so the push lands on the now-focused root activity. iOS has no
 * Dialog-teardown race for a card push, so it navigates immediately — no
 * perceptible change there.
 *
 * NOTE: only for card pushes. A screen presented as a Modal (e.g.
 * `presentation: 'fullScreenModal'`) ALSO needs the iOS present-while-dismissing
 * guard — chain those off the Sheet's `onDismiss` instead (see ComposerScreen).
 */
export function navigateAfterSheetClose(close: () => void, go: () => void) {
  close();
  if (Platform.OS === 'android') {
    setTimeout(go, 250);
  } else {
    go();
  }
}
