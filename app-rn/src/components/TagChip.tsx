import React from 'react';
import { Text, View } from 'react-native';
// Pressable from react-native-gesture-handler, NOT react-native. TagChip renders
// inside the Sheet's RNGH gesture tree (FiltersSheet); on Android, an RN-core
// Pressable there doesn't share RNGH's touch system, so chip taps don't register
// even after the ScrollView was swapped to RNGH (PR BBB). RNGH's Pressable is an
// API-compatible drop-in that participates in the gesture tree, so taps fire on
// Android. Safe app-wide: the root is wrapped in GestureHandlerRootView (App.tsx)
// and each Sheet nests its own, so non-sheet usages (profile, interest editor)
// keep working too.
import { Pressable } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeProvider';
import type { InterestTag } from '../data/interestTags';

interface Props {
  tag: InterestTag;
  selected?: boolean;
  shared?: boolean; // user-card variant: shared with me, use `solid` styling
  onPress?: () => void;
}

/**
 * Used on the InterestTagsPicker, profile, discover card. Combines emoji + zh
 * label in a single pill.
 */
export function TagChip({ tag, selected, shared, onPress }: Props) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  const label = i18n.language?.startsWith('zh') ? tag.zh : tag.en;

  const bg = selected
    ? theme.colors.primary
    : shared
      ? theme.colors.primarySoft
      : theme.colors.surface2;
  const fg = selected
    ? '#FFFFFF'
    : shared
      ? theme.colors.primaryDeep
      : theme.colors.text2;
  const border = selected || shared ? undefined : theme.colors.line;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: theme.radius.pill,
        backgroundColor: bg,
        borderWidth: border ? 1 : 0,
        borderColor: border,
        opacity: pressed && onPress ? 0.85 : 1,
        alignSelf: 'flex-start',
      })}
    >
      <Text style={{ fontSize: 15 }}>{tag.emoji}</Text>
      <Text style={{ fontSize: 14, fontWeight: '500', color: fg }}>{label}</Text>
    </Pressable>
  );
}
