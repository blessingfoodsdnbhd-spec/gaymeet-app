import React, { forwardRef, useImperativeHandle, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

import { DiscoverCard } from './DiscoverCard';
import type { DiscoverCardUser } from '../../api/discover';

interface Props {
  cards: DiscoverCardUser[];
  /** Called after the top card flies off-screen. */
  onSwiped: (user: DiscoverCardUser, liked: boolean) => void;
}

export interface CardStackHandle {
  /** Imperatively trigger a swipe (used by action-bar buttons). */
  swipe: (liked: boolean) => void;
}

const SWIPE_THRESHOLD = 100;
const FLY_DISTANCE = 600;
const FLY_DURATION = 250;

export const CardStack = forwardRef<CardStackHandle, Props>(function CardStack(
  { cards, onSwiped },
  ref,
) {
  const top = cards[0];
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  const finalize = useCallback(
    (liked: boolean) => {
      if (!top) return;
      onSwiped(top, liked);
      tx.value = 0;
      ty.value = 0;
    },
    [top, onSwiped, tx, ty],
  );

  const flyOff = useCallback(
    (liked: boolean) => {
      'worklet';
      const sign = liked ? 1 : -1;
      ty.value = withTiming(ty.value * 0.5, {
        duration: FLY_DURATION,
        easing: Easing.bezier(0.2, 0.7, 0.2, 1),
      });
      tx.value = withTiming(
        sign * FLY_DISTANCE,
        { duration: FLY_DURATION, easing: Easing.bezier(0.2, 0.7, 0.2, 1) },
        (finished) => {
          if (finished) runOnJS(finalize)(liked);
        },
      );
    },
    [tx, ty, finalize],
  );

  const pan = Gesture.Pan()
    .onChange((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
    })
    .onEnd(() => {
      if (Math.abs(tx.value) > SWIPE_THRESHOLD) {
        flyOff(tx.value > 0);
      } else {
        tx.value = withTiming(0, { duration: 220 });
        ty.value = withTiming(0, { duration: 220 });
      }
    });

  useImperativeHandle(ref, () => ({
    swipe: (liked: boolean) => flyOff(liked),
  }));

  const topStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value * 0.3 },
      { rotate: `${tx.value * 0.06}deg` },
    ],
  }));

  // Hoist the GestureDetector ABOVE the cards map so it doesn't unmount
  // and remount when the top card changes after a swipe. Previously each
  // card was conditionally wrapped — `<GestureDetector><Animated.View>`
  // for the top vs `<Animated.View>` alone for the rest. When card B
  // transitioned non-top → top after a swipe, React saw a different
  // element type at the same array position and rebuilt the whole
  // subtree. That remount re-played expo-image's `transition={150}` fade
  // on the (now-top) card's Image → the visible "flash" the user reported.
  //
  // Now every card uses the identical Animated.View wrapper; only the
  // style switches between `topStyle` (gesture-driven) and the non-top
  // translateY+scale. React reconciles in place, the Image stays
  // mounted, no fade re-plays, no flash.
  return (
    <GestureDetector gesture={pan}>
      <View style={styles.wrap}>
        {cards.slice(0, 3).reverse().map((card, i, arr) => {
          const idx = arr.length - 1 - i; // 0 = top
          const isTop = idx === 0;
          const scale = 1 - idx * 0.04;
          const offsetY = idx * 10;

          const baseStyle = {
            position: 'absolute' as const,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10 - idx,
            opacity: idx === 2 ? 0.92 : 1,
          };

          return (
            <Animated.View
              key={card.id}
              style={[
                baseStyle,
                isTop
                  ? topStyle
                  : { transform: [{ translateY: offsetY }, { scale }] },
              ]}
            >
              <DiscoverCard user={card} dragX={isTop ? tx : undefined} isTop={isTop} />
            </Animated.View>
          );
        })}
      </View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    position: 'relative',
    marginHorizontal: 20,
    marginVertical: 4,
  },
});
