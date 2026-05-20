import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface Props {
  title?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  center?: React.ReactNode; // overrides title when present
}

export function TopBar({ title, left, right, center }: Props) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: theme.spacing.topbarH,
        paddingVertical: theme.spacing.topbarV,
      }}
    >
      <View style={{ minWidth: 38 }}>{left}</View>
      <View style={{ flex: 1, alignItems: center ? 'center' : 'flex-start', paddingLeft: center ? 0 : 4 }}>
        {center
          ? center
          : title && (
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
