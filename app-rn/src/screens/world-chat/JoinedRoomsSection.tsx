import React from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { Sparkles, Bell, BellOff, X, ChevronRight, Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import {
  getJoinedRooms,
  setRoomNotifications,
  leaveRoomMembership,
  type JoinedRoom,
} from '../../api/worldChat';
import { DEFAULT_HEX, CARD_TEXT } from '../../utils/roomColors';
import { RoomCardShell } from './RoomCardShell';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * ✨ 我在的房间 (Build 102 §C) — rooms the user joined (subscribed to) but does
 * not own. Each row: room name + 人数, an unread badge, a per-room 静音 toggle,
 * and a 离开 button. Subscription count is unlimited. Rendered under 我开的房间
 * in the Plaza 热门 tab; collapses to nothing when the user has no joined rooms.
 */
export function JoinedRoomsSection() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const qc = useQueryClient();

  const joinedQ = useQuery({
    queryKey: ['worldChat', 'joinedRooms'],
    queryFn: getJoinedRooms,
    staleTime: 10_000,
    refetchInterval: 30_000,
    select: (d) => d.rooms,
  });

  useFocusEffect(
    React.useCallback(() => {
      joinedQ.refetch();
    }, []), // eslint-disable-line react-hooks/exhaustive-deps
  );

  const rooms = joinedQ.data ?? [];
  if (!rooms.length) return null;

  const invalidate = () => qc.invalidateQueries({ queryKey: ['worldChat', 'joinedRooms'] });

  const open = (r: JoinedRoom) =>
    nav.navigate('WorldChatRoom', { roomId: r.id, title: r.title, custom: true });

  const toggleMute = async (r: JoinedRoom) => {
    // Optimistic flip; revert on failure.
    qc.setQueryData<{ rooms: JoinedRoom[] }>(['worldChat', 'joinedRooms'], (prev) =>
      prev
        ? { rooms: prev.rooms.map((x) => (x.id === r.id ? { ...x, notificationsEnabled: !x.notificationsEnabled } : x)) }
        : prev,
    );
    try {
      await setRoomNotifications(r.id, !r.notificationsEnabled);
    } catch {
      invalidate();
    }
  };

  const leave = (r: JoinedRoom) => {
    Alert.alert(t('plaza.joined.leaveTitle'), t('plaza.joined.leaveBody', { title: r.title }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('plaza.joined.leave'),
        style: 'destructive',
        onPress: async () => {
          qc.setQueryData<{ rooms: JoinedRoom[] }>(['worldChat', 'joinedRooms'], (prev) =>
            prev ? { rooms: prev.rooms.filter((x) => x.id !== r.id) } : prev,
          );
          try {
            await leaveRoomMembership(r.id);
          } finally {
            invalidate();
          }
        },
      },
    ]);
  };

  return (
    <View style={{ marginTop: 24 }}>
      <View style={styles.sectionRow}>
        <Sparkles size={16} color={theme.colors.primary} />
        <Text style={[styles.section, { color: theme.colors.text }]}>{t('plaza.joined.title')}</Text>
      </View>
      {rooms.map((r) => (
        <RoomCardShell
          key={r.id}
          hex={r.cardColor ?? DEFAULT_HEX}
          onPress={() => open(r)}
          style={[styles.card, { borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)', marginTop: 10 }]}
        >
          {r.isPrivate ? <Lock size={16} color={CARD_TEXT} /> : null}
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: '700', color: CARD_TEXT }}>
            {r.title}
          </Text>
          {r.unread > 0 && (
            <View style={[styles.badge, { backgroundColor: theme.colors.error }]}>
              <Text style={styles.badgeTxt}>{r.unread > 99 ? '99+' : r.unread}</Text>
            </View>
          )}
          <View style={styles.countRow}>
            <View style={[styles.dot, { backgroundColor: theme.colors.online }]} />
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: 'rgba(0,0,0,0.62)' }}>{r.onlineCount}</Text>
          </View>
          <Pressable onPress={() => toggleMute(r)} hitSlop={8} style={styles.iconBtn}>
            {r.notificationsEnabled ? <Bell size={17} color={CARD_TEXT} /> : <BellOff size={17} color="rgba(0,0,0,0.4)" />}
          </Pressable>
          <Pressable onPress={() => leave(r)} hitSlop={8} style={styles.iconBtn}>
            <X size={17} color={CARD_TEXT} />
          </Pressable>
        </RoomCardShell>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  section: { fontSize: 16, fontWeight: '800' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  iconBtn: { padding: 2 },
  badge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
