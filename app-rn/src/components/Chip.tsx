import React from 'react';
import { Pressable, Text, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type Variant = 'default' | 'solid' | 'rose' | 'inverted';

interface Props {
  label: string;
  variant?: Variant;
  onPress?: () => void;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}

export function Chip({ label, variant = 'default', onPress, selected, style, small }: Props) {
  const theme = useTheme();
  const v = resolve(variant, selected, theme);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          paddingHorizontal: small ? 9 : 11,
          paddingVertical: small ? 4 : 5,
          borderRadius: theme.radius.pill,
          backgroundColor: v.bg,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border,
          opacity: pressed && onPress ? 0.7 : 1,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Text
        style={{
          fontSize: small ? 11.5 : 12.5,
          fontWeight: theme.typography.weight.medium,
          color: v.fg,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function resolve(
  variant: Variant,
  selected: boolean | undefined,
  theme: ReturnType<typeof useTheme>,
) {
  if (selected) {
    return { bg: theme.colors.primary, fg: '#FFFFFF', border: undefined };
  }
  switch (variant) {
    case 'solid':
      return { bg: theme.colors.primarySoft, fg: theme.colors.primaryDeep, border: undefined };
    case 'rose':
      return { bg: theme.colors.accentRoseSoft, fg: '#B14B59', border: undefined };
    case 'inverted':
      return { bg: theme.colors.text, fg: theme.colors.surface, border: undefined };
    default:
      return { bg: theme.colors.surface2, fg: theme.colors.text2, border: theme.colors.line };
  }
}
