import React from 'react';
import { Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../theme/ThemeProvider';

/** A country sub-channel definition from GET /world-chat/rooms. */
export interface SubChannel {
  key: string; // 'general' | 'social' | 'newcomers' | 'events'
  emoji: string;
  i18nKey: string;
}

interface Props {
  channels: SubChannel[];
  active: string;
  onChange: (key: string) => void;
}

/**
 * Horizontal row of sub-channel pills shown above the chat on the 🌏 国家 tab.
 * Entering a country lands in `general`; these switch between the country's
 * 总聊天室 / 交友区 / 新人区 / 活动区 sub-channels in place. Sits between the tab
 * bar and the embedded WorldChatScreen.
 */
export function PlazaSubChannelPills({ channels, active, onChange }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={{ flexGrow: 0, borderBottomColor: theme.colors.line, borderBottomWidth: StyleSheet.hairlineWidth }}
    >
      {channels.map((c) => {
        const isActive = c.key === active;
        return (
          <Pressable
            key={c.key}
            onPress={() => onChange(c.key)}
            style={[
              styles.pill,
              { backgroundColor: isActive ? theme.colors.primarySoft : theme.colors.surface2 },
            ]}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: isActive ? '800' : '600',
                color: isActive ? theme.colors.primaryDeep : theme.colors.text2,
              }}
            >
              {c.emoji} {t(c.i18nKey)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  pill: { paddingHorizontal: 12, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
