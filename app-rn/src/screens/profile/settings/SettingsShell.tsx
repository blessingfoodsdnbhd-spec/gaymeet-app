import React from 'react';
import { View, Text, Pressable, Switch, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { useTheme } from '../../../theme/ThemeProvider';
import { Card } from '../../../components/Card';

export function SettingsShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const nav = useNavigation();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 10,
        }}
      >
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ marginLeft: 8, fontSize: 18, fontWeight: '600', color: theme.colors.text }}>
          {title}
        </Text>
      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 16 }}>{children}</View>
    </SafeAreaView>
  );
}

export function ToggleRow({
  label,
  value,
  onValueChange,
  hint,
  disabled,
  badge,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  hint?: string;
  /** Greys out + disables the switch (e.g. a Premium-gated row for free users). */
  disabled?: boolean;
  /** Small pill shown after the label (e.g. "Premium"). */
  badge?: string;
}) {
  const theme = useTheme();
  return (
    <View style={disabled ? { opacity: 0.55 } : undefined}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 14,
          paddingVertical: 12,
          gap: 8,
        }}
      >
        <Text style={{ fontSize: 15, color: theme.colors.text }}>{label}</Text>
        {badge && (
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 999,
              backgroundColor: theme.colors.primarySoft,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.primaryDeep }}>
              {badge}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ false: theme.colors.line, true: theme.colors.primary }}
          ios_backgroundColor={theme.colors.line}
        />
      </View>
      {hint && (
        <Text
          style={{
            paddingHorizontal: 14,
            paddingBottom: 12,
            fontSize: 12,
            color: theme.colors.muted,
            lineHeight: 17,
          }}
        >
          {hint}
        </Text>
      )}
    </View>
  );
}

export function LinkRow({
  label,
  detail,
  onPress,
  destructive,
}: {
  label: string;
  detail?: string;
  onPress?: () => void;
  destructive?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 14,
        gap: 12,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          flex: 1,
          fontSize: 15,
          color: destructive ? theme.colors.danger : theme.colors.text,
        }}
      >
        {label}
      </Text>
      {detail && (
        <Text style={{ fontSize: 13, color: theme.colors.muted }}>{detail}</Text>
      )}
      <ChevronRight size={16} color={theme.colors.muted} strokeWidth={1.6} />
    </Pressable>
  );
}

export function Divider() {
  const theme = useTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.line,
        marginHorizontal: 14,
      }}
    />
  );
}

export const SettingsCard = Card;
