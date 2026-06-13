import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Pencil, Reply } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';

const TRIGGER = 60; // drag this far (pt) to arm an action
const MAX_DRAG = 80; // bubble can't slide further than this

/**
 * Bidirectional swipe wrapper for a single message row.
 *   • Swipe LEFT  → reply  (`onReply`)        — reply glyph on the right edge.
 *   • Swipe RIGHT → edit   (`onEdit`)         — pencil glyph on the left edge.
 *
 * Each direction only engages when its handler is provided; a short drag past
 * TRIGGER fires a haptic and calls the handler on release. The bubble always
 * springs back. Named SwipeToReply for back-compat with existing call sites.
 *
 * The pan only engages on a horizontal-dominant drag (`activeOffsetX`) and bails
 * the moment the finger moves vertically (`failOffsetY`), so the parent FlatList
 * keeps full control of vertical scrolling and any inner Pressable/long-press
 * still works when the finger doesn't travel sideways.
 */
export function SwipeToReply({
  onReply,
  onEdit,
  enabled = true,
  children,
}: {
  /** Swipe-LEFT handler. */
  onReply: () => void;
  /** Swipe-RIGHT handler (e.g. inline edit). Omit to disable right swipes. */
  onEdit?: () => void;
  /** When false the row renders normally with no gesture (e.g. pending sends). */
  enabled?: boolean;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const translateX = useSharedValue(0);
  const armed = useSharedValue(false);

  const fireHaptic = React.useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, []);

  const canEdit = !!onEdit;

  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .activeOffsetX([-12, 12]) // engage on either horizontal direction
        .failOffsetY([-12, 12]) // yield to vertical scroll
        .onUpdate((e) => {
          // Right (positive) → edit, but only if an edit handler exists.
          const lo = -MAX_DRAG;
          const hi = canEdit ? MAX_DRAG : 0;
          translateX.value = Math.max(lo, Math.min(e.translationX, hi));
          const past = Math.abs(translateX.value) >= TRIGGER;
          if (past && !armed.value) {
            armed.value = true;
            runOnJS(fireHaptic)();
          } else if (!past && armed.value) {
            armed.value = false;
          }
        })
        .onEnd(() => {
          if (translateX.value <= -TRIGGER) runOnJS(onReply)();
          else if (canEdit && translateX.value >= TRIGGER) runOnJS(onEdit!)();
          armed.value = false;
          translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
        }),
    [enabled, canEdit, onReply, onEdit, fireHaptic, translateX, armed],
  );

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Reply glyph on the RIGHT edge, revealed as the bubble slides left.
  const replyIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, -TRIGGER], [0, 1], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(translateX.value, [0, -TRIGGER], [0.6, 1], Extrapolation.CLAMP) },
    ],
  }));

  // Edit glyph on the LEFT edge, revealed as the bubble slides right.
  const editIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, TRIGGER], [0, 1], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(translateX.value, [0, TRIGGER], [0.6, 1], Extrapolation.CLAMP) },
    ],
  }));

  if (!enabled) return <>{children}</>;

  return (
    <View>
      {canEdit && (
        <Animated.View style={[styles.iconWrap, styles.iconLeft, editIconStyle]} pointerEvents="none">
          <View style={[styles.iconCircle, { backgroundColor: theme.colors.surface2 }]}>
            <Pencil size={18} color={theme.colors.primary} strokeWidth={2} />
          </View>
        </Animated.View>
      )}
      <Animated.View style={[styles.iconWrap, styles.iconRight, replyIconStyle]} pointerEvents="none">
        <View style={[styles.iconCircle, { backgroundColor: theme.colors.surface2 }]}>
          <Reply size={18} color={theme.colors.primary} strokeWidth={2} />
        </View>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
  },
  iconLeft: { alignItems: 'flex-start', paddingLeft: 6 },
  iconRight: { alignItems: 'flex-end', paddingRight: 6 },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
