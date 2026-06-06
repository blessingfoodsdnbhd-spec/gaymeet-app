import React from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { brandGradient } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

/** A thin rounded track with a brand-gradient fill clamped to `pct` (0–100). */
export function ProgressBar({ pct, height = 10 }: { pct: number; height?: number }) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: theme.colors.surface2, overflow: 'hidden' }}>
      <LinearGradient
        colors={[...brandGradient.colors] as [string, string, ...string[]]}
        locations={[...brandGradient.locations] as [number, number, ...number[]]}
        start={brandGradient.start}
        end={brandGradient.end}
        style={{ width: `${clamped}%`, height: '100%', borderRadius: height / 2 }}
      />
    </View>
  );
}
