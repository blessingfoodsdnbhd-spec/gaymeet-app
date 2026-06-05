import React from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send, ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import { Sheet } from '../../components/Sheet';
import { useAuth } from '../../store/auth';
import {
  getRecentWorldChat,
  sendWorldChat,
  reportWorldChat,
  type WorldChatMessage,
} from '../../api/worldChat';
import { blockUser } from '../../api/safety';
import { openConversation } from '../../api/chats';
import { on as wsOn, emit as wsEmit } from '../../api/ws';
import { shortTime } from '../../utils/time';
import { countryCodeToFlag } from '../../utils/countryFlag';
import { nativePlaceholder } from '../../utils/worldChatRooms';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const BODY_MAX = 500;
const PAGE_SIZE = 50; // matches getRecentWorldChat's default limit

function idxFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 10;
}

type Cache = { messages: WorldChatMessage[] };
type Rt = RouteProp<RootStackParamList, 'WorldChatRoom'>;

/**
 * 世界聊天室 / World Chat — a real-time public room. Reframes Meyou as a
 * community app (Apple 4.3(b)) and ships the UGC moderation Apple 1.2 requires:
 * report + block (long-press), admin delete/ban (backend), and real
 * names/avatars (no anonymous identities).
 */
export function WorldChatScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const qc = useQueryClient();
  const me = useAuth((s) => s.user);
  const myId = me?.id;

  const roomId = route.params?.roomId ?? 'world';
  const roomTitle = route.params?.title ?? t('worldChat.title');
  const KEY = React.useMemo(() => ['worldChat', 'recent', roomId], [roomId]);

  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [online, setOnline] = React.useState<number | null>(null);
  const [loadingOlder, setLoadingOlder] = React.useState(false);
  // Whether older history might still exist. Without this, onEndReached on a
  // short list fires repeatedly and loadOlder loops → the footer spinner never
  // stops. Set false once a page comes back smaller than the page size.
  const [hasMore, setHasMore] = React.useState(true);
  const [selected, setSelected] = React.useState<WorldChatMessage | null>(null);

  const msgsQ = useQuery({
    queryKey: KEY,
    queryFn: () => getRecentWorldChat(roomId),
    staleTime: 15_000,
    select: (d) => d.messages,
  });
  const messages = msgsQ.data ?? []; // newest-first

  // Tell the server which room we're in (broadcasts scope to it). Rejoin the
  // default world room on leave so counts/visibility stay correct.
  React.useEffect(() => {
    wsEmit('world-chat:join-room', { roomId });
    return () => {
      wsEmit('world-chat:join-room', { roomId: 'world' });
    };
  }, [roomId]);

  // If the initial page came back smaller than the page size, there's no older
  // history to fetch — don't let onEndReached spin.
  React.useEffect(() => {
    if (msgsQ.data && msgsQ.data.length < PAGE_SIZE) setHasMore(false);
  }, [msgsQ.data]);

  // WS: live receive / delete / online-count. wsOn is async (awaits connect),
  // so guard teardown with `cancelled` exactly like ChatDetailScreen.
  React.useEffect(() => {
    let cancelled = false;
    let unsubs: Array<() => void> = [];
    (async () => {
      const uRecv = await wsOn('world-chat:receive', (m) => {
        if (cancelled || (m.roomId && m.roomId !== roomId)) return; // other room
        qc.setQueryData<Cache>(KEY, (prev) => {
          const arr = prev?.messages ?? [];
          if (arr.some((x) => x.messageId === m.messageId)) return prev ?? { messages: arr };
          return { messages: [m, ...arr] };
        });
      });
      const uDel = await wsOn('world-chat:message-deleted', ({ messageId }) => {
        if (cancelled) return;
        qc.setQueryData<Cache>(KEY, (prev) =>
          prev ? { messages: prev.messages.filter((x) => x.messageId !== messageId) } : prev,
        );
      });
      const uCount = await wsOn('world-chat:online-count', (evt) => {
        // New server sends { roomId, count }; accept the matching room (or a
        // legacy payload with no roomId).
        if (!cancelled && (!evt.roomId || evt.roomId === roomId)) setOnline(evt.count);
      });
      if (cancelled) { uRecv(); uDel(); uCount(); return; }
      unsubs = [uRecv, uDel, uCount];
    })();
    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [qc, roomId, KEY]);

  const loadOlder = async () => {
    if (loadingOlder || !hasMore || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const oldest = messages[messages.length - 1];
      const { messages: older } = await getRecentWorldChat(roomId, oldest.messageId, PAGE_SIZE);
      if (older.length < PAGE_SIZE) setHasMore(false); // reached the start
      if (older.length) {
        qc.setQueryData<Cache>(KEY, (prev) => {
          const arr = prev?.messages ?? [];
          const seen = new Set(arr.map((x) => x.messageId));
          return { messages: [...arr, ...older.filter((x) => !seen.has(x.messageId))] };
        });
      }
    } catch {
      // best-effort
    } finally {
      setLoadingOlder(false);
    }
  };

  const onSend = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setDraft('');
    try {
      const msg = await sendWorldChat(body, roomId);
      // Add optimistically; the WS echo dedupes by messageId.
      qc.setQueryData<Cache>(KEY, (prev) => {
        const arr = prev?.messages ?? [];
        if (arr.some((x) => x.messageId === msg.messageId)) return prev ?? { messages: arr };
        return { messages: [msg, ...arr] };
      });
    } catch (e: any) {
      setDraft(body); // restore so the user doesn't lose their text
      const status = e?.response?.status;
      if (status === 429) Alert.alert(t('worldChat.rateLimited'));
      else if (status === 403) Alert.alert(t('worldChat.banned'));
      else Alert.alert(t('worldChat.sendFailed'), e?.response?.data?.error ?? '');
    } finally {
      setSending(false);
    }
  };

  const onReport = async (m: WorldChatMessage) => {
    setSelected(null);
    try {
      await reportWorldChat(m.messageId);
      Alert.alert(t('worldChat.reportSent'));
    } catch {
      Alert.alert(t('worldChat.actionFailed'));
    }
  };

  const onBlock = (m: WorldChatMessage) => {
    setSelected(null);
    Alert.alert(t('worldChat.blockConfirmTitle'), t('worldChat.blockConfirmBody', { name: m.displayName }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('worldChat.block'),
        style: 'destructive',
        onPress: async () => {
          try {
            await blockUser(m.userId);
            // Drop their messages from the feed immediately.
            qc.setQueryData<Cache>(KEY, (prev) =>
              prev ? { messages: prev.messages.filter((x) => x.userId !== m.userId) } : prev,
            );
          } catch {
            Alert.alert(t('worldChat.actionFailed'));
          }
        },
      },
    ]);
  };

  const onDM = async (m: WorldChatMessage) => {
    setSelected(null);
    try {
      const res = await openConversation(m.userId);
      qc.invalidateQueries({ queryKey: ['chats', 'list'] });
      nav.navigate('ChatDetail', { chatId: res.matchId });
    } catch (e: any) {
      if (e?.response?.status === 402) nav.navigate('Premium');
      else Alert.alert(t('worldChat.actionFailed'), e?.response?.data?.error ?? '');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.line, flexDirection: 'row', alignItems: 'center' }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={{ marginRight: 10 }}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: '700', color: theme.colors.text }}>
            {roomTitle}
          </Text>
          <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>
            🟢 {t('worldChat.online', { n: online ?? '—' })}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={{ flex: 1 }}
      >
        {msgsQ.isLoading ? (
          <View style={styles.centerFill}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : (
          <FlatList
            data={messages}
            inverted
            keyExtractor={(m) => m.messageId}
            contentContainerStyle={{ paddingVertical: 12, paddingHorizontal: 14, gap: 10 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onEndReached={hasMore ? loadOlder : undefined}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              loadingOlder && hasMore ? (
                <ActivityIndicator color={theme.colors.muted} style={{ marginVertical: 12 }} />
              ) : null
            }
            ListEmptyComponent={
              <View style={[styles.centerFill, { paddingTop: 80 }]}>
                <Text style={{ color: theme.colors.muted }}>{t('worldChat.empty')}</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Row
                msg={item}
                mine={item.userId === myId}
                onLongPress={() => item.userId !== myId && setSelected(item)}
                onOpenUser={() =>
                  item.userId !== myId && nav.navigate('UserDetail', { userId: item.userId })
                }
              />
            )}
          />
        )}

        {/* Composer */}
        <View style={[styles.composer, { backgroundColor: theme.colors.bg, borderTopColor: theme.colors.line }]}>
          <View
            style={{
              flex: 1,
              backgroundColor: theme.colors.surface,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: theme.colors.line,
              paddingHorizontal: 14,
              minHeight: 40,
              justifyContent: 'center',
            }}
          >
            <TextInput
              value={draft}
              onChangeText={(v) => setDraft(v.slice(0, BODY_MAX))}
              placeholder={nativePlaceholder(roomId, i18n.language)}
              placeholderTextColor={theme.colors.muted}
              multiline
              style={{ fontSize: 15, color: theme.colors.text, paddingVertical: 8, maxHeight: 110 }}
            />
          </View>
          {draft.length > 400 && (
            <Text style={{ fontSize: 11, color: theme.colors.muted, alignSelf: 'flex-end', marginBottom: 6 }}>
              {draft.length}/{BODY_MAX}
            </Text>
          )}
          <Pressable
            onPress={onSend}
            disabled={!draft.trim() || sending}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: theme.colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: !draft.trim() || sending ? 0.4 : 1,
            }}
          >
            <Send size={18} color="#FFFFFF" strokeWidth={2} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Long-press action sheet: report / block / DM */}
      <Sheet open={!!selected} onClose={() => setSelected(null)} maxHeight="40%">
        {selected && (
          <>
            <ActionRow label={t('worldChat.report')} onPress={() => onReport(selected)} />
            <ActionRow label={t('worldChat.block')} danger onPress={() => onBlock(selected)} />
            <ActionRow label={t('worldChat.dm')} onPress={() => onDM(selected)} />
            <ActionRow label={t('common.cancel')} centered onPress={() => setSelected(null)} />
          </>
        )}
      </Sheet>
    </SafeAreaView>
  );
}

