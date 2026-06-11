import React, { forwardRef, useImperativeHandle, useCallback, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Image as ExpoImage } from 'expo-image';

import { DiscoverCard } from './DiscoverCard';
import { useDiscoverPrefs } from '../../store/discoverPrefs';
import { prefetchMany, clearVoiceCache } from '../../utils/voiceCache';
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
  // Promotion progress for the cards BEHIND the top one (0 = resting, 1 =
  // fully shifted up one slot). This is driven ONLY by a commit (flyOff),
  // never by the drag — so while the user is dragging the top card the
  // behind cards stay perfectly still instead of creeping forward and
  // snapping back (the jitter the user reported).
  const promote = useSharedValue(0);

  // Prefetch upcoming cards' avatars into expo-image's disk cache so they
  // decode instantly the moment they shift into the rendered window. We
  // render cards 0–2 (top + 2 under); prefetch cards 2–6 covers the
  // pipeline so even after 4 swipes the next card is already cached.
  useEffect(() => {
    const upcoming = cards
      .slice(2, 7)
      .map((c) => c.avatarUrl)
      .filter((url): url is string => !!url);
    if (upcoming.length === 0) return;
    // memory-disk so cache survives across this component's lifetime
    ExpoImage.prefetch(upcoming, 'memory-disk').catch(() => {
      // best-effort; if a single URL fails the others may still cache
    });
  }, [cards]);

  // Preload the TOP cards' voice intros (only when the Nearby toggle is on) so
  // auto-play in AboutUserSheet is instant instead of a 3–4s download.
  const introVoice = useDiscoverPrefs((s) => s.introVoice);
  useEffect(() => {
    if (!introVoice) return;
    // Warm more of the deck (was top 5) now the cache holds 20 — covers
    // several swipes ahead so taps stay instant.
    prefetchMany(cards.slice(0, 12).map((c) => (c as any).voiceIntroUrl));
  }, [cards, introVoice]);

  // Free the preloaded sounds when the deck unmounts.
  useEffect(() => () => { clearVoiceCache(); }, []);

  const finalize = useCallback(
    (liked: boolean) => {
      if (!top) return;
      onSwiped(top, liked);
      tx.value = 0;
      ty.value = 0;
      // Snap promotion back to 0 BEFORE the new deck renders. The card that
      // was idx=1 (animated up to ~slot-0 via promote=1) becomes the new top
      // and switches to topStyle (scale 1.0) — match. The card that was idx=2
      // becomes the new idx=1 and must read card1Style at its resting scale
      // (0.96), so promote has to be 0 again by this frame.
      promote.value = 0;
    },
    [top, onSwiped, tx, ty, promote],
  );

  const flyOff = useCallback(
    (liked: boolean) => {
      'worklet';
      const sign = liked ? 1 : -1;
      // Promote the behind cards into their next slots concurrently with the
      // fly-off. This is the ONLY place promotion happens — so the behind
      // cards grow smoothly during the commit (no "pop bigger" flash) but
      // never move during an incomplete drag.
      promote.value = withTiming(1, {
        duration: FLY_DURATION,
        easing: Easing.bezier(0.2, 0.7, 0.2, 1),
      });
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
    [tx, ty, promote, finalize],
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

  // Non-top card styles. These shift up one slot (smaller → bigger) driven
  // by `promote`, which animates 0 → 1 ONLY during a commit (flyOff) — NOT
  // during the drag. Earlier these read `tx` directly, so a behind card
  // crept forward as you dragged the top card and then snapped back if you
  // released without crossing the threshold — the jitter the user reported.
  // Driving them off `promote` means:
  //   - mid-drag (no commit): promote stays 0 → behind cards sit perfectly
  //     still. Since these worklets no longer read `tx`, they don't even
  //     re-run on each drag frame.
  //   - on commit: promote runs 0 → 1 alongside the fly-off, so the behind
  //     card has grown to its target by the time it becomes the new top
  //     (topStyle scale 1.0) — no "pop bigger" flash.
  //
  // Math:
  //   idx=1 (behind):     scale 0.96 → 1.00, translateY 10 → 0
  //   idx=2 (behind 2):   scale 0.92 → 0.96, translateY 20 → 10, opacity 0.92 → 1.0
  const card1Style = useAnimatedStyle(() => {
    const p = promote.value;
    const scale = 0.96 + (1.0 - 0.96) * p;
    const y = 10 + (0 - 10) * p;
    return { transform: [{ translateY: y }, { scale }] };
  });

  const card2Style = useAnimatedStyle(() => {
    const p = promote.value;
    const scale = 0.92 + (0.96 - 0.92) * p;
    const y = 20 + (10 - 20) * p;
    const opacity = 0.92 + (1.0 - 0.92) * p;
    return {
      transform: [{ translateY: y }, { scale }],
      opacity,
    };
  });

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

          // Opacity / scale / translateY now all live inside the animated
          // styles (topStyle / card1Style / card2Style). Base only carries
          // layout + z-order so React doesn't have to bake transform
          // values into props that would later conflict with the worklet.
          const baseStyle = {
            position: 'absolute' as const,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10 - idx,
          };

          const animStyle =
            idx === 0 ? topStyle : idx === 1 ? card1Style : card2Style;

          return (
            <Animated.View key={card.id} style={[baseStyle, animStyle]}>
              <DiscoverCard
                user={card}
                dragX={idx === 0 ? tx : undefined}
                isTop={idx === 0}
              />
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
