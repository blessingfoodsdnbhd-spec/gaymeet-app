import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';

interface Props {
  icon: string;
  title: string;
  desc: string;
}

/**
 * Inline 即将推出 view for Plaza sections whose subsystems haven't shipped yet
 * (❤️ random chat #165, 🎮 interest channels #164, 🎤 voice rooms Phase 4).
 * Lives inside the tab body — the tab bar stays visible above it. The notify-me
 * CTA is local-only; a real waitlist is deferred until those features land.
 */
export function PlazaComingSoon({ icon, title, desc }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [notified, setNotified] = React.useState(false);

  return (
    <View style={styles.body}>
      <Text style={{ fontSize: 64 }}>{icon}</Text>
      <View style={[styles.badge, { backgroundColor: theme.colors.primarySoft }]}>
        <Text style={{ fontSize: 12.5, fontWeight: '800', color: theme.colors.primaryDeep }}>
          {t('plaza.comingSoon')}
        </Text>
      </View>
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      <Text style={[styles.desc, { color: theme.colors.muted }]}>{desc}</Text>

      <View style={{ height: 28 }} />

      {notified ? (
        <View style={styles.notified}>
          <Check size={18} color={theme.colors.success} strokeWidth={2.5} />
          <Text style={{ fontSize: 14.5, fontWeight: '700', color: theme.colors.success }}>
            {t('plaza.notified')}
          </Text>
        </View>
      ) : (
        <Button
          label={t('plaza.notifyMe')}
          variant="primary"
          onPress={() => setNotified(true)}
          style={{ minWidth: 220 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 40 },
  badge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginTop: 18, marginBottom: 14 },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  desc: { fontSize: 14.5, lineHeight: 21, textAlign: 'center', marginTop: 10 },
  notified: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
