import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Lock, Check } from 'lucide-react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { PALETTE, gradientFor, isUnlocked } from '../../utils/roomColors';

/**
 * 自建房颜色选择器 (room card color picker). Shows the full Lv1–Lv20 palette;
 * colors the user has UNLOCKED (level ≥ the color's level) are selectable, locked
 * ones are greyed out with a 🔒 + their required level. The metallic 银/金 tiers
 * render as gradients. Each room picks independently, so this is per-room.
 */
export function RoomColorPicker({
  userLevel,
  value,
  onChange,
}: {
  userLevel: number;
  value: string;
  onChange: (hex: string) => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.grid}>
      {PALETTE.map((c) => {
        const unlocked = isUnlocked(c.hex, userLevel);
        const selected = value.toUpperCase() === c.hex.toUpperCase();
        const grad = gradientFor(c.hex);
        return (
          <Pressable
            key={c.hex}
            disabled={!unlocked}
            onPress={() => onChange(c.hex)}
            style={styles.cell}
          >
            <View
              style={[
                styles.swatch,
                {
                  borderColor: selected ? theme.colors.primary : theme.colors.line,
                  borderWidth: selected ? 3 : 1,
                  opacity: unlocked ? 1 : 0.35,
                },
              ]}
            >
              {grad ? (
                <LinearGradient colors={grad as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill} />
              ) : (
                <View style={[styles.fill, { backgroundColor: c.hex }]} />
              )}
              {selected && unlocked && (
                <View style={styles.center}>
                  <Check size={18} color="#000000" strokeWidth={3} />
                </View>
              )}
              {!unlocked && (
                <View style={styles.center}>
                  <Lock size={14} color="#000000" />
                </View>
              )}
            </View>
            <Text style={{ fontSize: 10, fontWeight: '700', color: unlocked ? theme.colors.muted : theme.colors.muted, marginTop: 3 }}>
              {unlocked ? `Lv${c.level}` : `🔒Lv${c.level}`}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { alignItems: 'center', width: 44 },
  swatch: { width: 44, height: 44, borderRadius: 999, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  fill: { ...StyleSheet.absoluteFillObject },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
