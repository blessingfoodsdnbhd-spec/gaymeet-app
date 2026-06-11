import React from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Plus, Lock, Hash, Crown } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { getChannelRooms, joinChatRoom, type ChatRoomSummary } from '../../api/worldChat';
import { on as wsOn } from '../../api/ws';
import { subBoardRoomId } from '../../utils/plazaIdentity';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'ChannelRooms'>;

// The 4 fixed country sub-boards (spec §5.1) — system-provided, in display order.
const COUNTRY_SUBS = ['general', 'newcomers', 'social', 'chitchat'] as const;

/**
 * 二级频道 room list (Phase 4 spec §5). A country shows its 4 fixed sub-boards
 * (总聊天室 / 新人报到 / 交友区 / 吹水区) above its user-created rooms; a
 * friend/voice/interest channel shows a single 总聊天室 above its UGC rooms. UGC
 * rooms are ranked by live online count (backend), 总聊天室 / sub-boards pinned on
 * top. The ＋ button creates a room in this channel.
 */
export function ChannelRoomsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const qc = useQueryClient();
  const { channelId, title, kind, flag } = route.params;
  const isCountry = kind === 'country';
  const KEY = React.useMemo(() => ['worldChat', 'channelRooms', channelId], [channelId]);

  // Live online counts for the fixed boards (general/subs or the 总聊天室).
  const [counts, setCounts] = React.useState<Record<string, number>>({});

  const roomsQ = useQuery({
    queryKey: KEY,
    queryFn: () => getChannelRooms(channelId),
    staleTime: 10_000,
    select: (d) => d.rooms,
  });
  const rooms = roomsQ.data ?? [];

  useFocusEffect(
    React.useCallback(() => {
      roomsQ.refetch();
    }, [channelId]), // eslint-disable-line react-hooks/exhaustive-deps
  );

  React.useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;
    (async () => {
      const u = await wsOn('world-chat:rooms-state', ({ counts: c }: { counts: Record<string, number> }) => {
        if (!cancelled) setCounts(c);
      });
      if (cancelled) u();
      else unsub = u;
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  // Fixed boards (pinned, never deletable). For a country: 4 sub-boards. For a
  // friend/voice/interest channel: the single 总聊天室 (roomId = channelId).
  const fixed = React.useMemo(() => {
    if (isCountry) {
      return COUNTRY_SUBS.map((key) => {
        const roomId = subBoardRoomId(channelId, key);
        return {
          roomId,
          name: t(`plaza.country.subchannel.${key}`),
          roomTitle: `${title} · ${t(`plaza.country.subchannel.${key}`)}`,
        };
      });
    }
    return [{ roomId: channelId, name: t('worldChat.rooms.general'), roomTitle: title }];
  }, [isCountry, channelId, title, t]);

  const openRoom = async (room: ChatRoomSummary) => {
    if (room.isMember) {
      nav.navigate('WorldChatRoom', { roomId: room.id, title: room.title, custom: true });
      return;
    }
    try {
      await joinChatRoom(room.id);
      qc.invalidateQueries({ queryKey: KEY });
      nav.navigate('WorldChatRoom', { roomId: room.id, title: room.title, custom: true });
    } catch (e: any) {
      Alert.alert(t('worldChat.rooms.joinFailed'), e?.response?.data?.error ?? '');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={{ marginRight: 10 }}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: '800', color: theme.colors.text }}>
            {flag ? `${flag} ${title}` : title}
          </Text>
          <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>
            {t('worldChat.rooms.roomCount', { n: rooms.length })}
          </Text>
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
          contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
          ListHeaderComponent={
            <View style={{ gap: 10, marginBottom: 6 }}>
              {/* 语音 channels are text rooms until audio infra ships (spec §3.2). */}
              {kind === 'voice' && (
                <View style={[styles.notice, { backgroundColor: theme.colors.surface2 }]}>
                  <Text style={{ fontSize: 12.5, color: theme.colors.text2 }}>{t('plaza.voiceTextNotice')}</Text>
                </View>
              )}
              {fixed.map((b) => (
                <Pressable
                  key={b.roomId}
                  onPress={() => nav.navigate('WorldChatRoom', { roomId: b.roomId, title: b.roomTitle })}
                  style={({ pressed }) => [
                    styles.card,
                    { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary, opacity: pressed ? 0.9 : 1 },
                  ]}
                >
                  <Hash size={20} color={theme.colors.primaryDeep} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15.5, fontWeight: '800', color: theme.colors.primaryDeep }}>{b.name}</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: theme.colors.primaryDeep, opacity: 0.85, marginRight: 4 }}>
                    🟢 {counts[b.roomId] ?? 0}
                  </Text>
                  <ChevronRight size={20} color={theme.colors.primaryDeep} />
                </Pressable>
              ))}
              <Text style={[styles.section, { color: theme.colors.muted }]}>{t('worldChat.rooms.sectionUgc')}</Text>
            </View>
          }
          renderItem={({ item: r }) => (
            <Pressable
              onPress={() => openRoom(r)}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.line, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              {r.isPrivate ? <Lock size={18} color={theme.colors.muted} /> : <Hash size={18} color={theme.colors.muted} />}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 15.5, fontWeight: '700', color: theme.colors.text }}>
                    {r.title}
                  </Text>
                  {r.isCreator && <Crown size={13} color={theme.colors.primary} />}
                  {r.status === 'closed' && (
                    <Text style={{ fontSize: 10.5, color: theme.colors.muted, fontWeight: '700' }}>· {t('worldChat.rooms.closed')}</Text>
                  )}
                </View>
                {!!r.description && (
                  <Text numberOfLines={1} style={{ fontSize: 12.5, color: theme.colors.muted, marginTop: 2 }}>
                    {r.description}
                  </Text>
                )}
                <Text style={{ fontSize: 11.5, color: theme.colors.muted, marginTop: 4 }}>
                  {t('worldChat.rooms.memberCount', { n: r.memberCount })} · 🟢 {r.onlineCount}
                </Text>
              </View>
              <ChevronRight size={20} color={theme.colors.muted} />
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <Text style={{ color: theme.colors.muted, textAlign: 'center', marginTop: 8 }}>
              {t('worldChat.rooms.ugcEmpty')}
            </Text>
          }
        />
      )}

      {/* Create FAB (spec §7) */}
      <Pressable
        onPress={() => nav.navigate('CreateRoom', { channelId, title, kind })}
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
      >
        <Plus size={20} color="#FFFFFF" strokeWidth={2.5} />
        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14.5 }}>{t('worldChat.rooms.create')}</Text>
      </Pressable>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  section: { fontSize: 12, letterSpacing: 0.7, textTransform: 'uppercase', marginTop: 8 },
  notice: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 18,
    height: 50,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
});
