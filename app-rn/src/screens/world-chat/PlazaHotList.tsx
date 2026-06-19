import React from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Flame, ChevronRight, Plus, Lock, Crown } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import {
  getHotWorldChatRooms,
  getMyRooms,
  joinChatRoom,
  type WorldChatRoom,
  type ChatRoomSummary,
} from '../../api/worldChat';
import { DEFAULT_HEX, CARD_TEXT } from '../../utils/roomColors';
import { plazaRoomName } from '../../utils/plazaIdentity';
import { RoomCardShell } from './RoomCardShell';
import { RoomPreviewSheet } from './RoomPreviewSheet';
import { JoinedRoomsSection } from './JoinedRoomsSection';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const isUgcId = (id: string) => /^[a-f0-9]{24}$/i.test(id);

/**
 * 🔥 热门 tab (spec §6): the top 5 rooms across the whole platform ranked by live
 * online count (Top 5), followed by 我开的房间 (the user's own rooms). Refreshes on
 * an interval for a live feel (§6.2). No embedded chat — a pure ranked list that
 * navigates into a room on tap (§8 click navigation).
 */
export function PlazaHotList() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const nav = useNavigation<Nav>();
  const qc = useQueryClient();
  const isZh = i18n.language.startsWith('zh');

  const hotQ = useQuery({
    queryKey: ['worldChat', 'hot', 5],
    queryFn: () => getHotWorldChatRooms(5),
    staleTime: 10_000,
    refetchInterval: 60_000, // §6.2 — refresh hot list every 60s
    select: (d) => d.rooms,
  });
  const mineQ = useQuery({ queryKey: ['worldChat', 'myRooms'], queryFn: getMyRooms, staleTime: 15_000 });

  useFocusEffect(
    React.useCallback(() => {
      hotQ.refetch();
      mineQ.refetch();
    }, []), // eslint-disable-line react-hooks/exhaustive-deps
  );

  const nameOf = (r: WorldChatRoom) => plazaRoomName(r, t, isZh);
  const [preview, setPreview] = React.useState<WorldChatRoom | null>(null);

  // A hot room may be a config room (open directly) or a public UGC room (join
  // frictionlessly first, then enter).
  const openHot = async (r: WorldChatRoom) => {
    if (isUgcId(r.id)) {
      try {
        await joinChatRoom(r.id);
        nav.navigate('WorldChatRoom', { roomId: r.id, title: nameOf(r), custom: true });
      } catch (e: any) {
        Alert.alert(t('worldChat.rooms.joinFailed'), e?.response?.data?.error ?? '');
      }
      return;
    }
    nav.navigate('WorldChatRoom', { roomId: r.id, title: nameOf(r) });
  };

  const openMine = (r: ChatRoomSummary) =>
    nav.navigate('WorldChatRoom', { roomId: r.id, title: r.title, custom: true });

  const hot = hotQ.data ?? [];
  const mine = mineQ.data?.rooms ?? [];

  if (hotQ.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <>
    <FlatList
      data={hot}
      keyExtractor={(r) => r.id}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      ListHeaderComponent={
        <View style={styles.sectionRow}>
          <Flame size={17} color={theme.colors.primary} />
          <Text style={[styles.section, { color: theme.colors.text }]}>{t('plaza.hot.topics')}</Text>
        </View>
      }
      renderItem={({ item, index }) => (
        <Pressable
          onPress={() => openHot(item)}
          onLongPress={() => setPreview(item)}
          delayLongPress={350}
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.line, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Text style={{ fontSize: 16, fontWeight: '800', color: theme.colors.primary, width: 22 }}>{index + 1}</Text>
          <Text style={{ fontSize: 22 }}>{item.flag}</Text>
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 15.5, fontWeight: '700', color: theme.colors.text }}>
            {nameOf(item)}
          </Text>
          <View style={styles.countRow}>
            <View style={[styles.dot, { backgroundColor: theme.colors.online }]} />
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.colors.muted }}>{item.onlineCount}</Text>
          </View>
          <ChevronRight size={18} color={theme.colors.muted} />
        </Pressable>
      )}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      ListEmptyComponent={
        <Text style={{ color: theme.colors.muted, textAlign: 'center', marginVertical: 16 }}>
          {t('worldChat.rooms.ugcEmpty')}
        </Text>
      }
      ListFooterComponent={
        <View style={{ marginTop: 22 }}>
          <View style={styles.sectionRow}>
            <Crown size={16} color={theme.colors.primary} />
            <Text style={[styles.section, { color: theme.colors.text }]}>{t('plaza.hot.myRooms')}</Text>
          </View>
          {mine.length === 0 ? (
            <Text style={{ color: theme.colors.muted, fontSize: 13.5, lineHeight: 20, marginTop: 4 }}>
              {t('plaza.hot.noRooms')}
            </Text>
          ) : (
            mine.map((r) => (
              <RoomCardShell
                key={r.id}
                hex={r.cardColor ?? DEFAULT_HEX}
                onPress={() => openMine(r)}
                style={[styles.card, { borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)', marginTop: 10 }]}
              >
                {r.isPrivate ? <Lock size={17} color={CARD_TEXT} /> : <Crown size={16} color={CARD_TEXT} />}
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: '700', color: CARD_TEXT }}>
                  {r.title}
                </Text>
                <View style={styles.countRow}>
                  <View style={[styles.dot, { backgroundColor: theme.colors.online }]} />
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: 'rgba(0,0,0,0.62)' }}>{r.onlineCount}</Text>
                </View>
                <ChevronRight size={18} color={CARD_TEXT} />
              </RoomCardShell>
            ))
          )}
          {mineQ.data && (
            <Text style={{ color: theme.colors.muted, fontSize: 11.5, marginTop: 12, textAlign: 'center' }}>
              {t('plaza.hot.quota', { used: mine.length, cap: mineQ.data.cap })}
            </Text>
          )}
          {/* ✨ 我在的房间 — joined (subscribed) rooms (Build 102 §C) */}
          <JoinedRoomsSection />
        </View>
      }
    />
    {/* Create FAB — the 我开的房间 empty-state hint ("点右下角『＋』新建一个")
        promises this, but the 热门 tab had no FAB (only the per-channel screens
        did), so creating a room from the hub was a dead end. Hub-created rooms
        hang under the general 世界大厅 ('world') channel. A small leaf Pressable
        with position:absolute — the standard FAB pattern (NOT the vc117
        absolute-fill ROOT trap). */}
    <Pressable
      onPress={() => nav.navigate('CreateRoom', { channelId: 'world', title: t('plaza.worldLobby'), kind: 'country' })}
      style={[styles.fab, { backgroundColor: theme.colors.primary }]}
      accessibilityRole="button"
      accessibilityLabel={t('worldChat.rooms.create')}
    >
      <Plus size={20} color="#FFFFFF" strokeWidth={2.5} />
      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14.5 }}>{t('worldChat.rooms.create')}</Text>
    </Pressable>
    {preview && (
      <RoomPreviewSheet
        roomId={preview.id}
        title={nameOf(preview)}
        onEnter={() => {
          const r = preview;
          setPreview(null);
          openHot(r);
        }}
        onClose={() => setPreview(null)}
      />
    )}
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  section: { fontSize: 16, fontWeight: '800' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
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
