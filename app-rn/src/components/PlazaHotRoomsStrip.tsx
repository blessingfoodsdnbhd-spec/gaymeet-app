import React from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { useTheme } from '../theme/ThemeProvider';
import { getHotWorldChatRooms, type WorldChatRoom } from '../api/worldChat';
import { on as wsOn } from '../api/ws';

export type HotRoomPick = { id: string; title: string };

/**
 * 🔥 热门聊天室 — a horizontal strip of rooms sorted by who's online right now.
 * Tap a chip to switch the World Lobby into that room. The list refreshes on a
 * 30s interval and re-ranks live off the `rooms-state` presence snapshot, so it
 * always shows where the crowd is.
 */
export function PlazaHotRoomsStrip({
  activeRoomId,
  onSelect,
}: {
  activeRoomId: string;
  onSelect: (room: HotRoomPick) => void;
}) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('zh') ? 'zh' : 'en';

  const roomsQ = useQuery({
    queryKey: ['worldChat', 'rooms', 'hot'],
    queryFn: getHotWorldChatRooms,
    staleTime: 25_000,
    refetchInterval: 30_000,
  });

  const [liveCounts, setLiveCounts] = React.useState<Record<string, number>>({});
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
    // World stays the anchor; the rest re-rank live by online count.
    return base.sort((a, b) =>
      a.id === 'world' ? -1 : b.id === 'world' ? 1 : b.onlineCount - a.onlineCount,
    );
  }, [roomsQ.data, liveCounts]);

  if (roomsQ.isLoading) {
    return (
      <View style={{ paddingVertical: 10, paddingHorizontal: 16 }}>
        <ActivityIndicator color={theme.colors.muted} size="small" />
      </View>
    );
  }
  if (!rooms.length) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.line,
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: '800',
          color: theme.colors.text,
          paddingLeft: 16,
          paddingRight: 8,
        }}
        numberOfLines={1}
      >
        {t('plaza.hotRooms')}
      </Text>
      <ScrollView
        horizontal
        style={{ flex: 1 }}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 8, paddingVertical: 10 }}
        keyboardShouldPersistTaps="handled"
      >
        {rooms.map((r) => {
          const active = r.id === activeRoomId;
          const name = r.label[lang] || r.label.en;
          return (
            <Pressable
              key={r.id}
              onPress={() => onSelect({ id: r.id, title: name })}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 999,
                borderWidth: 1,
                backgroundColor: active ? theme.colors.primarySoft : theme.colors.surface,
                borderColor: active ? theme.colors.primary : theme.colors.line,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 15 }}>{r.flag}</Text>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: active ? theme.colors.primaryDeep : theme.colors.text,
                }}
                numberOfLines={1}
              >
                {name}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  paddingLeft: 2,
                }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: r.onlineCount > 0 ? theme.colors.online : theme.colors.muted,
                  }}
                />
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.muted }}>
                  {r.onlineCount}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
