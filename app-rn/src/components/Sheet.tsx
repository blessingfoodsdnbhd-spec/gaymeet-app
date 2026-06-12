import React, { useEffect } from 'react';
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
   * iOS-only: fires after the underlying Modal has fully dismissed. Use to
   * chain a SECOND sheet open after this one closes — iOS rejects presenting
   * a Modal while another is still dismissing, so opening the next sheet in
   * the same tick we close this one makes it silently fail to appear. Wait
   * for this callback instead. (No-op on Android, where there is no such
   * present-while-dismissing race.)
   */
  onDismiss?: () => void;
}

export function Sheet({ open, onClose, children, maxHeight = '85%', overlay, onDismiss }: Props) {
  const theme = useTheme();
  const { height: winH } = useWindowDimensions();
  const ty = useSharedValue(winH);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (open) {
      ty.value = withTiming(0, { duration: 320, easing: Easing.bezier(0.2, 0.7, 0.2, 1) });
      opacity.value = withTiming(1, { duration: 250 });
    } else {
      ty.value = withTiming(winH, { duration: 220 });
      opacity.value = withTiming(0, { duration: 180 });
    }
  }, [open, winH, ty, opacity]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));

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
    <Modal visible={open} transparent onRequestClose={onClose} animationType="none" onDismiss={onDismiss}>
      {/* GestureHandlerRootView MUST use flex-based layout, not absolute fill.
          On the New Architecture (Fabric) + Android, the native root view only
          establishes its touch-target bounds from normal flow layout; given
          `position:absolute` it ends up with a broken hit region and SWALLOWS
          every touch to the children — making the whole sheet (all Pressable
          rows) dead while still rendering. `flex:1` fills the Modal window
          identically and restores taps. iOS is unaffected either way. */}
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
    </Modal>
  );
}
