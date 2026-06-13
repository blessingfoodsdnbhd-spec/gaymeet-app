import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  RefreshControl,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import { Search, Flame, StickyNote, ChevronRight, Pin, PinOff, Trash2, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { TopBar } from '../../components/TopBar';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { NameWithBadge } from '../../components/NameWithBadge';
import { useToast } from '../../components/ToastProvider';
import {
  getConversations,
  pinConversation,
  unpinConversation,
  clearConversation,
  PinLimitError,
  type ChatThread,
} from '../../api/chats';
import { getNotesUnread } from '../../api/notes';
import { UpgradePremiumSheet } from '../../components/UpgradePremiumSheet';
import { useAuth } from '../../store/auth';
import { useChats } from '../../store/chats';
import { on as wsOn } from '../../api/ws';
import type { RootStackParamList } from '../../navigation/types';
import { hhmm, shortTime } from '../../utils/time';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Cheap stable hash → avatar palette index (server doesn't include avatarIdx on chats list).
function idxFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 10;
}

function isFreshMatch(t: ChatThread) {
  if (!t.matchedAt) return false;
  const ageH = (Date.now() - new Date(t.matchedAt).getTime()) / 3_600_000;
  return ageH < 24 && !t.lastMessage;
}

export function ChatsListScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const toast = useToast();
  const [q, setQ] = useState('');
  // Deleting a chat is Premium-only; free users get the upsell (holds the
  // contextual reason string, null = closed).
  const me = useAuth((s) => s.user);
  const isPremium = !!(me as any)?.isPremium;
  const [upsellReason, setUpsellReason] = useState<string | null>(null);

  const setThreads = useChats((s) => s.setThreads);
  const queryClient = useQueryClient();
  const threadsQ = useQuery({
    queryKey: ['chats', 'list'],
    queryFn: getConversations,
    staleTime: 30_000,
  });
  const refetchThreads = threadsQ.refetch;

  // 小纸条 unread count for the inbox-entry badge at the top of the list.
  const notesUnreadQ = useQuery({
    queryKey: ['notes', 'unread'],
    queryFn: getNotesUnread,
    staleTime: 15_000,
  });

  // Re-sync the list every time the Chats tab regains focus (open tab, return
  // from a chat, resume the app). The WS chat:receive listener below keeps the
  // list live WHILE it's on screen, but that depends on the socket being
  // connected — if it dropped (backgrounded, flaky network) the list would
  // show a stale preview that disagrees with the actual newest message inside
  // the chat. A focus refetch pulls the backend's denormalized lastMessage and
  // guarantees the outside preview matches the inside.
  useFocusEffect(
    useCallback(() => {
      refetchThreads();
      notesUnreadQ.refetch();
    }, [refetchThreads, notesUnreadQ.refetch]),
  );

  // Keep the Zustand store in sync with the query result — ChatDetailScreen
  // reads threads from the store to render the header (avatar/name/online)
  // and to map matchId → other userId for the messages endpoint.
  useEffect(() => {
    if (threadsQ.data) setThreads(threadsQ.data);
  }, [threadsQ.data, setThreads]);

  // Real-time: any chat:receive event implies SOME thread's preview /
  // unreadCount / lastMessageAt changed. Invalidate so the list reflects.
  // Important: ChatDetailScreen has its own chat:receive listener but
  // it ignores messages for matches other than the one on screen, so
  // without this listener the list goes stale whenever the user is on
  // the Chats tab and another conversation receives a message.
  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;
    (async () => {
      const u = await wsOn('chat:receive', () => {
        if (!cancelled) {
          queryClient.invalidateQueries({ queryKey: ['chats', 'list'] });
        }
      });
      if (cancelled) {
        u();
        return;
      }
      unsub = u;
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [queryClient]);

  const filtered = useMemo(() => {
    const list = threadsQ.data ?? [];
    if (!q.trim()) return list;
    const lc = q.trim().toLowerCase();
    return list.filter((c) => c.user.nickname?.toLowerCase().includes(lc));
  }, [threadsQ.data, q]);

  const newMatches = useMemo(
    () => (threadsQ.data ?? []).filter(isFreshMatch).slice(0, 12),
    [threadsQ.data],
  );

  const openThread = useCallback(
    (thread: ChatThread) => {
      nav.navigate('ChatDetail', { chatId: thread.matchId });
    },
    [nav],
  );

  // Pin / unpin — personal, max 2. Optimistically reorder the cached list so
  // the row jumps to/from the top instantly, then refetch to reconcile with
  // the server's authoritative pin order.
  const handleTogglePin = useCallback(
    async (thread: ChatThread) => {
      const willPin = !thread.isPinned;
      const data = queryClient.getQueryData<ChatThread[]>(['chats', 'list']) ?? [];
      if (willPin && data.filter((x) => x.isPinned).length >= 2) {
        toast.error(t('chats.swipe.pinLimit'));
        return;
      }
      queryClient.setQueryData<ChatThread[]>(['chats', 'list'], (old) =>
        old ? reorderPinned(old, thread.matchId, willPin) : old,
      );
      try {
        if (willPin) await pinConversation(thread.matchId);
        else await unpinConversation(thread.matchId);
        toast.success(willPin ? t('chats.swipe.pinned') : t('chats.swipe.unpinned'));
      } catch (e) {
        toast.error(
          e instanceof PinLimitError ? t('chats.swipe.pinLimit') : t('chats.swipe.pinFailed'),
        );
      } finally {
        refetchThreads();
      }
    },
    [queryClient, refetchThreads, toast, t],
  );

  // Per-user delete (clears my history only — not a mutual unmatch). Confirm
  // first, then optimistically drop the row and call the backend.
  const handleDelete = useCallback(
    (thread: ChatThread) => {
      // Premium gate: free users can't delete chats — show the upsell instead.
      if (!isPremium) {
        setUpsellReason(t('premium.upsell.deleteChatReason'));
        return;
      }
      Alert.alert(
        t('chats.swipe.deleteTitle'),
        t('chats.swipe.deleteConfirm', { name: thread.user.nickname }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('chats.swipe.delete'),
            style: 'destructive',
            onPress: async () => {
              queryClient.setQueryData<ChatThread[]>(['chats', 'list'], (old) =>
                old ? old.filter((x) => x.matchId !== thread.matchId) : old,
              );
              try {
                await clearConversation(thread.matchId);
                toast.success(t('chats.swipe.deleted'));
              } catch {
                toast.error(t('chats.swipe.deleteFailed'));
                refetchThreads();
              }
            },
          },
        ],
      );
    },
    [queryClient, refetchThreads, toast, t, isPremium],
  );

  // Long-press a row → same actions as the swipe gestures, for discoverability.
  const handleLongPress = useCallback(
    (thread: ChatThread) => {
      Alert.alert(thread.user.nickname, undefined, [
        {
          text: thread.isPinned ? t('chats.swipe.unpin') : t('chats.swipe.pin'),
          onPress: () => handleTogglePin(thread),
        },
        {
          text: t('chats.swipe.delete'),
          style: 'destructive',
          onPress: () => handleDelete(thread),
        },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    },
    [handleTogglePin, handleDelete, t],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <TopBar title={t('tabs.chats')} />

      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.m,
            borderWidth: 1,
            borderColor: theme.colors.line,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <Search size={16} color={theme.colors.muted} strokeWidth={1.6} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={t('chats.searchPlaceholder')}
            placeholderTextColor={theme.colors.muted}
            style={{ flex: 1, fontSize: 14, color: theme.colors.text, padding: 0 }}
          />
        </View>
      </View>

      {threadsQ.isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : threadsQ.isError ? (
        <View style={styles.centerFill}>
          <Text style={{ color: theme.colors.muted, fontSize: 14, marginBottom: 12 }}>
            {t('moments.loadFailed')}
          </Text>
          <Pressable
            onPress={() => threadsQ.refetch()}
            style={{
              paddingHorizontal: 18,
              paddingVertical: 9,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: theme.colors.line,
            }}
          >
            <Text style={{ color: theme.colors.text, fontSize: 13.5 }}>
              {t('common.retry')}
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t) => t.matchId}
          refreshControl={
            <RefreshControl
              refreshing={threadsQ.isRefetching && !threadsQ.isLoading}
              onRefresh={() => threadsQ.refetch()}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
          ListHeaderComponent={
            <>
              <NotesEntry
                unread={notesUnreadQ.data?.count ?? 0}
                onPress={() => nav.navigate('NotesInbox')}
              />
              {newMatches.length > 0 ? (
                <NewMatchesStrip threads={newMatches} onTap={(th) => openThread(th)} />
              ) : null}
            </>
          }
          renderItem={({ item }) => (
            <SwipeableThreadRow
              thread={item}
              onPress={() => openThread(item)}
              onAvatarPress={() => nav.navigate('UserDetail', { userId: item.user.id })}
              onTogglePin={() => handleTogglePin(item)}
              onDelete={() => handleDelete(item)}
              onLongPress={() => handleLongPress(item)}
            />
          )}
          ItemSeparatorComponent={() => (
            <View
              style={{
                height: StyleSheet.hairlineWidth,
                backgroundColor: theme.colors.line,
                marginLeft: 84,
              }}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              emoji="💬"
              title={t('chats.empty')}
              subtitle={t('empty.chats.subtitle')}
              primaryLabel={t('empty.chats.cta')}
              onPrimary={() => nav.navigate('Main', { screen: 'WorldChat' })}
            />
          }
        />
      )}

      {/* Premium upsell — shown when a free user taps ✕ / swipes to delete. */}
      <UpgradePremiumSheet
        open={!!upsellReason}
        onClose={() => setUpsellReason(null)}
        reason={upsellReason ?? undefined}
      />
    </SafeAreaView>
  );
}

function NotesEntry({ unread, onPress }: { unread: number; onPress: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 20,
        paddingVertical: 14,
        backgroundColor: pressed ? theme.colors.surface2 : 'transparent',
      })}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: theme.colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <StickyNote size={24} color={theme.colors.primary} strokeWidth={1.9} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.text }}>
          {t('notes.title')}
        </Text>
        <Text numberOfLines={1} style={{ fontSize: 13, color: theme.colors.text2, marginTop: 4 }}>
          {unread > 0 ? t('notes.unreadSubtitle', { n: unread }) : t('notes.entrySubtitle')}
        </Text>
      </View>
      {unread > 0 ? (
        <View
          style={{
            minWidth: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: theme.colors.accentRose,
            paddingHorizontal: 7,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
            {unread > 99 ? '99+' : unread}
          </Text>
        </View>
      ) : (
        <ChevronRight size={18} color={theme.colors.muted} />
      )}
    </Pressable>
  );
}

