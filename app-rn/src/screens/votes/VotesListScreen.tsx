import React from 'react';
import { View, Text, FlatList, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { listVoteEvents, type VoteStatus, type VoteCategory } from '../../api/votes';
import { VoteEventCard } from './VoteEventCard';
import { VOTE_CATEGORIES, categoryEmoji } from './voteHelpers';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STATUSES: (VoteStatus | 'all')[] = ['active', 'ended', 'all'];

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
      <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#FFFFFF' : theme.colors.text2 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function VotesListScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const [status, setStatus] = React.useState<VoteStatus | 'all'>('active');
  const [category, setCategory] = React.useState<VoteCategory | null>(null);
  const [scope, setScope] = React.useState<'all' | 'nearby' | 'following'>('all');

  const q = useQuery({
    queryKey: ['votes', 'list', status, category, scope],
    queryFn: () =>
      listVoteEvents({
        status,
        category: category ?? undefined,
        scope,
        limit: 40,
      }),
    staleTime: 20_000,
  });
  const events = q.data?.events ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ flex: 1, marginLeft: 8, fontSize: 18, fontWeight: '700', color: theme.colors.text }}>
          {t('votes.listTitle')}
        </Text>
        <Pressable onPress={() => nav.navigate('CreateVote')} hitSlop={8}>
          <Plus size={24} color={theme.colors.primary} strokeWidth={2.2} />
        </Pressable>
      </View>

      {/* Filters */}
      <View style={{ paddingTop: 10, gap: 8 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {STATUSES.map((s) => (
            <Chip key={s} label={t(`votes.status.${s}`)} active={status === s} onPress={() => setStatus(s)} />
          ))}
          <View style={{ width: 8 }} />
          {(['all', 'nearby', 'following'] as const).map((s) => (
            <Chip key={s} label={t(`votes.scope.${s}`)} active={scope === s} onPress={() => setScope(s)} />
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
          key="grid2"
          numColumns={2}
          keyExtractor={(e) => e.id}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
          contentContainerStyle={{ paddingTop: 14, paddingBottom: 28, gap: 12 }}
          renderItem={({ item }) => (
            <View style={{ flex: 1 }}>
              <VoteEventCard event={item} onPress={() => nav.navigate('VoteDetail', { eventId: item.id })} />
            </View>
          )}
          ListEmptyComponent={
            <View style={[styles.center, { paddingTop: 60 }]}>
              <Text style={{ color: theme.colors.muted }}>{t('votes.empty')}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chipRow: { gap: 8, paddingHorizontal: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
