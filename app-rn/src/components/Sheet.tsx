import React, { useCallback, useEffect, useRef } from 'react';
import { Modal, Pressable, View, StyleSheet, useWindowDimensions } from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  type PanGesture,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useTheme } from '../theme/ThemeProvider';

const DISMISS_DISTANCE = 100;
const DISMISS_VELOCITY = 500;

interface Props {
  open: boolean;
  onClose: () => void;
  /**
   * Either a plain node (rendered below the grab handle), or a render-prop
   * that receives a SECOND drag-to-dismiss gesture wired to the same
   * ty/opacity shared values as the grab handle. Callers wanting a large
   * pull-down area (e.g. AboutUserSheet's photo header) wrap that area in
   * `<GestureDetector gesture={dragArea}>`. Plain-node callers are unaffected.
   */
  children: React.ReactNode | ((dragArea: PanGesture) => React.ReactNode);
  maxHeight?: number | `${number}%`;
  /**
   * Rendered as the topmost sibling INSIDE this Sheet's own Modal —
   * above the backdrop and the sheet card. Use for full-screen overlays
   * (e.g. PhotoViewer) that would otherwise need their own Modal; on
   * Android, opening a second Modal while this one is up stacks the
   * new Modal behind the existing one (RN nested-Modal limitation),
   * so we keep them in one window via this prop.
   */
  overlay?: React.ReactNode;
  /**
   * iOS-only, UNRELIABLE on the New Architecture: RN's native `Modal.onDismiss`.
   * It frequently never fires on Fabric + RN 0.76 (this app), so do NOT chain a
   * follow-up sheet off it — that was the #181 mechanism that left "编辑" doing
   * nothing on Build 61. Prefer `onClosed` below for chaining. Kept only for the
   * few legacy iOS-only callers that still pass it.
   */
  onDismiss?: () => void;
  /**
   * Reliable, BOTH platforms: fires once the card's slide-out animation has
   * fully completed (~220ms after `open` flips false). Driven off this Sheet's
   * OWN reanimated `withTiming` completion via `runOnJS` — NOT RN's flaky native
   * `Modal.onDismiss` — so it's deterministic on Fabric/Android where onDismiss
   * isn't.
   *
   * Use this to chain "close one Sheet, then open another" or "close a Sheet,
   * then present a fullScreenModal/navigate": by the time it fires the card has
   * slid off and the underlying Modal window is torn down, so the next Modal
   * mounts cleanly (no Android nested-Modal stacking, no iOS
   * present-while-dismissing race). Replaces the per-platform magic-number
   * setTimeout guesses (160/250/320/400ms) that raced this very animation.
   */
  onClosed?: () => void;
  /**
   * @deprecated Keyboard avoidance is now AUTOMATIC on both platforms — the
   * card always rides above the soft keyboard via react-native-keyboard-controller
   * (see SheetSurface). The prop is kept so existing call sites keep type-checking;
   * it has no effect. When no input is focused the keyboard height is 0, so a
   * sheet without a TextInput is unaffected.
   */
  avoidKeyboard?: boolean;
}

export function Sheet({ open, onClose, children, maxHeight, overlay, onDismiss, onClosed }: Props) {
  return (
    <Modal
      visible={open}
      transparent
      onRequestClose={onClose}
      animationType="none"
      onDismiss={onDismiss}
      // statusBarTranslucent is REQUIRED under Android 15 forced edge-to-edge
      // (targetSdk 35). Without it the Modal opens its own window that does NOT
      // draw under the status bar, while the host activity (edge-to-edge) does —
      // so the Modal's window is offset by the status-bar height and its content
      // shifts/jumps up ("flies to the top", overlapping the header) whenever the
      // window re-measures. Pairs with the KeyboardProvider below for the
      // keyboard-raise case. Every OTHER full-screen Modal in the app already
      // sets this (SafetyMenuSheet, PhotoViewer, PhotoConfirmModal…).
      statusBarTranslucent
    >
      {/* No nested KeyboardProvider needed: the ROOT provider (App.tsx) ships a
          ModalAttachedWatcher that detects RN <Modal> shows, attaches the
          WindowInsetsAnimation callback to the Modal's own window, and sets it to
          SOFT_INPUT_ADJUST_NOTHING — so Android no longer PANS the whole
          translucent Modal upward to reveal a focused TextInput (that pan was the
          edit/Premium/location "sheet flies to the top" bug). It also syncs the
          Modal's keyboard height into the SAME reanimated value that
          useReanimatedKeyboardAnimation reads below (React context crosses the
          Modal boundary). iOS keyboard notifications are global, so the height
          updates there without the watcher. */}
      <SheetSurface open={open} onClose={onClose} maxHeight={maxHeight} overlay={overlay} onClosed={onClosed}>
        {children}
      </SheetSurface>
    </Modal>
  );
}

