import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import { useTheme } from '../../theme/ThemeProvider';
import { getWorldChatRooms, type WorldChatRoom } from '../../api/worldChat';
import type { RootStackParamList } from '../../navigation/types';
import { on as wsOn } from '../../api/ws';
import { WorldChatScreen } from './WorldChatScreen';
import { PlazaTabBar, type PlazaTab } from './PlazaTabBar';
import { PlazaSwitcherSheet, type SwitchRoom } from './PlazaSwitcherSheet';
import { PlazaComingSoon } from './PlazaComingSoon';
import { PlazaSubChannelPills } from './PlazaSubChannelPills';
import { PlazaVoiceList } from './PlazaVoiceList';

const DEFAULT_SUB = 'general';

/**
 * 广场 tab — a tab controller, not a hub or a landing page. Five section pills
 * (🔥 热门 / ❤️ 交友 / 🎤 语音 / 🎮 兴趣 / 🌏 国家) sit at the top; the selected
 * section's content fills the rest. 热门 is the default so the user lands
 * straight in the busiest room (chat already flowing — no empty World Lobby).
 *
 * - 热门: a pure ranking — the top 5 rooms by live online count across every
 *   type (topics / interest channels / world / country sub-channels). Default
 *   landing is the #1 most active room.
 * - 兴趣: the 6 interest channels, switched via the sheet.
 * - 国家: pick a country, land in its `general` sub-channel; a pill row above
 *   the chat switches between 总聊天室 / 交友区 / 新人区 / 活动区.
 * - 语音: display-only placeholders (Phase 4) — a list with 即将推出 badges.
 * - 交友: 即将推出 until random chat (#165) ships.
 * Rooms switch via a bottom sheet from the current-room pill — the ONLY switch
 * affordance (no drawer, no duplicate navigation).
 */
