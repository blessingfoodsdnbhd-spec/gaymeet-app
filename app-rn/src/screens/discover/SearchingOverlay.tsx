import React from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Avatar } from '../../components/Avatar';
import { RadarPulse } from '../../components/RadarPulse';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuth } from '../../store/auth';

const RING_SIZE = 220;

/**
 * Full-screen "searching for new friends" radar overlay. Shows the user's own
 * avatar centered with three staggered expanding rings pulsing around it.
 * Purely presentational — the parent runs the search and dismisses it.
 */
export function SearchingOverlay({ open }: { open: boolean }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const me = useAuth((s) => s.user);

  return (
    <Modal visible={open} transparent animationType="fade" statusBarTranslucent>
      <View style={[styles.backdrop, { backgroundColor: theme.colors.bg }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {t('discover.searching.title')}
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
          {t('discover.searching.subtitle')}
        </Text>

        <View style={styles.radar}>
          {open && <RadarPulse size={RING_SIZE} color={theme.colors.primary} />}
          <View style={styles.avatarWrap}>
            <Avatar
              name={me?.nickname ?? '?'}
              uri={me?.avatarUrl}
              avatarIdx={0}
              size={96}
              shape="circle"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 14, marginBottom: 48 },
  radar: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
});
