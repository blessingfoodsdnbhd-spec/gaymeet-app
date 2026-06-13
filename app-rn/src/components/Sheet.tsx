import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import { Gesture, type PanGesture } from 'react-native-gesture-handler';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  type BottomSheetModal as BottomSheetModalType,
} from '@gorhom/bottom-sheet';
import { useTheme } from '../theme/ThemeProvider';

interface Props {
  open: boolean;
  onClose: () => void;
  /**
   * Either a plain node (rendered below the grab handle), or a render-prop that
   * historically received a SECOND drag-to-dismiss gesture. With the
   * @gorhom/bottom-sheet engine the pull-to-dismiss is handled internally
   * (`enablePanDownToClose` + content/scroll coordination), so the gesture
   * passed to the render-prop is now a NO-OP placeholder kept only for type and
   * JSX compatibility — wrapping an area in `<GestureDetector gesture={dragArea}>`
   * is harmless and inert. Pull-to-dismiss still works from the grab handle and
   * (for `BottomSheetScrollView` content) from an over-scroll at the top.
   */
  children: React.ReactNode | ((dragArea: PanGesture) => React.ReactNode);
  /**
   * Caps the sheet height. The sheet is CONTENT-SIZED (grows to its children)
   * up to this ceiling, mirroring the old position:absolute + maxHeight card.
   * Percent string → fraction of window height; number → pixels.
   */
  maxHeight?: number | `${number}%`;
  /**
   * Rendered as a plain sibling ALONGSIDE the sheet (no longer inside a Modal
   * window — the sheet is drawn in-window by @gorhom/bottom-sheet). Use for
   * full-screen overlays (e.g. PhotoViewer) that bring their OWN window/portal
   * and therefore stack above the sheet on their own. Mounted whenever this
   * Sheet is mounted; each overlay child gates its own visibility.
   */
  overlay?: React.ReactNode;
  /**
   * Fires after the sheet has fully dismissed (both platforms now — the
   * BottomSheetModal `onDismiss` is reliable on Android too, unlike the old RN
   * Modal). Use to chain a second sheet open after this one closes.
   */
  onDismiss?: () => void;
  /**
   * @deprecated Keyboard avoidance is AUTOMATIC — BottomSheetModal rides above
   * the soft keyboard via `keyboardBehavior="interactive"`. Kept so existing
   * call sites keep type-checking; it has no effect.
   */
  avoidKeyboard?: boolean;
}

// A no-op pan gesture handed to render-prop children. @gorhom/bottom-sheet owns
// the real pull-down gesture, so this only needs to satisfy the PanGesture type
// and render its GestureDetector inertly. Created once (module scope) — it holds
// no per-sheet state.
const NOOP_DRAG: PanGesture = Gesture.Pan();

export function Sheet({ open, onClose, children, maxHeight = '85%', overlay, onDismiss }: Props) {
  const theme = useTheme();
  const { height: winH } = useWindowDimensions();
  const ref = useRef<BottomSheetModalType>(null);
  // Distinguishes a user/programmatic dismiss from a re-render: onDismiss must
  // call onClose exactly once per close.
  const closingRef = useRef(false);

  // Resolve the maxHeight ceiling to pixels for maxDynamicContentSize.
  const maxPx = useMemo(() => {
    if (typeof maxHeight === 'number') return maxHeight;
    const pct = parseFloat(maxHeight) / 100;
    return Math.round(winH * pct);
  }, [maxHeight, winH]);

  // Drive present/dismiss from the `open` prop — preserves the old declarative API.
  useEffect(() => {
    if (open) {
      closingRef.current = false;
      ref.current?.present();
    } else {
      ref.current?.dismiss();
    }
  }, [open]);

  const handleDismiss = useCallback(() => {
    // Called by BottomSheetModal after it finishes dismissing (handle swipe,
    // backdrop tap, or our ref.dismiss()). Fire onClose so the caller's `open`
    // state clears, plus the optional chain callback.
    if (!closingRef.current) {
      closingRef.current = true;
      onClose();
    }
    onDismiss?.();
  }, [onClose, onDismiss]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={0.35}
      />
    ),
    [],
  );

  const content = typeof children === 'function' ? children(NOOP_DRAG) : children;

  return (
    <>
      <BottomSheetModal
        ref={ref}
        // Content-sized up to maxPx — replicates the old "grow to content,
        // capped at maxHeight" card. No fixed snapPoints, so a 3-row menu stays
        // short and a long list grows to the ceiling then scrolls.
        enableDynamicSizing
        maxDynamicContentSize={maxPx}
        enablePanDownToClose
        onDismiss={handleDismiss}
        backdropComponent={renderBackdrop}
        // Keyboard handling — the whole point of this rewrite. `interactive`
        // tracks the IME animation and lifts the sheet exactly above it; on
        // Android adjustResize feeds the keyboard inset to the in-window sheet
        // (no separate Modal window to pan → no "fly to the top"). Sheets with a
        // TextInput must use <BottomSheetTextInput> for this to engage.
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        handleIndicatorStyle={{ backgroundColor: theme.colors.line, width: 36, height: 4 }}
        handleStyle={{ paddingTop: 10, paddingBottom: 8 }}
        backgroundStyle={{
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        }}
        style={theme.shadows.pop}
      >
        <BottomSheetView style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 28 }}>
          {content}
        </BottomSheetView>
      </BottomSheetModal>
      {overlay}
    </>
  );
}
