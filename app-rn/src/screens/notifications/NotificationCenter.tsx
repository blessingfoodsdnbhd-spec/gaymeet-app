import React from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, CheckCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
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
  moment_like: '❤️',
  comment: '💬',
  comment_reply: '💬',
  moment_tag: '🏷️',
  room_invite: '💬',
  vote_first_vote: '🗳️',
  vote_ending_24h: '⏳',
  vote_ending_1h: '⏰',
  vote_ended: '🏁',
  vote_result: '🏆',
  viewers_digest: '👀',
  wants_you_digest: '💘',
  daily_digest: '🔥',
  comeback: '👋',
  invite_redeemed: '🎁',
  // Admin moderation
  verification_submitted: '🪪',
  verification_result: '✅',
  report_submitted: '🚩',
  report_result: '🛡️',
  account_banned: '🚫',
  account_unbanned: '🔓',
  chat_banned: '🔇',
  chat_unbanned: '🔔',
  photo_banned: '📵',
  photo_unbanned: '📸',
};

const KEY = ['notifications', 'list'];

/**
 * Render a notification's title/body from its TYPE + data via i18n, so the text
 * always matches the app language — old records have stale English DB strings
 * (pre-FFF #6) and some backend ZH templates leaked English words ("profile").
 * Types we can fully reconstruct client-side are localized; everything else
 * falls back to the stored title/body. (follow's data carries no name, so it
 * shows a generic localized phrase rather than "{name}".)
 */
function localizeNotif(
  n: AppNotification,
  t: (k: string, o?: Record<string, unknown>) => string,
): { title: string; body: string } {
  const d = n.data || {};
  switch (n.type) {
    case 'follow':
      return { title: t('notifications.follow.title'), body: t('notifications.follow.body') };
    case 'viewers_digest':
      return { title: t('notifications.viewers.title'), body: t('notifications.viewers.body', { count: d.count ?? 0 }) };
    case 'wants_you_digest':
      return { title: t('notifications.wants.title'), body: t('notifications.wants.body', { count: d.count ?? 0 }) };
    default:
      return { title: n.title, body: n.body };
  }
}

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

  // Opening the Notification Center clears the unread tab badge (WeChat/IG
  // style): mark everything read on the server, then refresh the badge query.
  // We deliberately DON'T touch the ['notifications','list'] cache here, so the
  // rows keep their "new" highlight for this visit even though the badge is
  // already gone. Runs once per mount, only when there's actually unread.
  const markedAllRef = React.useRef(false);
  React.useEffect(() => {
    if (markedAllRef.current || q.isLoading) return;
    if (!items.some((n) => !n.read)) return;
    markedAllRef.current = true;
    markAllNotificationsRead()
      .catch(() => {})
      .finally(refreshBadges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.isLoading, items]);

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
              {/* Person-type notifications (follow/match/dm/room_invite) show the
                  sender's avatar when the backend included it; everything else
                  (digests/system) keeps its emoji. Old records without avatar
                  data fall back to the emoji too. */}
              {item.data?.fromUserAvatarUrl || item.data?.fromUserName ? (
                <Avatar
                  name={String(item.data.fromUserName ?? '')}
                  uri={item.data.fromUserAvatarUrl || undefined}
                  avatarIdx={0}
                  size={40}
                />
              ) : (
                <View style={[styles.iconWrap, { backgroundColor: theme.colors.surface2 }]}>
                  <Text style={{ fontSize: 20 }}>{EMOJI[item.type] ?? '🔔'}</Text>
                </View>
              )}
              {(() => {
                const loc = localizeNotif(item, t);
                return (
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14.5, fontWeight: '700', color: theme.colors.text }} numberOfLines={1}>
                      {loc.title}
                    </Text>
                    {!!loc.body && (
                      <Text style={{ fontSize: 13, color: theme.colors.text2, marginTop: 2 }} numberOfLines={2}>
                        {loc.body}
                      </Text>
                    )}
                    <Text style={{ fontSize: 11, color: theme.colors.muted, marginTop: 3 }}>{shortTime(item.createdAt)}</Text>
                  </View>
                );
              })()}
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