export function PlazaScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [tab, setTab] = React.useState<PlazaTab>('hot');
  const [hotRoom, setHotRoom] = React.useState<SwitchRoom | null>(null);
  const [countryRoom, setCountryRoom] = React.useState<SwitchRoom | null>(null);
  const [countrySub, setCountrySub] = React.useState<string>(DEFAULT_SUB);
  const [interestRoom, setInterestRoom] = React.useState<SwitchRoom | null>(null);
  const [sheet, setSheet] = React.useState<null | 'hot' | 'country' | 'interest'>(null);

  const roomsQ = useQuery({
    queryKey: ['worldChat', 'rooms'],
    queryFn: getWorldChatRooms,
    staleTime: 10_000,
    refetchInterval: 25_000,
  });
  const rooms = roomsQ.data?.rooms ?? [];
  const voiceRooms = roomsQ.data?.voiceRooms ?? [];
  const subChannels = roomsQ.data?.subChannels ?? [];
  const ugcRooms = roomsQ.data?.ugcRooms ?? [];

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
    // Topic/interest/sub-channel rooms carry an i18nKey → resolve via t() so they
    // localize to all 4 languages; country rooms fall back to their zh/en label.
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

  // UGC topic rooms — always BELOW the official rooms in 热门, sorted by online.
  const ugcList = React.useMemo(
    () =>
      ugcRooms
        .map((r) => ({
          id: r.id,
          flag: r.flag,
          name: r.label.zh, // UGC titles are single-language (label.* all equal)
          onlineCount: countOf(r.id, r.onlineCount),
          by: r.creator?.displayName ? t('plaza.create.createdBy', { name: r.creator.displayName }) : undefined,
        }))
        .sort(byOnlineDesc),
    [ugcRooms, countOf, byOnlineDesc, t],
  );

  // 热门 = official rooms ranked by live online count (top 5), with UGC rooms
  // appended below. Bare country rooms are excluded (you enter a country via its
  // sub-channels, not the bare room); the global 'world' lobby is kept.
  const officialHot = React.useMemo(
    () =>
      rooms
        .filter((r) => !(r.kind === 'country' && r.id !== 'world'))
        .map(toSwitchRoom)
        .sort(byOnlineDesc)
        .slice(0, 5),
    [rooms, toSwitchRoom, byOnlineDesc],
  );
  const hotList = React.useMemo(() => [...officialHot, ...ugcList], [officialHot, ugcList]);
  // 国家 = countries only (the country picker). 兴趣 = interest channels only.
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

  // Pick a sensible default once rooms load: the #1 hot room, busiest country,
  // first interest channel. Only when nothing is selected yet, so we never
  // override the user's choice.
  React.useEffect(() => {
    if (!hotRoom && hotList.length) setHotRoom(hotList[0]);
    if (!countryRoom && countryList.length) setCountryRoom(countryList[0]);
    if (!interestRoom && interestList.length) setInterestRoom(interestList[0]);
  }, [hotList, countryList, interestList, hotRoom, countryRoom, interestRoom]);

  // 国家 tab: the chat room is the selected country's current sub-channel.
  const hasSubChannels = subChannels.length > 0;
  const countrySubRoomId =
    countryRoom && hasSubChannels ? `country:${countryRoom.id.toLowerCase()}:${countrySub}` : null;
  const activeSub = subChannels.find((s) => s.key === countrySub);
  const countryRoomTitle =
    countryRoom && activeSub ? `${countryRoom.name} · ${t(activeSub.i18nKey)}` : countryRoom?.name ?? '';

  const tabs: { key: PlazaTab; label: string }[] = [
    { key: 'hot', label: t('plaza.tab.hot') },
    { key: 'match', label: t('plaza.tab.match') },
    { key: 'voice', label: t('plaza.tab.voice') },
    { key: 'interest', label: t('plaza.tab.interest') },
    { key: 'country', label: t('plaza.tab.country') },
  ];

  // Current-room pill: shown on the room-backed tabs. For 国家 it reflects the
  // active sub-channel's online count; tapping always opens the picker sheet.
  const pillRoom = tab === 'hot' ? hotRoom : tab === 'country' ? countryRoom : tab === 'interest' ? interestRoom : null;
  const pill =
    pillRoom != null
      ? {
          label: `${pillRoom.flag} ${pillRoom.name}`,
          count:
            tab === 'country' && countrySubRoomId
              ? countOf(countrySubRoomId, 0)
              : countOf(pillRoom.id, pillRoom.onlineCount),
          onPress: () => setSheet(tab as 'hot' | 'country' | 'interest'),
        }
      : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <PlazaTabBar tabs={tabs} active={tab} onChange={setTab} pill={pill} />

      <View style={{ flex: 1 }}>
        {tab === 'hot' &&
          (hotRoom ? (
            <WorldChatScreen key={`hot-${hotRoom.id}`} embedded roomId={hotRoom.id} roomTitle={hotRoom.name} />
          ) : (
            <View style={styles.center}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          ))}

        {tab === 'interest' &&
          (interestRoom ? (
            <WorldChatScreen
              key={`interest-${interestRoom.id}`}
              embedded
              roomId={interestRoom.id}
              roomTitle={interestRoom.name}
            />
          ) : roomsQ.isSuccess && interestList.length === 0 ? (
            // Defensive: only if the backend hasn't shipped interest channels yet.
            <PlazaComingSoon icon="🎮" title={t('plaza.interest.title')} desc={t('plaza.interest.desc')} />
          ) : (
            <View style={styles.center}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          ))}

        {tab === 'country' &&
          (countryRoom ? (
            <>
              {hasSubChannels && (
                <PlazaSubChannelPills channels={subChannels} active={countrySub} onChange={setCountrySub} />
              )}
              <WorldChatScreen
                key={`country-${countryRoom.id}-${countrySub}`}
                embedded
                roomId={countrySubRoomId ?? countryRoom.id}
                roomTitle={countryRoomTitle}
              />
            </>
          ) : (
            <View style={styles.center}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          ))}

        {tab === 'match' && (
          <PlazaComingSoon icon="❤️" title={t('plaza.match.title')} desc={t('plaza.match.desc')} />
        )}
        {tab === 'voice' && <PlazaVoiceList rooms={voiceRooms} />}
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
        onCreate={
          sheet === 'hot'
            ? () => {
                setSheet(null);
                nav.navigate('CreateTopicRoom');
              }
            : undefined
        }
        onSelect={(r) => {
          if (sheet === 'country') {
            setCountryRoom(r);
            setCountrySub(DEFAULT_SUB); // new country → reset to its general channel
          } else if (sheet === 'interest') setInterestRoom(r);
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
