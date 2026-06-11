import React from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import { UserLevelBadge } from '../../components/UserLevelBadge';
import { VerifiedBadge } from '../../components/NameWithBadge';
import { EmptyState } from '../../components/EmptyState';
import { getLeaderboard, type LeaderboardEntry, type LeaderboardPeriod } from '../../api/plaza';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PERIODS: LeaderboardPeriod[] = ['daily', 'weekly', 'all'];

function idxFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 10;
}

/** Medal emoji for the podium, else the plain rank number. */
function rankLabel(rank: number) {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
}

export function LeaderboardScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const [period, setPeriod] = React.useState<LeaderboardPeriod>('weekly');

  const q = useQuery({
    queryKey: ['plaza', 'leaderboard', period],
    queryFn: () => getLeaderboard(period),
    staleTime: 30_000,
  });
  const rows = q.data?.leaderboard ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={{ marginRight: 10 }}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.text }}>
          🏆 {t('plaza.leaderboard.title')}
        </Text>
      </View>

      {/* Period segmented control */}
      <View style={[styles.segment, { backgroundColor: theme.colors.surface2 }]}>
        {PERIODS.map((p) => {
          const active = p === period;
          return (
            <Pressable
              key={p}
              onPress={() => setPeriod(p)}
              style={[styles.segItem, active && { backgroundColor: theme.colors.surface, ...theme.shadows.soft }]}
            >
              <Text style={{ fontSize: 13.5, fontWeight: active ? '700' : '500', color: active ? theme.colors.text : theme.colors.muted }}>
                {t(`plaza.leaderboard.${p}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {q.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : rows.length === 0 ? (
        <EmptyState
          emoji="🏆"
          title={t('plaza.leaderboard.emptyTitle')}
          subtitle={t('plaza.leaderboard.emptySubtitle')}
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.userId}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => <Row item={item} onPress={() => nav.navigate('UserDetail', { userId: item.userId })} />}
        />
      )}
    </SafeAreaView>
  );
}

function Row({ item, onPress }: { item: LeaderboardEntry; onPress: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const top3 = item.rank <= 3;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.colors.surface,
          borderColor: top3 ? theme.colors.primary + '55' : theme.colors.line,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <Text style={{ width: 34, textAlign: 'center', fontSize: top3 ? 20 : 14, fontWeight: '800', color: theme.colors.text2 }}>
        {rankLabel(item.rank)}
      </Text>
      <Avatar name={item.displayName || '?'} uri={item.avatarUrl} avatarIdx={idxFor(item.userId)} size={44} />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text, flexShrink: 1 }}>
            {item.displayName}
          </Text>
          {item.isOfficial && <VerifiedBadge size={13} />}
          <UserLevelBadge level={item.level} />
        </View>
        <Text style={{ fontSize: 12.5, color: theme.colors.muted }}>{t('plaza.leaderboard.xp', { n: item.xp })}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  segment: {
    flexDirection: 'row',
    margin: 16,
    marginBottom: 6,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 9,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
