import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { TopBar } from '../../components/TopBar';
import { useTheme } from '../../theme/ThemeProvider';
import { getWorldChatRooms, type WorldChatRoom } from '../../api/worldChat';
import { on as wsOn } from '../../api/ws';
import { subBoardRoomId, plazaRoomName } from '../../utils/plazaIdentity';
import { PlazaHotList } from './PlazaHotList';
import { PlazaChannelList, type ChannelItem } from './PlazaChannelList';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** The five Plaza sections (spec §2). 'hot' is the default landing. */
type PlazaTab = 'hot' | 'match' | 'voice' | 'interest' | 'country';
// Tab → channel `kind` for the room-list navigation.
const TAB_KIND: Record<Exclude<PlazaTab, 'hot'>, 'friend' | 'voice' | 'interest' | 'country'> = {
  match: 'friend',
  voice: 'voice',
  interest: 'interest',
  country: 'country',
};

/**
 * 广场 (Plaza) — Phase 4 three-tier architecture (spec §2–§8). Five FIXED top
 * tabs (🔥 热门 / ❤️ 交友 / 🎤 语音 / 🎮 兴趣 / 🌏 国家) selected by CLICK (no scroll /
 * swipe — §8.1). 热门 is a ranked room list; the other four tabs show their 二级
 * 频道 grid. Tapping a 二级频道 pushes its room list (ChannelRoomsScreen); tapping a
 * room pushes the chat (WorldChatScreen). One drill-down per level, ← back at each.
 */
export function PlazaScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const nav = useNavigation<Nav>();
  const isZh = i18n.language.startsWith('zh');

  const [tab, setTab] = React.useState<PlazaTab>('hot');

  const roomsQ = useQuery({
    queryKey: ['worldChat', 'rooms'],
    queryFn: getWorldChatRooms,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
  const rooms = roomsQ.data?.rooms ?? [];

  useFocusEffect(
    React.useCallback(() => {
      roomsQ.refetch();
    }, []), // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Live online counts pushed over the socket overlay the cached list.
  const [live, setLive] = React.useState<Record<string, number> | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;
    (async () => {
      const u = await wsOn('world-chat:rooms-state', ({ counts }: { counts: Record<string, number> }) => {
        if (!cancelled) setLive(counts);
      });
      if (cancelled) u();
      else unsub = u;
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const countOf = React.useCallback(
    (id: string, fallback = 0) => (live && live[id] != null ? live[id] : fallback),
    [live],
  );
  const nameOf = React.useCallback((r: WorldChatRoom) => plazaRoomName(r, t, isZh), [t, isZh]);

  // Build the 二级频道 grid for a kind. For countries the card count reflects the
  // 总聊天室 (general sub-board), which is where activity actually lives.
  const channelsFor = React.useCallback(
    (kind: 'friend' | 'voice' | 'interest' | 'country'): ChannelItem[] =>
      rooms
        .filter((r) => r.kind === kind)
        .map((r) => ({
          id: r.id,
          flag: r.flag,
          name: nameOf(r),
          onlineCount:
            kind === 'country' ? countOf(subBoardRoomId(r.id, 'general'), 0) : countOf(r.id, r.onlineCount),
        })),
    [rooms, nameOf, countOf],
  );

  const openChannel = (kind: 'friend' | 'voice' | 'interest' | 'country', c: ChannelItem) =>
    nav.navigate('ChannelRooms', { channelId: c.id, title: c.name, kind, flag: c.flag });

  const tabs: { key: PlazaTab; label: string }[] = [
    { key: 'hot', label: t('plaza.tab.hot') },
    { key: 'match', label: t('plaza.tab.match') },
    { key: 'voice', label: t('plaza.tab.voice') },
    { key: 'interest', label: t('plaza.tab.interest') },
    { key: 'country', label: t('plaza.tab.country') },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      {/* Page title — matches every other tab header (h1, left-aligned). */}
      <TopBar title={t('tabs.worldChat')} />

      {/* Top tabs — always visible, click to switch. The row grows to fill the
          screen when the labels fit (even distribution) and scrolls horizontally
          when a locale's labels are too wide to share one line (§8.1). */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabBar, { borderBottomColor: theme.colors.line }]}
        contentContainerStyle={styles.tabBarContent}
      >
        {tabs.map((tb) => {
          const active = tb.key === tab;
          return (
            <Pressable key={tb.key} onPress={() => setTab(tb.key)} style={styles.tab}>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 13,
                  fontWeight: active ? '800' : '600',
                  color: active ? theme.colors.primary : theme.colors.text2,
                }}
              >
                {tb.label}
              </Text>
              <View
                style={[styles.underline, { backgroundColor: active ? theme.colors.primary : 'transparent' }]}
              />
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ flex: 1 }}>
        {tab === 'hot' && <PlazaHotList />}
        {tab !== 'hot' &&
          (roomsQ.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          ) : (
            <PlazaChannelList
              channels={channelsFor(TAB_KIND[tab])}
              onOpen={(c) => openChannel(TAB_KIND[tab], c)}
            />
          ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // flexGrow:0 keeps the scroller hugging its row height instead of filling the column.
  tabBar: { flexGrow: 0, borderBottomWidth: StyleSheet.hairlineWidth },
  // flexGrow:1 spreads the tabs to fill the row when they fit; content overflows → scroll.
  tabBarContent: { flexGrow: 1, paddingHorizontal: 4 },
  tab: { flexGrow: 1, alignItems: 'center', paddingTop: 12, paddingBottom: 0, paddingHorizontal: 10 },
  underline: { height: 3, borderRadius: 2, width: '60%', marginTop: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
