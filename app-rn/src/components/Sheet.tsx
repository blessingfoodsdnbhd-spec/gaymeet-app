import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import { Gesture, type PanGesture } from 'react-native-gesture-handler';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useTheme } from '../theme/ThemeProvider';

interface Props {
  open: boolean;
  onClose: () => void;
  /**
   * Either a plain node (rendered below the grab handle), or a render-prop
   * that receives a drag-to-dismiss gesture. With the @gorhom/bottom-sheet
   * implementation the sheet's OWN handle drives drag-to-dismiss, so the
   * gesture handed to the render-prop is an inert (disabled) Pan kept only for
   * API compatibility — existing callers (AboutUserSheet) wrap their photo
   * header in `<GestureDetector gesture={dragArea}>` and keep type-checking and
   * pass-through touches (tap-to-zoom, horizontal paging) unchanged.
   */
  children: React.ReactNode | ((dragArea: PanGesture) => React.ReactNode);
  maxHeight?: number | `${number}%`;
  /**
   * Rendered as a SIBLING of the sheet (outside the bottom-sheet portal) so it
   * floats above everything. Use for full-screen overlays (e.g. PhotoViewer)
   * that self-gate on their own `open` prop. Unlike the old RN-Modal version,
   * gorhom does NOT open a separate native Modal window, so an overlay that is
   * itself an RN <Modal> (PhotoViewer) stacks correctly on both platforms with
   * no nested-Modal workaround needed.
   */
  overlay?: React.ReactNode;
  /**
   * Fires AFTER the sheet has fully dismissed. Use to chain a SECOND sheet open
   * after this one closes. Maps to BottomSheetModal's `onDismiss`, which fires
   * on both platforms once the close animation completes.
   */
  onDismiss?: () => void;
  /**
   * @deprecated Keyboard avoidance is AUTOMATIC — @gorhom/bottom-sheet tracks
   * the soft keyboard (keyboardBehavior="interactive") and, combined with the
   * app-wide KeyboardProvider, lifts the card above the IME. The prop is kept so
   * existing call sites keep type-checking; it has no effect.
   */
  avoidKeyboard?: boolean;
}

function pctToPx(maxHeight: Props['maxHeight'], winH: number): number {
  if (maxHeight == null) return winH * 0.85; // default mirrors the old '85%'
  if (typeof maxHeight === 'number') return maxHeight;
  const n = parseFloat(maxHeight);
  return Number.isFinite(n) ? (winH * n) / 100 : winH * 0.85;
}

export function Sheet({ open, onClose, children, maxHeight, overlay, onDismiss }: Props) {
  const theme = useTheme();
  const { height: winH } = useWindowDimensions();
  const ref = useRef<BottomSheetModal>(null);

  // Drive present/dismiss from the declarative `open` prop, preserving the
  // existing controlled API. present()/dismiss() are idempotent.
  useEffect(() => {
    if (open) ref.current?.present();
    else ref.current?.dismiss();
  }, [open]);

  // gorhom reports index -1 when the sheet is dismissed by a pan-down or a
  // backdrop tap. Surface that as the controlled onClose so parent state stays
  // in sync with the gesture. (When the parent flips `open` to false the effect
  // above also dismisses; calling onClose again from index -1 is harmless since
  // parents guard their own state.)
  const onChange = useCallback(
    (index: number) => {
      if (index === -1 && open) onClose();
    },
    [open, onClose],
  );

  // Tap-the-scrim-to-close backdrop, fading in as the sheet appears.
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={0.35}
        style={[props.style, { backgroundColor: 'rgba(30,15,5,1)' }]}
      />
    ),
    [],
  );

  // Inert gesture for render-prop callers (drag handled by the sheet handle).
  const dragArea = useMemo(() => Gesture.Pan().enabled(false), []);

  const maxDynamic = useMemo(() => pctToPx(maxHeight, winH), [maxHeight, winH]);

  return (
    <>
      <BottomSheetModal
        ref={ref}
        // Content-height sheet capped at the caller's maxHeight, anchored to the
        // bottom — matches the old `position:absolute; bottom:0; maxHeight:X`.
        enableDynamicSizing
        maxDynamicContentSize={maxDynamic}
        enablePanDownToClose
        // Inner ScrollViews (AboutUserSheet, FiltersSheet, RoomSettingsSheet…)
        // are plain RN ScrollViews, not BottomSheetScrollView. Disabling the
        // content panning gesture keeps their scrolling 100% unchanged and lets
        // ONLY the handle drag the sheet — no scroll/drag conflict, so no
        // consumer edits are needed. Drag-to-dismiss still works via the handle.
        enableContentPanningGesture={false}
        onChange={onChange}
        onDismiss={onDismiss}
        backdropComponent={renderBackdrop}
        backgroundStyle={{
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        }}
        handleIndicatorStyle={{ backgroundColor: theme.colors.line, width: 36, height: 4 }}
        // Lift above the soft keyboard automatically (replaces the old manual
        // reanimated-keyboard transform). Pairs with the app-wide KeyboardProvider.
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
      >
        <BottomSheetView style={{ paddingHorizontal: 20, paddingTop: 0, paddingBottom: 28 }}>
          {typeof children === 'function' ? children(dragArea) : children}
        </BottomSheetView>
      </BottomSheetModal>
      {overlay}
    </>
  );
}
