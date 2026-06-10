import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface Props {
  title?: string;
  subtitle?: string; // small muted line under the title (e.g. Plaza online count)
  left?: React.ReactNode;
  right?: React.ReactNode;
  center?: React.ReactNode; // overrides title when present
}

export function TopBar({ title, subtitle, left, right, center }: Props) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        // Title-only headers (no left button) sit flush at 16 to align with
        // page content/chip rows; back-button headers keep the 20pt inset.
        paddingLeft: left ? theme.spacing.topbarH : 16,
        paddingRight: theme.spacing.topbarH,
        paddingVertical: theme.spacing.topbarV,
      }}
    >
      <View style={{ minWidth: left ? 38 : 0 }}>{left}</View>
      <View style={{ flex: 1, alignItems: center ? 'center' : 'flex-start', paddingLeft: center || !left ? 0 : 4 }}>
        {center
          ? center
          : (title || subtitle) && (
              <View>
                {title && (
                  <Text
                    style={{
                      fontSize: theme.typography.size.h1,
                      fontWeight: theme.typography.weight.bold,
                      color: theme.colors.text,
                      letterSpacing: -0.4,
                    }}
                  >
                    {title}
                  </Text>
                )}
                {subtitle && (
                  <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>
                    {subtitle}
                  </Text>
                )}
              </View>
            )}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>{right}</View>
    </View>
  );
}

interface IconBtnProps {
  onPress?: () => void;
  children: React.ReactNode;
}

export function IconButton({ onPress, children }: IconBtnProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.line,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}
