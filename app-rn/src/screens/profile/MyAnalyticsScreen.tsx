import React from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Eye, Heart, Flame, TrendingUp, Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';

import { useTheme } from '../../theme/ThemeProvider';
import { getMyAnalytics } from '../../api/me';

/** Per-user analytics dashboard ("我的数据" / My Data) — STATS for the self. */
export function MyAnalyticsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<any>();
  const c = theme.colors;

  const q = useQuery({ queryKey: ['me', 'analytics'], queryFn: getMyAnalytics });
  const a = q.data;

  const Header = (
    <View style={[styles.header, { borderBottomColor: c.line }]}>
      <Pressable onPress={() => nav.goBack()} hitSlop={8}>
        <ChevronLeft size={theme.iconSize.l} color={c.text} />
      </Pressable>
      <Text style={[styles.title, { color: c.text }]}>{t('myData.title')}</Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      {Header}
      {q.isLoading || !a ? (
        <View style={styles.center}><ActivityIndicator color={c.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          {/* Streak */}
          <Card>
            <Row icon={<Flame size={20} color={c.warning} strokeWidth={2} />} label={t('myData.streak')} />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
              <Metric value={a.streak.current} label={t('myData.streakCurrent')} />
              <Metric value={a.streak.longest} label={t('myData.streakLongest')} />
            </View>
          </Card>

          {/* Profile views */}
          <Card>
            <Row icon={<Eye size={20} color={c.info} strokeWidth={2} />} label={t('myData.views')} />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
              <Metric value={a.profileViews.uniqueViewers} label={t('myData.viewsUnique')} />
              <Metric value={a.profileViews.last7d} label={t('myData.last7d')} locked={!a.premium} />
              <Metric value={a.profileViews.last30d} label={t('myData.last30d')} locked={!a.premium} />
            </View>
          </Card>

          {/* Likes received */}
          <Card>
            <Row icon={<Heart size={20} color={c.primary} strokeWidth={2} />} label={t('myData.likes')} />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
              <Metric value={a.likesReceived.total} label={t('myData.likesTotal')} />
              <Metric value={a.likesReceived.last7d} label={t('myData.last7d')} locked={!a.premium} />
              <Metric value={a.likesReceived.last30d} label={t('myData.last30d')} locked={!a.premium} />
            </View>
          </Card>

          {/* Popularity */}
          <Card>
            <Row icon={<TrendingUp size={20} color={c.success} strokeWidth={2} />} label={t('myData.popularity')} />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
              <Metric value={a.popularity.score} label={t('myData.popularityScore')} />
              <Metric
                value={a.popularity.percentileRank != null ? t('myData.topPct', { pct: 100 - a.popularity.percentileRank }) : null}
                label={t('myData.popularityRank')}
                locked={!a.premium}
                isText
              />
            </View>
          </Card>

          {!a.premium && (
            <Pressable
              onPress={() => nav.navigate('Premium')}
              style={({ pressed }) => [styles.upsell, { backgroundColor: c.primarySoft, opacity: pressed ? 0.85 : 1 }]}
            >
              <Lock size={16} color={c.primaryDeep} strokeWidth={2} />
              <Text style={{ flex: 1, fontSize: 13.5, color: c.primaryDeep, fontWeight: '600' }}>
                {t('myData.upsell')}
              </Text>
            </Pressable>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );

  function Card({ children }: { children: React.ReactNode }) {
    return (
      <View style={{ backgroundColor: c.surface, borderRadius: theme.radius.l, borderWidth: 1, borderColor: c.line, padding: 16 }}>
        {children}
      </View>
    );
  }
  function Row({ icon, label }: { icon: React.ReactNode; label: string }) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {icon}
        <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>{label}</Text>
      </View>
    );
  }
  function Metric({ value, label, locked, isText }: { value: number | string | null; label: string; locked?: boolean; isText?: boolean }) {
    const show = locked ? '—' : value == null ? '—' : isText ? String(value) : String(value);
    return (
      <View style={{ flex: 1 }}>
        {locked ? (
          <Lock size={18} color={c.muted} strokeWidth={2} />
        ) : (
          <Text style={{ fontSize: isText ? 18 : 22, fontWeight: '800', color: c.text }}>{show}</Text>
        )}
        <Text style={{ fontSize: 11.5, color: c.muted, marginTop: 4 }}>{label}</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 16, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  upsell: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, padding: 14 },
});
