import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { REACTIONS } from '../../api/moments';

/**
 * Floating FB-style reaction popover: a pill of the 6 emoji that scales in on
 * mount. Positioning is the caller's job — drop it in an absolutely-positioned
 * wrapper above the triggering comment. Tapping an emoji calls `onPick`.
 */
export function ReactionTray({
  onPick,
  onClose,
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 120 }),
      Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  }, [scale, opacity]);

  return (
    <Animated.View
      style={[
        styles.tray,
        theme.shadows.pop,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.line,
          opacity,
          transform: [{ scale }],
        },
      ]}
    >
      {REACTIONS.map((r) => (
        <Pressable
          key={r.emoji}
          onPress={() => {
            onPick(r.emoji);
            onClose();
          }}
          hitSlop={6}
          style={({ pressed }) => [styles.btn, pressed && { transform: [{ scale: 1.25 }] }]}
        >
          <Text style={styles.emoji}>{r.emoji}</Text>
        </Pressable>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tray: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  btn: { paddingHorizontal: 2 },
  emoji: { fontSize: 28 },
});
