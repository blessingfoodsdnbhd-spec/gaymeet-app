import { Keyboard, Platform } from 'react-native';

/**
 * Android edge-to-edge soft-input PAN guard.
 *
 * Since edge-to-edge landed (Build 53, #216), Android pans the active Modal
 * window to the top of the screen whenever the soft keyboard is up as that
 * Modal mounts — throwing bottom Sheets / action sheets over the header. Drop
 * any live keyboard BEFORE opening the Sheet so the freshly-mounted Modal never
 * inherits a keyboard to be panned by.
 *
 * Use this at every call site that opens a `<Sheet>` / `<Modal>` (long-press
 * action sheets, "tag friends", "add location", settings sheets…) where a
 * composer / search keyboard may be up at the moment of opening.
 *
 * Harmless no-op on iOS (no such window pan) and when nothing is focused.
 * Generalises the ChatDetailScreen long-press fix from #220.
 */
export function openSheetAfterKeyboardDismiss(open: () => void) {
  Keyboard.dismiss();
  open();
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
