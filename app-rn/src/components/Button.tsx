import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeProvider';
import { brandGradient } from '../theme/tokens';

type Variant = 'primary' | 'ghost' | 'soft' | 'dark';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  fullWidth?: boolean;
  small?: boolean;
}

/**
 * Buttons in three flavors, matching the handoff `.btn-*` classes.
 *  - primary: 4-stop brand gradient + coloured shadow
 *  - ghost:   transparent + 1px line
 *  - soft:    primary-soft fill + primary-deep text
 *  - dark:    near-black fill + white text (Apple sign-in)
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  leadingIcon,
  trailingIcon,
  style,
  textStyle,
  fullWidth,
  small,
}: Props) {
  const theme = useTheme();
  const height = small ? theme.layout.ctaHeightSm : theme.layout.ctaHeight;
  const isPrimary = variant === 'primary';

  const baseStyle: ViewStyle = {
    height,
    paddingHorizontal: 22,
    borderRadius: theme.radius.m,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: fullWidth ? '100%' : undefined,
  };

  const labelStyle: TextStyle = {
    fontSize: 15,
    fontWeight: theme.typography.weight.semibold,
    letterSpacing: 0.3,
  };

  if (isPrimary) {
    return (
      <Pressable
        onPress={disabled || loading ? undefined : onPress}
        style={({ pressed }) => [
          baseStyle,
          theme.shadows.cta,
          { opacity: disabled ? 0.5 : pressed ? 0.92 : 1 },
          style,
        ]}
      >
        <LinearGradient
          colors={[...brandGradient.colors] as [string, string, ...string[]]}
          locations={[...brandGradient.locations] as [number, number, ...number[]]}
          start={brandGradient.start}
          end={brandGradient.end}
          style={[StyleSheet.absoluteFillObject, { borderRadius: theme.radius.m }]}
        />
        <Content
          loading={loading}
          leadingIcon={leadingIcon}
          trailingIcon={trailingIcon}
          label={label}
          color="#FFFFFF"
          labelStyle={labelStyle}
          textStyle={textStyle}
        />
      </Pressable>
    );
  }

  const variantStyles: Record<Exclude<Variant, 'primary'>, { bg: string; fg: string; border?: string }> = {
    ghost: { bg: 'transparent', fg: theme.colors.text, border: theme.colors.line },
    soft: { bg: theme.colors.primarySoft, fg: theme.colors.primaryDeep },
    dark: { bg: '#000000', fg: '#FFFFFF' },
  };

  const v = variantStyles[variant];

  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [
        baseStyle,
        {
          backgroundColor: v.bg,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Content
        loading={loading}
        leadingIcon={leadingIcon}
        trailingIcon={trailingIcon}
        label={label}
        color={v.fg}
        labelStyle={labelStyle}
        textStyle={textStyle}
      />
    </Pressable>
  );
}

function Content({
  loading,
  leadingIcon,
  trailingIcon,
  label,
  color,
  labelStyle,
  textStyle,
}: {
  loading?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  label: string;
  color: string;
  labelStyle: TextStyle;
  textStyle?: StyleProp<TextStyle>;
}) {
  if (loading) return <ActivityIndicator color={color} />;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {leadingIcon}
      <Text style={[labelStyle, { color }, textStyle]}>{label}</Text>
      {trailingIcon}
    </View>
  );
}
