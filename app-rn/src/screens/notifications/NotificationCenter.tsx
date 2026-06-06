import React from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, CheckCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { EmptyState } from '../../components/EmptyState';
import { shortTime } from '../../utils/time';
import { routeFromPushData } from '../../utils/pushRouter';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '../../api/notifications';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const EMOJI: Record<string, string> = {
  match: '🎉',
  note: '📝',
  follow: '➕',
  room_invite: '💬',
  vote_first_vote: '🗳️',
  vote_ending_24h: '⏳',
  vote_ending_1h: '⏰',
  vote_ended: '🏁',
  vote_result: '🏆',
  viewers_digest: '👀',
  wants_you_digest: '💘',
  comeback: '👋',
  invite_redeemed: '🎁',
};

const KEY = ['notifications', 'list'];

export function NotificationCenter() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: KEY,
    queryFn: () => getNotifications(),
    staleTime: 10_000,
    select: (d) => d.notifications,
  });
  const items = q.data ?? [];

  const refreshBadges = () => {
    qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
  };

  const onTap = (n: AppNotification) => {
    if (!n.read) {
      qc.setQueryData<{ notifications: AppNotification[] }>(KEY, (prev) =>
        prev ? { notifications: prev.notifications.map((x) => (x.id === n.id ? { ...x, read: true } : x)) } : prev,
      );
      markNotificationRead(n.id).catch(() => {});
      refreshBadges();
    }
    // The persisted record stores `type` separately from `data`; the router
    // expects it inside the payload.
    routeFromPushData({ ...(n.data || {}), type: n.type });
  };

  const onMarkAll = async () => {
    qc.setQueryData<{ notifications: AppNotification[] }>(KEY, (prev) =>
      prev ? { notifications: prev.notifications.map((x) => ({ ...x, read: true })) } : prev,
    );
    try {
      await markAllNotificationsRead();
    } catch {
      /* best-effort */
    }
    refreshBadges();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={{ marginRight: 10 }}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: theme.colors.text }}>
          {t('notifications.title')}
        </Text>
        {items.some((n) => !n.read) && (
          <Pressable onPress={onMarkAll} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <CheckCheck size={17} color={theme.colors.primary} />
            <Text style={{ color: theme.colors.primary, fontSize: 13, fontWeight: '700' }}>
              {t('notifications.markAllRead')}
            </Text>
          </Pressable>
        )}
      </View>

      {q.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingVertical: 6 }}
          ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.line, marginLeft: 64 }} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onTap(item)}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: item.read ? 'transparent' : theme.colors.primarySoft, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: theme.colors.surface2 }]}>
                <Text style={{ fontSize: 20 }}>{EMOJI[item.type] ?? '🔔'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14.5, fontWeight: '700', color: theme.colors.text }} numberOfLines={1}>
                  {item.title}
                </Text>
                {!!item.body && (
                  <Text style={{ fontSize: 13, color: theme.colors.text2, marginTop: 2 }} numberOfLines={2}>
                    {item.body}
                  </Text>
                )}
                <Text style={{ fontSize: 11, color: theme.colors.muted, marginTop: 3 }}>{shortTime(item.createdAt)}</Text>
              </View>
              {!item.read && <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} />}
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState emoji="🔔" title={t('notifications.empty')} />}
        />
      )}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
});
