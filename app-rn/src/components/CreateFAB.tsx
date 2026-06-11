import React from 'react';
import { Pressable } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Unified floating "create" action — a pink circular FAB pinned bottom-right,
 * used across every tab that has an add/create action (投票 / 动态 / …) so the
 * entry point is consistent app-wide (no more top-right "+").
 *
 * Renders inside each screen's `SafeAreaView` (which already sits above the
 * bottom tab bar), so `bottom: 22` clears the tab bar without needing to know
 * its height here.
 */
export function CreateFAB({
  onPress,
  accessibilityLabel,
}: {
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        position: 'absolute',
        right: 18,
        bottom: 22,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.85 : 1,
        ...theme.shadows.pop,
      })}
    >
      <Plus size={28} color="#FFFFFF" strokeWidth={2.4} />
    </Pressable>
  );
}