function NewMatchesStrip({
  threads,
  onTap,
}: {
  threads: ChatThread[];
  onTap: (t: ChatThread) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View style={{ paddingTop: 8, paddingBottom: 12 }}>
      <Text
        style={{
          fontSize: 12,
          color: theme.colors.muted,
          letterSpacing: 0.72,
          textTransform: 'uppercase',
          paddingHorizontal: 20,
          marginBottom: 10,
        }}
      >
        {t('chats.newMatchesHeader', { n: threads.length })}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
      >
        {threads.map((th) => (
          <Pressable
            key={th.matchId}
            onPress={() => onTap(th)}
            style={{ alignItems: 'center', width: 64 }}
          >
            <Avatar
              name={th.user.nickname}
              uri={th.user.avatarUrl}
              avatarIdx={idxFor(th.user.id)}
              size={58}
              showOnline={th.user.isOnline}
            />
            <NameWithBadge
              name={th.user.nickname}
              official={th.user.isOfficial}
              verified={th.user.isVerified}
              premium={th.user.isPremium}
              numberOfLines={1}
              badgeSize={12}
              textStyle={{
                fontSize: 11,
                color: theme.colors.text,
                marginTop: 6,
                maxWidth: 60,
              }}
            />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/** Optimistic client mirror of the server's pin-first ordering: flip one
 *  thread's pin flag, float pinned threads to the top, and drop a freshly
 *  pinned thread at the very top of the pinned group. */
function reorderPinned(
  list: ChatThread[],
  matchId: string,
  pinned: boolean,
): ChatThread[] {
  const updated = list.map((t) =>
    t.matchId === matchId ? { ...t, isPinned: pinned } : t,
  );
  const pins = updated.filter((t) => t.isPinned);
  const rest = updated.filter((t) => !t.isPinned);
  if (pinned) {
    const i = pins.findIndex((t) => t.matchId === matchId);
    if (i > 0) pins.unshift(...pins.splice(i, 1));
  }
  return [...pins, ...rest];
}

/** A row wrapped in left (pin/unpin) + right (delete) swipe actions. The inner
 *  ThreadRow has an opaque bg so it slides cleanly over the action buttons. */
function SwipeableThreadRow({
  thread,
  onPress,
  onAvatarPress,
  onTogglePin,
  onDelete,
  onLongPress,
}: {
  thread: ChatThread;
  onPress: () => void;
  onAvatarPress: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
  onLongPress: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const ref = useRef<Swipeable>(null);
  const close = () => ref.current?.close();

  return (
    <Swipeable
      ref={ref}
      friction={2}
      leftThreshold={56}
      rightThreshold={56}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={() => (
        <SwipeAction
          label={thread.isPinned ? t('chats.swipe.unpin') : t('chats.swipe.pin')}
          icon={
            thread.isPinned ? (
              <PinOff size={22} color="#FFFFFF" strokeWidth={2} />
            ) : (
              <Pin size={22} color="#FFFFFF" strokeWidth={2} />
            )
          }
          bg={theme.colors.primary}
          onPress={() => {
            close();
            onTogglePin();
          }}
        />
      )}
      renderRightActions={() => (
        <SwipeAction
          label={t('chats.swipe.delete')}
          icon={<Trash2 size={22} color="#FFFFFF" strokeWidth={2} />}
          bg={theme.colors.danger}
          onPress={() => {
            close();
            onDelete();
          }}
        />
      )}
    >
      <ThreadRow
        thread={thread}
        onPress={onPress}
        onAvatarPress={onAvatarPress}
        onLongPress={onLongPress}
        onDelete={onDelete}
      />
    </Swipeable>
  );
}

function SwipeAction({
  label,
  icon,
  bg,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  bg: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 88,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
      }}
    >
      {icon}
      <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function ThreadRow({
  thread,
  onPress,
  onAvatarPress,
  onLongPress,
  onDelete,
}: {
  thread: ChatThread;
  onPress: () => void;
  onAvatarPress: () => void;
  onLongPress?: () => void;
  /** ✕ button — premium-gated delete (parent decides upsell vs confirm). */
  onDelete?: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const time = thread.lastMessageAt
    ? sameDay(thread.lastMessageAt)
      ? hhmm(thread.lastMessageAt)
      : shortTime(thread.lastMessageAt)
    : '';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        gap: 12,
        // Opaque resting bg so the row fully covers the swipe-action buttons
        // behind it; a faint primary tint marks pinned threads.
        backgroundColor: pressed
          ? theme.colors.surface2
          : thread.isPinned
            ? theme.colors.primarySoft
            : theme.colors.bg,
      })}
    >
      {/* Avatar opens the OTHER user's full-screen profile; tapping the rest
          of the row opens the conversation. Nested Pressable captures the
          avatar tap so the row's onPress doesn't also fire. */}
      <Pressable onPress={onAvatarPress} hitSlop={6}>
        <Avatar
          name={thread.user.nickname}
          uri={thread.user.avatarUrl}
          avatarIdx={idxFor(thread.user.id)}
          size={52}
          showOnline={thread.user.isOnline}
        />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <NameWithBadge
            name={thread.user.nickname}
            official={thread.user.isOfficial}
            verified={thread.user.isVerified}
            premium={thread.user.isPremium}
            numberOfLines={1}
            badgeSize={14}
            containerStyle={{ flex: 1 }}
            textStyle={{
              flex: 1,
              fontSize: 15,
              fontWeight: '600',
              color: theme.colors.text,
            }}
          />
          {thread.source === 'match' && (
            <Flame size={13} color={theme.colors.primary} fill={theme.colors.primary} />
          )}
          {thread.isPinned && (
            <Pin size={12} color={theme.colors.primary} fill={theme.colors.primary} strokeWidth={1.6} />
          )}
          <Text style={{ fontSize: 12, color: theme.colors.muted }}>{time}</Text>
        </View>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 13,
            color: theme.colors.text2,
            marginTop: 4,
            fontStyle: thread.lastMessageSystem ? 'italic' : 'normal',
          }}
        >
          {thread.lastMessageSystem ? t('system.match.created') : thread.lastMessage || t('chats.sayHi')}
        </Text>
      </View>
      {thread.unreadCount > 0 && (
        <View
          style={{
            minWidth: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: theme.colors.accentRose,
            paddingHorizontal: 7,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
            {thread.unreadCount > 99 ? '99+' : thread.unreadCount}
          </Text>
        </View>
      )}
      {/* Always-visible ✕ delete button (premium-gated by the parent handler).
          Nested Pressable captures its own tap so the row's onPress doesn't fire. */}
      {onDelete && (
        <Pressable
          onPress={onDelete}
          hitSlop={8}
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.surface2,
          }}
        >
          <X size={16} color={theme.colors.muted} strokeWidth={2} />
        </Pressable>
      )}
    </Pressable>
  );
}

function sameDay(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

const styles = StyleSheet.create({
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
    paddingHorizontal: 28,
  },
});
