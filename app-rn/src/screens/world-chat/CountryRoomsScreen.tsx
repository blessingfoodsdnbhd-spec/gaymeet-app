import React from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Plus, Lock, Hash, Crown } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { getCountryRooms, joinChatRoom, type ChatRoomSummary } from '../../api/worldChat';
import { on as wsOn } from '../../api/ws';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'CountryRooms'>;

type Section = { key: string; title: string; data: ChatRoomSummary[] };

export function CountryRoomsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const qc = useQueryClient();
  const { countryCode, title } = route.params;
  const KEY = React.useMemo(() => ['worldChat', 'countryRooms', countryCode], [countryCode]);

  const [online, setOnline] = React.useState<number | null>(null);

  const roomsQ = useQuery({
    queryKey: KEY,
    queryFn: () => getCountryRooms(countryCode),
    staleTime: 10_000,
    select: (d) => d.rooms,
  });
  const rooms = roomsQ.data ?? [];

  useFocusEffect(
    React.useCallback(() => {
      roomsQ.refetch();
    }, [countryCode]), // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Live online count for the country's general room.
  React.useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;
    (async () => {
      const u = await wsOn('world-chat:rooms-state', ({ counts }) => {
        if (!cancelled) setOnline(counts[countryCode] ?? 0);
      });
      if (cancelled) u();
      else unsub = u;
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [countryCode]);

  const sections: Section[] = React.useMemo(() => {
    const mine = rooms.filter((r) => r.isCreator);
    const publicRooms = rooms.filter((r) => !r.isCreator && !r.isPrivate);
    const joined = rooms.filter((r) => !r.isCreator && r.isPrivate);
    return [
      { key: 'mine', title: t('worldChat.rooms.sectionMine'), data: mine },
      { key: 'public', title: t('worldChat.rooms.sectionPublic'), data: publicRooms },
      { key: 'joined', title: t('worldChat.rooms.sectionJoined'), data: joined },
    ].filter((s) => s.data.length);
  }, [rooms, t]);

  const openRoom = async (room: ChatRoomSummary) => {
    if (room.isMember) {
      nav.navigate('WorldChatRoom', { roomId: room.id, title: room.title, custom: true });
      return;
    }
    // Public room you haven't joined yet — frictionless join, then enter.
    try {
      await joinChatRoom(room.id);
      qc.invalidateQueries({ queryKey: KEY });
      nav.navigate('WorldChatRoom', { roomId: room.id, title: room.title, custom: true });
    } catch (e: any) {
      Alert.alert(t('worldChat.rooms.joinFailed'), e?.response?.data?.error ?? '');
    }
  };

  // Flatten sections into a single list with header rows for the FlatList.
  type Listed = { type: 'header'; key: string; label: string } | { type: 'room'; key: string; room: ChatRoomSummary };
  const listData: Listed[] = React.useMemo(() => {
    const out: Listed[] = [];
    for (const s of sections) {
      out.push({ type: 'header', key: `h-${s.key}`, label: s.title });
      for (const r of s.data) out.push({ type: 'room', key: r.id, room: r });
    }
    return out;
  }, [sections]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={{ marginRight: 10 }}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: '800', color: theme.colors.text }}>
            {title}
          </Text>
          <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>
            🟢 {t('worldChat.online', { n: online ?? '—' })}
          </Text>
        </View>
      </View>

      {roomsQ.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(it) => it.key}
          contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
          ListHeaderComponent={
            // The built-in country general room — always present, never deletable.
            <Pressable
              onPress={() => nav.navigate('WorldChatRoom', { roomId: countryCode, title })}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary, opacity: pressed ? 0.9 : 1, marginBottom: 6 },
              ]}
            >
              <Hash size={22} color={theme.colors.primaryDeep} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: theme.colors.primaryDeep }}>
                  {t('worldChat.rooms.general')}
                </Text>
                <Text style={{ fontSize: 12, color: theme.colors.primaryDeep, marginTop: 2, opacity: 0.8 }}>
                  {t('worldChat.rooms.generalDesc')}
                </Text>
              </View>
              <ChevronRight size={20} color={theme.colors.primaryDeep} />
            </Pressable>
          }
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return <Text style={[styles.section, { color: theme.colors.muted }]}>{item.label}</Text>;
            }
            const r = item.room;
            return (
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
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <Text style={{ color: theme.colors.muted, textAlign: 'center', marginTop: 40 }}>
              {t('worldChat.rooms.empty')}
            </Text>
          }
        />
      )}

      {/* Create FAB */}
      <Pressable
        onPress={() => nav.navigate('CreateRoom', { countryCode, title })}
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
  section: { fontSize: 12, letterSpacing: 0.7, textTransform: 'uppercase', marginTop: 16, marginBottom: 10 },
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
