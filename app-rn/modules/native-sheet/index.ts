import { requireNativeModule } from 'expo-modules-core';

/**
 * Native sheet/alert bridge. Wraps the OS-native dialog primitives
 * (UIAlertController on iOS, AlertDialog / Material BottomSheetDialog on
 * Android) so confirm/choice UI is drawn by the system, NOT by a React Native
 * <Modal>. RN Modals open a second Android window that, under Android 15 forced
 * edge-to-edge, mis-positions and "flies to the top". A native dialog has no
 * such window-offset problem — this is the permanent fix for that class.
 *
 * Returns the index of the tapped button/option (or the cancel index / -1 on
 * dismiss). Promise-based so callers `await` the choice.
 */
const Native = requireNativeModule('NativeSheet');

export type NativeButtonStyle = 'default' | 'cancel' | 'destructive';

export interface NativeButton {
  label: string;
  style?: NativeButtonStyle;
}

/** Native centered alert (UIAlertController .alert / Android AlertDialog). */
export async function nativeAlert(
  title: string,
  message: string,
  buttons: NativeButton[],
): Promise<number> {
  console.log(`[NativeSheet] alert → native: "${title}"`); // logcat: confirms native path, not RN Modal
  return (await Native.presentAlert(title, message, buttons)) as number;
}

export interface NativeActionSheetOptions {
  title?: string;
  message?: string;
  /** Row labels, top to bottom. */
  options: string[];
  /** Index that dismisses without action (also the value resolved on backdrop tap). */
  cancelIndex?: number;
  /** Index rendered in destructive/red styling. */
  destructiveIndex?: number;
}

/**
 * Native action sheet — UIAlertController .actionSheet on iOS, Material
 * BottomSheetDialog on Android (slides up from the bottom, edge-to-edge safe).
 */
export async function nativeActionSheet(opts: NativeActionSheetOptions): Promise<number> {
  console.log(`[NativeSheet] actionSheet → native: ${opts.options.length} options`); // logcat trace
  return (await Native.presentActionSheet(
    opts.title ?? null,
    opts.message ?? null,
    opts.options,
    opts.cancelIndex ?? null,
    opts.destructiveIndex ?? null,
  )) as number;
}
