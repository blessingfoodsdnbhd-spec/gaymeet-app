import React from 'react';
import { View, Pressable, Animated, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { gradientFor, isShimmer } from '../../utils/roomColors';

/**
 * Pressable card whose background is a 自建房 unlock color. Solid for most
 * levels; a metallic LinearGradient for Lv19 银 / Lv20 金, with an animated
 * shimmer sweep on Lv20 gold (spec: 金箔渐变 + 闪光动效). Card content (passed as
 * children) keeps black text per the readability rules — the caller styles it.
 */
export function RoomCardShell({
  hex,
  onPress,
  style,
  children,
}: {
  hex: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const grad = gradientFor(hex);
  const shimmer = isShimmer(hex);

  const sweep = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (!shimmer) return;
    const anim = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 2200, useNativeDriver: true }),
    );
    anim.start();
    return () => anim.stop();
  }, [shimmer, sweep]);

  const inner = (
    <>
      {children}
      {shimmer && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.shimmer,
            {
              transform: [
                {
                  translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-160, 320] }),
                },
                { rotate: '18deg' },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)'] as const}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      )}
    </>
  );

  const content = grad ? (
    <LinearGradient
      colors={grad as [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.base, { overflow: 'hidden' }, style]}
    >
      {inner}
    </LinearGradient>
  ) : (
    <View style={[styles.base, { backgroundColor: hex, overflow: 'hidden' }, style]}>{inner}</View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: 16 },
  shimmer: { position: 'absolute', top: -20, bottom: -20, width: 70 },
});
