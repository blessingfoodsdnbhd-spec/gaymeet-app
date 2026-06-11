import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import { useTheme } from '../../theme/ThemeProvider';
import { getWorldChatRooms, type WorldChatRoom } from '../../api/worldChat';
import { on as wsOn } from '../../api/ws';
import { WorldChatScreen } from './WorldChatScreen';
import { PlazaTabBar, type PlazaTab } from './PlazaTabBar';
import { PlazaSwitcherSheet, type SwitchRoom } from './PlazaSwitcherSheet';
import { PlazaComingSoon } from './PlazaComingSoon';
import type { RootStackParamList } from '../../navigation/types';

/**
 * 广场 tab — a tab controller, not a hub or a landing page. Five section pills
 * (🔥 热门 / ❤️ 交友 / 🎤 语音 / 🎮 兴趣 / 🌏 国家) sit at the top; the selected
 * section's content fills the rest. 热门 is the default so the user lands
 * straight in the busiest room (chat already flowing — no empty World Lobby).
 *
 * Room-backed sections (热门 / 国家) embed WorldChatScreen and switch rooms via
 * a bottom sheet opened from the current-room pill — the ONLY switch affordance
 * (no drawer, no duplicate navigation). 交友 / 语音 / 兴趣 are 即将推出 until their
 * subsystems ship (random chat #165, voice Phase 4, interest channels #164).
 */
export function PlazaScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [tab, setTab] = React.useState<PlazaTab>('hot');
  const [hotRoom, setHotRoom] = React.useState<SwitchRoom | null>(null);
  const [countryRoom, setCountryRoom] = React.useState<SwitchRoom | null>(null);
  const [sheet, setSheet] = React.useState<null | 'hot' | 'country'>(null);

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
    (r: WorldChatRoom) => (i18n.language.startsWith('zh') ? r.label.zh : r.label.en),
    [i18n.language],
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

  // 热门 = every room by online (World included); 国家 = countries only.
  const hotList = React.useMemo(
    () => [...rooms].sort((a, b) => countOf(b.id, b.onlineCount) - countOf(a.id, a.onlineCount)).map(toSwitchRoom),
    [rooms, countOf, toSwitchRoom],
  );
  const countryList = React.useMemo(() => hotList.filter((r) => r.id !== 'world'), [hotList]);

  // Pick a sensible default once rooms load: the busiest room / country. Only
  // when nothing is selected yet, so we never override the user's choice.
  React.useEffect(() => {
    if (!hotRoom && hotList.length) setHotRoom(hotList[0]);
    if (!countryRoom && countryList.length) setCountryRoom(countryList[0]);
  }, [hotList, countryList, hotRoom, countryRoom]);

  const activeRoom = tab === 'hot' ? hotRoom : tab === 'country' ? countryRoom : null;

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
          onPress: () => setSheet(tab as 'hot' | 'country'),
        }
      : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <PlazaTabBar
        tabs={tabs}
        active={tab}
        onChange={setTab}
        pill={pill}
        onSearch={() => nav.navigate('PlazaSearch')}
      />

      <View style={{ flex: 1 }}>
        {(tab === 'hot' || tab === 'country') &&
          (activeRoom ? (
            <WorldChatScreen
              key={`${tab}-${activeRoom.id}`}
              embedded
              roomId={activeRoom.id}
              roomTitle={activeRoom.name}
            />
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
        {tab === 'interest' && (
          <PlazaComingSoon icon="🎮" title={t('plaza.interest.title')} desc={t('plaza.interest.desc')} />
        )}
      </View>

      <PlazaSwitcherSheet
        open={sheet != null}
        title={sheet === 'country' ? t('plaza.switcher.country') : t('plaza.switcher.hot')}
        rooms={sheet === 'country' ? countryList : hotList}
        activeId={sheet === 'country' ? countryRoom?.id : hotRoom?.id}
        onSelect={(r) => {
          if (sheet === 'country') setCountryRoom(r);
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
