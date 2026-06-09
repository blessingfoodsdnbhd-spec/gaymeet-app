import React from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';

import { useTheme } from '../../theme/ThemeProvider';
import { getAdminStats } from '../../api/admin';

/** Admin analytics dashboard (STATS1) — headline metrics as a card grid. */
export function AdminStatsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<any>();

  const statsQ = useQuery({ queryKey: ['admin', 'stats'], queryFn: getAdminStats });
  const s = statsQ.data;

  const cards: { label: string; value: string | number }[] = s
    ? [
        { label: t('adminStats.totalUsers'), value: s.totalUsers },
        { label: t('adminStats.dau'), value: s.dau },
        { label: t('adminStats.mau'), value: s.mau },
        { label: t('adminStats.signupsToday'), value: s.signupsToday },
        { label: t('adminStats.signups7d'), value: s.signups7d },
        { label: t('adminStats.signups30d'), value: s.signups30d },
        { label: t('adminStats.premium'), value: `${s.premiumCount} (${s.premiumPct}%)` },
        { label: t('adminStats.moments24h'), value: s.moments24h },
        { label: t('adminStats.totalMoments'), value: s.totalMoments },
        { label: t('adminStats.totalVotes'), value: s.totalVotes },
        { label: t('adminStats.totalMatches'), value: s.totalMatches },
      ]
    : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={theme.iconSize.l} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: theme.colors.text }]}>{t('adminStats.title')}</Text>
      </View>

      {statsQ.isLoading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>
      ) : statsQ.isError ? (
        <View style={styles.center}>
          <Text style={{ color: theme.colors.muted }}>{t('adminStats.loadFailed')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={styles.grid}>
            {cards.map((c) => (
              <View key={c.label} style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.line }]}>
                <Text style={{ fontSize: 24, fontWeight: '800', color: theme.colors.text }}>{c.value}</Text>
                <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 4 }}>{c.label}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 16, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: '47.5%', borderRadius: 14, borderWidth: 1, padding: 16 },
});
