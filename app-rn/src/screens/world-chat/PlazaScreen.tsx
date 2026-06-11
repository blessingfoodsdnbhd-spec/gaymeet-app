import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';

import { useTheme } from '../../theme/ThemeProvider';
import { getWorldChatRooms, type WorldChatRoom } from '../../api/worldChat';
import { on as wsOn } from '../../api/ws';
import { WorldChatScreen } from './WorldChatScreen';
import { PlazaTabBar, type PlazaTab } from './PlazaTabBar';
import { PlazaSwitcherSheet, type SwitchRoom } from './PlazaSwitcherSheet';
import { PlazaComingSoon } from './PlazaComingSoon';

/**
 * 广场 tab — a tab controller, not a hub or a landing page. Five section pills
 * (🔥 热门 / ❤️ 交友 / 🎤 语音 / 🎮 兴趣 / 🌏 国家) sit at the top; the selected
 * section's content fills the rest. 热门 is the default so the user lands
 * straight in the busiest room (chat already flowing — no empty World Lobby).
 *
 * Room-backed sections (热门 / 兴趣 / 国家) embed WorldChatScreen and switch rooms
 * via a bottom sheet opened from the current-room pill — the ONLY switch
 * affordance (no drawer, no duplicate navigation). 热门 pins the topic rooms
 * (深夜吹水 / 单身交友 / AI 讨论) first; 兴趣 lists the interest channels. 交友 / 语音
 * are 即将推出 until their subsystems ship (random chat #165, voice Phase 4).
 */
export function PlazaScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();

  const [tab, setTab] = React.useState<PlazaTab>('hot');
  const [hotRoom, setHotRoom] = React.useState<SwitchRoom | null>(null);
  const [countryRoom, setCountryRoom] = React.useState<SwitchRoom | null>(null);
  const [interestRoom, setInterestRoom] = React.useState<SwitchRoom | null>(null);
  const [sheet, setSheet] = React.useState<null | 'hot' | 'country' | 'interest'>(null);

  const roomsQ = useQuery({
    queryKey: ['worldChat', 'rooms'],
    queryFn: getWorldChatRooms,
    staleTime: 10_000,
    refetchInterval: 25_000,
    select: (d) => d.rooms,
  });
  const rooms = roomsQ.data ?? [];

  useFocusEffect(
    React.useCallback(() => {
      roomsQ.refetch();
    }, []), // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Live online counts pushed over the socket overlay the cached list so the
  // pill + sheet counts tick without waiting for the next poll.
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
    (id: string, fallback: number) => (live && live[id] != null ? live[id] : fallback),
    [live],
  );
  const nameOf = React.useCallback(
    // Topic/interest rooms carry an i18nKey → resolve via t() so they localize
    // to all 4 languages; country rooms fall back to their zh/en label.
    (r: WorldChatRoom) =>
      r.i18nKey ? t(r.i18nKey) : i18n.language.startsWith('zh') ? r.label.zh : r.label.en,
    [t, i18n.language],
  );
  const toSwitchRoom = React.useCallback(
    (r: WorldChatRoom): SwitchRoom => ({
      id: r.id,
      flag: r.flag,
      name: nameOf(r),
      onlineCount: countOf(r.id, r.onlineCount),
    }),
    [countOf, nameOf],
  );

  const byOnlineDesc = React.useCallback(
    (a: SwitchRoom, b: SwitchRoom) => b.onlineCount - a.onlineCount,
    [],
  );
  // Backend now tags each room with `kind` ('topic' | 'country' | 'interest').
  // 热门 = topic rooms pinned first (ranked among themselves), then every other
  // room by online count. 国家 = countries only. 兴趣 = interest channels only.
  const hotList = React.useMemo(() => {
    const topics = rooms.filter((r) => r.kind === 'topic').map(toSwitchRoom).sort(byOnlineDesc);
    const rest = rooms.filter((r) => r.kind !== 'topic').map(toSwitchRoom).sort(byOnlineDesc);
    return [...topics, ...rest];
  }, [rooms, toSwitchRoom, byOnlineDesc]);
  const countryList = React.useMemo(
    () =>
      rooms
        .filter((r) => (r.kind ?? 'country') === 'country' && r.id !== 'world')
        .map(toSwitchRoom)
        .sort(byOnlineDesc),
    [rooms, toSwitchRoom, byOnlineDesc],
  );
  const interestList = React.useMemo(
    () => rooms.filter((r) => r.kind === 'interest').map(toSwitchRoom).sort(byOnlineDesc),
    [rooms, toSwitchRoom, byOnlineDesc],
  );

  // Pick a sensible default once rooms load: the #1 hot room (a topic room),
  // busiest country, first interest channel. Only when nothing is selected yet,
  // so we never override the user's choice.
  React.useEffect(() => {
    if (!hotRoom && hotList.length) setHotRoom(hotList[0]);
    if (!countryRoom && countryList.length) setCountryRoom(countryList[0]);
    if (!interestRoom && interestList.length) setInterestRoom(interestList[0]);
  }, [hotList, countryList, interestList, hotRoom, countryRoom, interestRoom]);

  const activeRoom =
    tab === 'hot' ? hotRoom : tab === 'country' ? countryRoom : tab === 'interest' ? interestRoom : null;

  const tabs: { key: PlazaTab; label: string }[] = [
    { key: 'hot', label: t('plaza.tab.hot') },
    { key: 'match', label: t('plaza.tab.match') },
    { key: 'voice', label: t('plaza.tab.voice') },
    { key: 'interest', label: t('plaza.tab.interest') },
    { key: 'country', label: t('plaza.tab.country') },
  ];

  const pill =
    activeRoom != null
      ? {
          label: `${activeRoom.flag} ${activeRoom.name}`,
          count: countOf(activeRoom.id, activeRoom.onlineCount),
          onPress: () => setSheet(tab as 'hot' | 'country' | 'interest'),
        }
      : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <PlazaTabBar tabs={tabs} active={tab} onChange={setTab} pill={pill} />

      <View style={{ flex: 1 }}>
        {(tab === 'hot' || tab === 'country' || tab === 'interest') &&
          (activeRoom ? (
            <WorldChatScreen
              key={`${tab}-${activeRoom.id}`}
              embedded
              roomId={activeRoom.id}
              roomTitle={activeRoom.name}
            />
          ) : tab === 'interest' && roomsQ.isSuccess && interestList.length === 0 ? (
            // Defensive: only if the backend hasn't shipped interest channels yet.
            <PlazaComingSoon icon="🎮" title={t('plaza.interest.title')} desc={t('plaza.interest.desc')} />
          ) : (
            <View style={styles.center}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          ))}

        {tab === 'match' && (
          <PlazaComingSoon icon="❤️" title={t('plaza.match.title')} desc={t('plaza.match.desc')} />
        )}
        {tab === 'voice' && (
          <PlazaComingSoon icon="🎤" title={t('plaza.voice.title')} desc={t('plaza.voice.desc')} />
        )}
      </View>

      <PlazaSwitcherSheet
        open={sheet != null}
        title={
          sheet === 'country'
            ? t('plaza.switcher.country')
            : sheet === 'interest'
              ? t('plaza.interest.title')
              : t('plaza.switcher.hot')
        }
        rooms={sheet === 'country' ? countryList : sheet === 'interest' ? interestList : hotList}
        activeId={sheet === 'country' ? countryRoom?.id : sheet === 'interest' ? interestRoom?.id : hotRoom?.id}
        onSelect={(r) => {
          if (sheet === 'country') setCountryRoom(r);
          else if (sheet === 'interest') setInterestRoom(r);
          else setHotRoom(r);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
