import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Search as SearchIcon, Trophy, Globe } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import { NameWithBadge } from '../../components/NameWithBadge';
import { EmptyState } from '../../components/EmptyState';
import { search, type SearchType } from '../../api/search';

function idxFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 10;
}

const TABS: { key: Exclude<SearchType, 'all'>; labelKey: string }[] = [
  { key: 'users', labelKey: 'search.tabs.users' },
  { key: 'votes', labelKey: 'search.tabs.votes' },
  { key: 'rooms', labelKey: 'search.tabs.rooms' },
];

/** Unified search (SEARCH1) — one box, three tabs (用户 / 投票 / 房间). */
export function SearchScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<any>();

  const [raw, setRaw] = useState('');
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Exclude<SearchType, 'all'>>('users');

  // Debounce the query 300ms so we don't fire a request per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setQ(raw.trim()), 300);
    return () => clearTimeout(id);
  }, [raw]);

  const resultsQ = useQuery({
    queryKey: ['search', tab, q],
    queryFn: () => search(q, tab),
    enabled: q.length >= 1,
    staleTime: 15_000,
  });

  const list = useMemo(() => {
    const d = resultsQ.data;
    if (!d) return [] as any[];
    return tab === 'users' ? d.users : tab === 'votes' ? d.votes : d.rooms;
  }, [resultsQ.data, tab]);

  const renderRow = ({ item }: { item: any }) => {
    if (tab === 'users') {
      return (
        <Pressable style={styles.row} onPress={() => nav.navigate('UserDetail', { userId: item.id })}>
          <Avatar uri={item.avatarUrl} name={item.nickname} avatarIdx={idxFor(item.id)} size={44} />
          <NameWithBadge
            name={item.nickname}
            official={item.isOfficial}
            verified={item.isVerified}
            textStyle={{ fontSize: 15, fontWeight: '600', color: theme.colors.text }}
            containerStyle={{ flex: 1 }}
          />
        </Pressable>
      );
    }
    if (tab === 'votes') {
      return (
        <Pressable style={styles.row} onPress={() => nav.navigate('VoteDetail', { eventId: item.id })}>
          <View style={[styles.iconTile, { backgroundColor: theme.colors.primarySoft }]}>
            <Trophy size={20} color={theme.colors.primaryDeep} strokeWidth={1.8} />
          </View>
          <Text style={[styles.rowTitle, { color: theme.colors.text }]} numberOfLines={1}>{item.title}</Text>
        </Pressable>
      );
    }
    return (
      <Pressable
        style={styles.row}
        onPress={() => nav.navigate('WorldChatRoom', { roomId: item.id, title: item.title, custom: true })}
      >
        <View style={[styles.iconTile, { backgroundColor: theme.colors.primarySoft }]}>
          <Globe size={20} color={theme.colors.primaryDeep} strokeWidth={1.8} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: theme.colors.text }]} numberOfLines={1}>{item.title}</Text>
          <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>
            {t('worldChat.rooms.memberCount', { n: item.memberCount })}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={theme.iconSize.l} color={theme.colors.text} />
        </Pressable>
        <View style={[styles.searchBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.line }]}>
          <SearchIcon size={16} color={theme.colors.muted} strokeWidth={1.8} />
          <TextInput
            value={raw}
            onChangeText={setRaw}
            autoFocus
            placeholder={t('search.placeholder')}
            placeholderTextColor={theme.colors.muted}
            style={{ flex: 1, fontSize: 15, color: theme.colors.text, padding: 0 }}
            returnKeyType="search"
          />
        </View>
      </View>

      <View style={styles.tabs}>
        {TABS.map((tb) => {
          const active = tab === tb.key;
          return (
            <Pressable
              key={tb.key}
              onPress={() => setTab(tb.key)}
              style={[
                styles.tabPill,
                {
                  backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                  borderColor: active ? theme.colors.primary : theme.colors.line,
                },
              ]}
            >
              <Text style={{ color: active ? '#FFFFFF' : theme.colors.text2, fontSize: 13.5, fontWeight: '600' }}>
                {t(tb.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {q.length < 1 ? (
        <EmptyState emoji="🔍" title={t('search.hintTitle')} subtitle={t('search.hintSubtitle')} />
      ) : resultsQ.isLoading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>
      ) : list.length === 0 ? (
        <EmptyState emoji="🫥" title={t('search.empty', { q })} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(it) => it.id}
          renderItem={renderRow}
          contentContainerStyle={{ paddingVertical: 6 }}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  tabPill: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '600' },
  iconTile: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