function SheetSurface({
  open,
  onClose,
  children,
  maxHeight = '85%',
  overlay,
  onClosed,
}: Pick<Props, 'open' | 'onClose' | 'children' | 'maxHeight' | 'overlay' | 'onClosed'>) {
  const theme = useTheme();
  const { height: winH } = useWindowDimensions();
  const ty = useSharedValue(winH);
  const opacity = useSharedValue(0);
  // Native keyboard animation (both platforms). `height` is 0 when the keyboard
  // is hidden and goes NEGATIVE (−keyboardHeight) as it opens, so adding it to
  // the card's translateY lifts the card by exactly the keyboard height, in sync
  // with the IME animation. KeyboardProvider sets decorFitsSystemWindows(false)
  // so the window itself does NOT resize/pan for the keyboard — this transform is
  // the sole compensation (no double-shift).
  const { height: kbHeight } = useReanimatedKeyboardAnimation();

  // onClosed plumbing. The withTiming completion runs on the UI thread, so it
  // calls back to JS through a STABLE bridge (fireClosed) that reads the latest
  // callback off a ref — this way an inline/unstable `onClosed` from a caller
  // never re-runs the open/close effect (which would re-trigger the animation
  // on every parent render). `wasOpen` gates out the initial closed mount, where
  // ty already sits at winH and withTiming(winH) would otherwise fire its
  // completion immediately with nothing having actually closed.
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;
  const fireClosed = useCallback(() => {
    onClosedRef.current?.();
  }, []);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      ty.value = withTiming(0, { duration: 320, easing: Easing.bezier(0.2, 0.7, 0.2, 1) });
      opacity.value = withTiming(1, { duration: 250 });
    } else {
      const justClosed = wasOpen.current;
      wasOpen.current = false;
      opacity.value = withTiming(0, { duration: 180 });
      // Fire onClosed off the slide-out's OWN completion — deterministic on both
      // platforms, unlike RN's native Modal.onDismiss (dead on Fabric). `finished`
      // is false if a re-open interrupts the close mid-flight, so we don't signal
      // a close that didn't happen.
      ty.value = withTiming(winH, { duration: 220 }, (finished) => {
        if (finished && justClosed) {
          runOnJS(fireClosed)();
        }
      });
    }
  }, [open, winH, ty, opacity, fireClosed]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  // Lift by keyboard height (kbHeight, negative) on top of the dismiss transform.
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value + kbHeight.value }],
  }));

  // Swipe-down-to-dismiss. Drag follows the finger and fades the backdrop;
  // release past distance OR velocity → close, else spring back. The worklet
  // bodies are factored out so the grab handle AND the opt-in drag area (passed
  // to a render-prop child) run identical logic against the SAME ty/opacity
  // shared values. (A single Gesture instance can't attach to two detectors, so
  // we build two — but they share these worklets.)
  const onDragUpdate = (translationY: number) => {
    'worklet';
    ty.value = Math.max(0, translationY);
    opacity.value = Math.max(0, 1 - translationY / (winH * 0.5));
  };
  const onDragEnd = (translationY: number, velocityY: number) => {
    'worklet';
    if (translationY > DISMISS_DISTANCE || velocityY > DISMISS_VELOCITY) {
      ty.value = withTiming(winH, { duration: 200 });
      opacity.value = withTiming(0, { duration: 180 });
      runOnJS(onClose)();
    } else {
      ty.value = withTiming(0, { duration: 200 });
      opacity.value = withTiming(1, { duration: 180 });
    }
  };

  // Grab handle — a strip above the content, no offset gating (nothing competes
  // with it). The universal "grabber" pattern.
  const dragHandle = Gesture.Pan()
    .onUpdate((e) => onDragUpdate(e.translationY))
    .onEnd((e) => onDragEnd(e.translationY, e.velocityY));

  // Opt-in larger drag area for a render-prop child sitting over a horizontal
  // pager inside a vertical ScrollView (AboutUserSheet's photo header).
  // activeOffsetY defers to taps; the downward window + failOffsetX yield
  // horizontal swipes to the pager. Values mirror PhotoViewer's proven config.
  const dragArea = Gesture.Pan()
    .activeOffsetY([-14, 14])
    .failOffsetX([-18, 18])
    .onUpdate((e) => onDragUpdate(e.translationY))
    .onEnd((e) => onDragEnd(e.translationY, e.velocityY));

  return (
    // GestureHandlerRootView MUST use flex-based layout, not absolute fill.
    // On the New Architecture (Fabric) + Android, the native root view only
    // establishes its touch-target bounds from normal flow layout; given
    // `position:absolute` it ends up with a broken hit region and SWALLOWS
    // every touch to the children — making the whole sheet (all Pressable
    // rows) dead while still rendering. `flex:1` fills the Modal window
    // identically and restores taps. iOS is unaffected either way.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(30,15,5,0.35)' }, backdropStyle]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 14,
            paddingBottom: 28,
            maxHeight,
          },
          theme.shadows.pop,
          sheetStyle,
        ]}
      >
        {/* Grab handle — drag down to dismiss. Generous touch strip around
            the visible pill so it's easy to grab. */}
        <GestureDetector gesture={dragHandle}>
          <View style={{ alignItems: 'center', paddingTop: 2, paddingBottom: 12, marginTop: -2 }}>
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: theme.colors.line,
              }}
            />
          </View>
        </GestureDetector>
        {typeof children === 'function' ? children(dragArea) : children}
      </Animated.View>
      {overlay}
    </GestureHandlerRootView>
  );
}
