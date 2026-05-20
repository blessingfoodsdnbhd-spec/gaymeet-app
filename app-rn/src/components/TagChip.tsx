import React from 'react';
import { Pressable, Text, View } from 'react-native';
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
      <Text style={{ fontSize: 14, fontWeight: '500', color: fg }}>{tag.zh}</Text>
    </Pressable>
  );
}
