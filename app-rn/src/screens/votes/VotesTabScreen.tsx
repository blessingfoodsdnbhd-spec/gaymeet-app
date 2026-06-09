import React from 'react';
import { View, Text, FlatList, Pressable, ScrollView, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { TopBar, IconButton } from '../../components/TopBar';
import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { listVoteEvents, type VoteCategory } from '../../api/votes';
import { VoteEventCard } from './VoteEventCard';
import { VOTE_CATEGORIES } from './voteHelpers';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Filter = 'all' | 'active' | 'ended' | 'mine';
const FILTERS: Filter[] = ['all', 'active', 'ended', 'mine'];

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 13,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: active ? theme.colors.primary : theme.colors.surface,
        borderWidth: 1,
        borderColor: active ? theme.colors.primary : theme.colors.line,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#FFFFFF' : theme.colors.text2 }}>{label}</Text>
    </Pressable>
  );
}

/**
 * Dedicated 投票 tab — contests as a first-class community surface (Apple
 * 4.3(b)). Full-screen vertical feed of large event cards with status +
 * category filters, an empty-state CTA, and a create FAB.
 */
export function VotesTabScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const [filter, setFilter] = React.useState<Filter>('all');
  const [category, setCategory] = React.useState<VoteCategory | null>(null);

  const q = useQuery({
    queryKey: ['votes', 'tab', filter, category],
    queryFn: () =>
      listVoteEvents({
        status: filter === 'mine' ? 'all' : filter,
        scope: filter === 'mine' ? 'mine' : 'all',
        category: category ?? undefined,
        limit: 40,
      }),
    staleTime: 20_000,
  });
  const events = q.data?.events ?? [];

  const filterLabel = (f: Filter) =>
    f === 'mine' ? t('votes.mine') : t(`votes.status.${f}`);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <TopBar
        title={t('tabs.vote')}
        right={
          <IconButton onPress={() => nav.navigate('CreateVote')}>
            <Plus size={18} color={theme.colors.text} strokeWidth={1.6} />
          </IconButton>
        }
      />

      <View style={{ gap: 8, paddingBottom: 4 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {FILTERS.map((f) => (
            <Chip key={f} label={filterLabel(f)} active={filter === f} onPress={() => setFilter(f)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Chip label={t('votes.category.all')} active={category === null} onPress={() => setCategory(null)} />
          {VOTE_CATEGORIES.map((c) => (
            <Chip
              key={c.key}
              label={`${c.emoji} ${t(`votes.category.${c.key}`)}`}
              active={category === c.key}
              onPress={() => setCategory(c.key)}
            />
          ))}
        </ScrollView>
      </View>

      {q.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 96, gap: 8 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={theme.colors.primary} />
          }
          renderItem={({ item }) => (
            <VoteEventCard event={item} onPress={() => nav.navigate('VoteDetail', { eventId: item.id })} />
          )}
          ListEmptyComponent={
            <EmptyState
              emoji="🏆"
              title={t('votes.empty')}
              subtitle={t('empty.votes.subtitle')}
              primaryLabel={t('votes.createFirst')}
              onPrimary={() => nav.navigate('CreateVote')}
            />
          }
        />
      )}

      {/* Create FAB */}
      <Pressable
        onPress={() => nav.navigate('CreateVote')}
        style={({ pressed }) => ({
          position: 'absolute',
          right: 18,
          bottom: 22,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: theme.colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.85 : 1,
          ...theme.shadows.pop,
        })}
        accessibilityLabel={t('votes.createTitle')}
      >
        <Plus size={28} color="#FFFFFF" strokeWidth={2.4} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
  },
  chipRow: { gap: 8, paddingHorizontal: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
