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
// How long the new top card takes to settle in from the slot-1 peek pose
// (scale 0.96 → 1.0). Snappier than the fly-off so the deck feels responsive.
const ENTER_DURATION = 190;

export const CardStack = forwardRef<CardStackHandle, Props>(function CardStack(
  { cards, onSwiped },
  ref,
) {
  const top = cards[0];
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  // Entrance progress for the TOP card only: 0 = sitting exactly where the
  // slot-1 peek card sat (scale 0.96, translateY 10), 1 = fully settled as
  // the top card (scale 1.0, translateY 0). It is driven ONLY just after a
  // commit, so the cards BEHIND the top one never read an animating value —
  // they are perfectly static during both the drag AND the fly-off.
  //
  // Why this replaces the old `promote` value (PR #183): #183 froze the
  // behind cards during the drag (good) but still animated them up one slot
  // *during the fly-off* (promote 0→1). On iOS that read as a smooth grow;
  // on Android the per-frame scale change on a card with an elevation shadow
  // jittered, and the user still saw "the second card move" while swiping.
  // Driving the grow off the NEW TOP card instead — after it has been
  // promoted — keeps every behind card bit-for-bit still on every platform,
  // while the little settle-in happens on the card that is now in focus
  // (where growth reads as intentional, not as jitter). It also dodges the
  // promote-reset-vs-deck-shift race, since the behind cards no longer
  // depend on any value that has to be reset across the re-render.
  const enter = useSharedValue(1);

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
      // Hand the entrance to the card that was peeking at slot-1 and is now
      // becoming the new top. Snap `enter` to 0 (the slot-1 pose: scale 0.96,
      // translateY 10) so the new top's first painted frame lines up exactly
      // with where it already sat — no jump — then grow it into the top slot.
      // This runs alongside the deck-advance re-render, but unlike the old
      // `promote` reset it doesn't matter if it lands a frame early/late: the
      // behind cards are static, and the only card reading `enter` (the top)
      // is the one we WANT to animate. So there's no commit-frame race.
      enter.value = 0;
      enter.value = withTiming(1, {
        duration: ENTER_DURATION,
        easing: Easing.bezier(0.2, 0.7, 0.2, 1),
      });
    },
    [top, onSwiped, tx, ty, enter],
  );

  const flyOff = useCallback(
    (liked: boolean) => {
      'worklet';
      const sign = liked ? 1 : -1;
      // The behind cards stay completely still during the fly-off — the grow
      // into the top slot is played on the NEW top card afterwards (see
      // finalize / `enter`). Here we only throw the current top off-screen.
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

  // Top card. Carries the drag (translateX / rotate / a damped translateY)
  // PLUS the entrance: `enter` 0 → 1 grows it from the slot-1 peek pose
  // (scale 0.96, translateY 10) into the full top slot (scale 1.0, y 0). At
  // rest `enter` is 1, so a settled top card is the plain identity transform
  // and the drag math is unchanged from before.
  const topStyle = useAnimatedStyle(() => {
    const e = enter.value;
    const scale = 0.96 + (1.0 - 0.96) * e;
    const baseY = 10 * (1 - e);
    return {
      transform: [
        { translateX: tx.value },
        { translateY: baseY + ty.value * 0.3 },
        { scale },
        { rotate: `${tx.value * 0.06}deg` },
      ],
    };
  });

  // Behind-card styles. These are CONSTANT — they read no shared value, so
  // the worklets evaluate once and the cards never move on any platform,
  // during a drag OR a fly-off. (PR #183 froze them during the drag but still
  // animated them up one slot during the fly-off via `promote`; on Android
  // that per-frame scale change on a shadowed card jittered. The grow now
  // lives on the new top card via `enter` instead — see topStyle.)
  //
  // When the top card flies off and the deck advances, the slot-1 card
  // becomes the new top (its `enter` starts at the slot-1 pose below, so the
  // hand-off is seamless), and the slot-2 card snaps up to slot-1. That snap
  // is a single faint frame on a card that's mostly hidden behind the new
  // top, masked by the fly-off + entrance — not the continuous second-card
  // motion the user was seeing.
  //   idx=1 (behind):   scale 0.96, translateY 10
  //   idx=2 (behind 2): scale 0.92, translateY 20, opacity 0.92
  const card1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: 10 }, { scale: 0.96 }],
  }));

  const card2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: 20 }, { scale: 0.92 }],
    opacity: 0.92,
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
