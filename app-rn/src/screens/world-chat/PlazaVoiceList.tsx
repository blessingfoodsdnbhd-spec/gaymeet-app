import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Bell, Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../theme/ThemeProvider';

/** A display-only voice room placeholder from GET /world-chat/rooms. */
export interface VoiceRoom {
  id: string;
  emoji: string;
  i18nKey: string;
}

interface Props {
  rooms: VoiceRoom[];
}

/**
 * 🎤 语音 tab body. Voice infra (Phase 4) isn't built, so these rooms aren't
 * joinable — each row shows a 即将推出 badge. Tapping a row arms a local
 * "notify me" (no backend waitlist yet). The list seeds the room names so the
 * section feels alive before the feature ships.
 */
export function PlazaVoiceList({ rooms }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [notified, setNotified] = React.useState<Record<string, boolean>>({});

  return (
    <ScrollView contentContainerStyle={styles.body}>
      {rooms.map((r) => {
        const isNotified = !!notified[r.id];
        return (
          <Pressable
            key={r.id}
            onPress={() => setNotified((m) => ({ ...m, [r.id]: true }))}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.line, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Text style={{ fontSize: 26 }}>{r.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15.5, fontWeight: '700', color: theme.colors.text }}>{t(r.i18nKey)}</Text>
              <View style={[styles.badge, { backgroundColor: theme.colors.primarySoft }]}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: theme.colors.primaryDeep }}>
                  {t('plaza.comingSoon')}
                </Text>
              </View>
            </View>
            {isNotified ? (
              <View style={styles.notified}>
                <Check size={16} color={theme.colors.success} strokeWidth={2.5} />
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.colors.success }}>
                  {t('plaza.notified')}
                </Text>
              </View>
            ) : (
              <View style={styles.notify}>
                <Bell size={15} color={theme.colors.muted} />
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.colors.muted }}>
                  {t('plaza.notifyMe')}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, marginTop: 5 },
  notify: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  notified: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
