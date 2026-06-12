import { Keyboard } from 'react-native';

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
