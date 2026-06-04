import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

/** One expanding ring: scales 1 → maxScale while fading baseOpacity → 0, looped. */
function Ring({
  size,
  color,
  delay,
  duration,
  maxScale,
  baseOpacity,
}: {
  size: number;
  color: string;
  delay: number;
  duration: number;
  maxScale: number;
  baseOpacity: number;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Easing.out(Easing.ease) }), -1, false),
    );
    return () => cancelAnimation(p);
  }, [delay, duration, p]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + p.value * (maxScale - 1) }],
    opacity: baseOpacity * (1 - p.value),
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}

/**
 * Staggered radar pulse — N expanding rings looping forever. Renders absolutely-
 * positioned rings, so place it inside a positioned (centered) container. Shared
 * by the full-screen "searching for new friends" overlay and the subtle
 * Boost-active cue on the BoostButton.
 */
export function RadarPulse({
  size,
  color,
  rings = 3,
  stagger = 800,
  duration = 2400,
  maxScale = 2.4,
  baseOpacity = 0.5,
}: {
  size: number;
  color: string;
  rings?: number;
  stagger?: number;
  duration?: number;
  maxScale?: number;
  baseOpacity?: number;
}) {
  return (
    <>
      {Array.from({ length: rings }).map((_, i) => (
        <Ring
          key={i}
          size={size}
          color={color}
          delay={i * stagger}
          duration={duration}
          maxScale={maxScale}
          baseOpacity={baseOpacity}
        />
      ))}
    </>
  );
}