function Row({
  msg,
  mine,
  onLongPress,
  onOpenUser,
}: {
  msg: WorldChatMessage;
  mine: boolean;
  onLongPress: () => void;
  onOpenUser: () => void;
}) {
  const theme = useTheme();
  // "🇲🇾 吉隆坡 · jacky teh" — location prefix when known, else just the name.
  const loc = [countryCodeToFlag(msg.countryCode), msg.city || ''].filter(Boolean).join(' ');
  const senderLabel = loc ? `${loc} · ${msg.displayName}` : msg.displayName;
  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={300}
      style={{ flexDirection: mine ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-start' }}
    >
      <Pressable onPress={onOpenUser} disabled={mine}>
        <Avatar name={msg.displayName || '?'} uri={msg.avatarUrl} avatarIdx={idxFor(msg.userId)} size={40} />
      </Pressable>
      <View style={{ flex: 1, alignItems: mine ? 'flex-end' : 'flex-start' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          {!mine && (
            <Pressable onPress={onOpenUser}>
              <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: '700', color: theme.colors.text }}>
                {senderLabel}
              </Text>
            </Pressable>
          )}
          <Text style={{ fontSize: 11, color: theme.colors.muted }}>{shortTime(msg.createdAt)}</Text>
        </View>
        <View
          style={{
            maxWidth: '92%',
            backgroundColor: mine ? theme.colors.primary : theme.colors.surface,
            borderWidth: mine ? 0 : 1,
            borderColor: theme.colors.line,
            borderRadius: 16,
            paddingHorizontal: 13,
            paddingVertical: 9,
          }}
        >
          <Text style={{ fontSize: 16, lineHeight: 22, color: mine ? '#FFFFFF' : theme.colors.text }}>
            {msg.body}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function ActionRow({
  label,
  danger,
  centered,
  onPress,
}: {
  label: string;
  danger?: boolean;
  centered?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 15,
        paddingHorizontal: 8,
        alignItems: centered ? 'center' : 'flex-start',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ fontSize: 15, fontWeight: '600', color: danger ? '#D14B4B' : theme.colors.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
