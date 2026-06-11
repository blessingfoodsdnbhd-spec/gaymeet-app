import React from 'react';
import { View, Text, FlatList, Pressable, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, ChevronRight, Trophy } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { TopBar } from '../../components/TopBar';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuth } from '../../store/auth';
import { getWorldChatRooms, type WorldChatRoom } from '../../api/worldChat';
import { getInterestChannels, type InterestChannel } from '../../api/plaza';
import { on as wsOn } from '../../api/ws';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function WorldChatRoomsScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const nav = useNavigation<Nav>();
  const myCountry = useAuth((s) => s.user?.countryCode) ?? null;
  const lang = i18n.language?.startsWith('zh') ? 'zh' : 'en';

  const [search, setSearch] = React.useState('');
  const [liveCounts, setLiveCounts] = React.useState<Record<string, number>>({});

  const roomsQ = useQuery({
    queryKey: ['worldChat', 'rooms'],
    queryFn: getWorldChatRooms,
    staleTime: 20_000,
  });

  // Interest channels (兴趣频道) — themed rooms on the same chat infra. Online
  // counts come from the endpoint (they're not in the rooms-state snapshot), so
  // refetch periodically to keep them fresh.
  const channelsQ = useQuery({
    queryKey: ['plaza', 'channels'],
    queryFn: getInterestChannels,
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
  const channels = channelsQ.data?.channels ?? [];

  const openChannel = (c: InterestChannel) => {
    const name = t(c.i18nKey, c.name);
    nav.navigate('WorldChatRoom', { roomId: c.id, title: `${c.emoji} ${name}` });
  };

  // Live per-room counts via the periodic rooms-state snapshot.
  React.useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;
    (async () => {
      const u = await wsOn('world-chat:rooms-state', ({ counts }) => {
        if (!cancelled) setLiveCounts(counts);
      });
      if (cancelled) u();
      else unsub = u;
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const rooms: WorldChatRoom[] = React.useMemo(() => {
    const base = (roomsQ.data?.rooms ?? []).map((r) => ({
      ...r,
      onlineCount: liveCounts[r.id] ?? r.onlineCount,
    }));
    // Order: World first, then the viewer's own country, then by online count.
    const rank = (r: WorldChatRoom) =>
      r.id === 'world' ? -2 : r.id === myCountry ? -1 : 0;
    const ordered = base.sort((a, b) => rank(a) - rank(b) || b.onlineCount - a.onlineCount);
    if (!search.trim()) return ordered;
    const q = search.trim().toLowerCase();
    return ordered.filter(
      (r) => r.label.en.toLowerCase().includes(q) || r.label.zh.includes(q) || r.label.native.toLowerCase().includes(q) || r.id.toLowerCase().includes(q),
    );
  }, [roomsQ.data, liveCounts, myCountry, search]);

  const totalOnline = React.useMemo(
    () => Object.values(liveCounts).reduce((s, n) => s + n, 0) || (roomsQ.data?.rooms ?? []).reduce((s, r) => s + r.onlineCount, 0),
    [liveCounts, roomsQ.data],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <TopBar
        title={t('tabs.worldChat')}
        subtitle={`🌍 ${t('worldChat.online', { n: totalOnline })}`}
        right={
          <Pressable
            onPress={() => nav.navigate('Leaderboard')}
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconBtn,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.line, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Trophy size={20} color={theme.colors.primary} strokeWidth={2} />
          </Pressable>
        }
      />

      <View style={{ paddingHorizontal: 20, paddingBottom: 6 }}>
        <View style={[styles.searchBar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.line }]}>
          <Search size={16} color={theme.colors.muted} strokeWidth={1.8} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('worldChat.rooms.search')}
            placeholderTextColor={theme.colors.muted}
            style={{ flex: 1, fontSize: 14, color: theme.colors.text, padding: 0 }}
          />
        </View>
      </View>

      {roomsQ.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 28 }}
          ListHeaderComponent={
            <View>
              {/* Interest channels — hidden while searching to keep country results focused. */}
              {!search.trim() && channels.length > 0 && (
                <>
                  <Text style={[styles.section, { color: theme.colors.muted }]}>{t('plaza.channels.title')}</Text>
                  <View style={styles.channelGrid}>
                    {channels.map((c) => {
                      const name = t(c.i18nKey, c.name);
                      return (
                        <Pressable
                          key={c.id}
                          onPress={() => openChannel(c)}
                          style={({ pressed }) => [
                            styles.channelCard,
                            { backgroundColor: theme.colors.surface, borderColor: theme.colors.line, opacity: pressed ? 0.9 : 1 },
                          ]}
                        >
                          <Text style={{ fontSize: 24 }}>{c.emoji}</Text>
                          <View style={{ flex: 1 }}>
                            <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: theme.colors.text }}>
                              {name}
                            </Text>
                            <Text style={{ fontSize: 11.5, color: theme.colors.online, marginTop: 2, fontWeight: '600' }}>
                              🟢 {c.onlineCount}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
              <Text style={[styles.section, { color: theme.colors.muted }]}>{t('worldChat.rooms.sectionGlobal')}</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => {
            const primary = item.label[lang];
            const showNative = item.label.native && item.label.native !== primary;
            return (
              <Pressable
                onPress={() => nav.navigate('CountryRooms', { countryCode: item.id, title: `${item.flag} ${primary}` })}
                style={({ pressed }) => [
                  styles.card,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.line, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <Text style={{ fontSize: 34 }}>{item.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text }}>{primary}</Text>
                  {showNative ? (
                    <Text style={{ fontSize: 12.5, color: theme.colors.muted, marginTop: 1 }}>{item.label.native}</Text>
                  ) : null}
                  <Text style={{ fontSize: 12, color: theme.colors.online, marginTop: 4, fontWeight: '600' }}>
                    🟢 {t('worldChat.online', { n: item.onlineCount })}
                  </Text>
                </View>
                <ChevronRight size={20} color={theme.colors.muted} />
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={{ color: theme.colors.muted, textAlign: 'center', marginTop: 40 }}>{t('worldChat.rooms.noResults')}</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  section: { fontSize: 12, letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 12, marginTop: 6 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  channelCard: {
    width: '47.5%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
