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
import { Reply } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';

const TRIGGER = 60; // drag this far (pt) to arm the reply
const MAX_DRAG = 80; // bubble can't slide further than this

/**
 * WhatsApp-style swipe-right-to-reply wrapper. Wrap a single message row; a
 * short rightward drag slides it, reveals a reply glyph, and — once past
 * TRIGGER — fires a haptic and calls `onReply` on release. The bubble always
 * springs back.
 *
 * The pan only engages on a horizontal-dominant drag (`activeOffsetX`) and
 * bails the moment the finger moves vertically (`failOffsetY`), so the parent
 * FlatList keeps full control of vertical scrolling and any inner
 * Pressable/long-press still works when the finger doesn't travel sideways.
 */
export function SwipeToReply({
  onReply,
  enabled = true,
  children,
}: {
  onReply: () => void;
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

  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .activeOffsetX(12) // engage only on a rightward drag past 12pt
        .failOffsetY([-12, 12]) // yield to vertical scroll
        .onUpdate((e) => {
          translateX.value = Math.max(0, Math.min(e.translationX, MAX_DRAG));
          if (translateX.value >= TRIGGER && !armed.value) {
            armed.value = true;
            runOnJS(fireHaptic)();
          } else if (translateX.value < TRIGGER && armed.value) {
            armed.value = false;
          }
        })
        .onEnd(() => {
          if (translateX.value >= TRIGGER) runOnJS(onReply)();
          armed.value = false;
          translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
        }),
    [enabled, onReply, fireHaptic, translateX, armed],
  );

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // The glyph sits behind the row's left edge, fading + scaling in as the
  // bubble slides away to reveal it.
  const iconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, TRIGGER], [0, 1], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(translateX.value, [0, TRIGGER], [0.6, 1], Extrapolation.CLAMP) },
    ],
  }));

  if (!enabled) return <>{children}</>;

  return (
    <View>
      <Animated.View style={[styles.iconWrap, iconStyle]} pointerEvents="none">
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
    alignItems: 'flex-start',
    paddingLeft: 6,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
