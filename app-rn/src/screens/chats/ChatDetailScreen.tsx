import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  MoreHorizontal,
  Send,
  Smile,
} from 'lucide-react-native';
import { showSafetyMenu } from '../../utils/safetyMenu';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import { Bubble } from '../../components/Bubble';
import { useAuth } from '../../store/auth';
import { useChats } from '../../store/chats';
import { deleteConversation, getMessages, sendMessage, type Message, type ChatThread } from '../../api/chats';
import { on as wsOn, emit as wsEmit, type WsChatReceive, type WsChatTyping } from '../../api/ws';
import type { RootStackParamList } from '../../navigation/types';
import { hhmm } from '../../utils/time';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'ChatDetail'>;

function idxFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 10;
}

const STICKERS = ['😊', '😂', '🥰', '😘', '😎', '🤔', '😅', '🙃', '😴', '🥺', '🤍', '✨', '🌸', '☕', '🌆', '🎬'];

export function ChatDetailScreen() {
  const theme = useTheme();
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const queryClient = useQueryClient();
  const me = useAuth((s) => s.user);

  const matchId = route.params.chatId; // route param is named chatId but holds matchId
  const thread: ChatThread | undefined = useChats((s) =>
    s.threads.find((t) => t.matchId === matchId),
  );
  const setFocus = useChats((s) => s.setFocus);
  const markRead = useChats((s) => s.markRead);
  const typingMap = useChats((s) => s.typing);
  const otherTyping = !!typingMap[matchId];

  const [composing, setComposing] = useState('');
  const [showStickers, setShowStickers] = useState(false);
  const listRef = useRef<FlatList<ListItem>>(null);
  const setTyping = useChats((s) => s.setTyping);
  // Typing emit debouncer state — tracks the last "I'm typing" we sent so we
  // don't spam the socket on every keystroke.
  const typingStateRef = useRef<{ isTyping: boolean; clearAt: number | null }>({
    isTyping: false,
    clearAt: null,
  });

  useEffect(() => {
    setFocus(matchId);
    markRead(matchId);
    return () => setFocus(null);
  }, [matchId, setFocus, markRead]);

  // The conversations API addresses messages by the OTHER user's id, not the
  // matchId. Without the thread loaded we don't know who that is — wait for
  // the chats list to populate before firing the messages query (otherwise
  // we'd hit /conversations/<matchId>/messages and always get [] back).
  const otherId = thread?.user.id;

  // Note: queryKey is 3-tuple — every setQueryData below writes to this same
  // key. Including otherId in the key (it used to be 4-tuple) caused all
  // optimistic + WS-received updates to land in a phantom cache slot,
  // freezing the chat until refetch.
  const msgsQ = useQuery({
    queryKey: ['chats', 'messages', matchId],
    queryFn: () => getMessages(otherId!),
    enabled: !!otherId,
  });

  // Subscribe to WS events for this match (message + typing)
  useEffect(() => {
    let unsubRecv: (() => void) | null = null;
    let unsubTyping: (() => void) | null = null;
    let cancelled = false;

    wsOn('chat:receive', (msg: WsChatReceive) => {
      if (cancelled || msg.matchId !== matchId) return;
      queryClient.setQueryData<Message[]>(
        ['chats', 'messages', matchId],
        (prev) => {
          const arr = prev ?? [];
          if (arr.find((m) => m.id === msg.id)) return arr;
          return [...arr, msg as unknown as Message];
        },
      );
    }).then((u) => { unsubRecv = u; });

    wsOn('chat:typing', (evt: WsChatTyping) => {
      if (cancelled || evt.matchId !== matchId) return;
      setTyping(matchId, !!evt.typing);
    }).then((u) => { unsubTyping = u; });

    return () => {
      cancelled = true;
      unsubRecv?.();
      unsubTyping?.();
    };
  }, [matchId, queryClient, setTyping]);

  // Emit "I'm typing" while user is actively typing; clear 2s after stop.
  const onComposeChange = useCallback(
    (text: string) => {
      setComposing(text);
      const state = typingStateRef.current;
      if (text && !state.isTyping) {
        state.isTyping = true;
        wsEmit('chat:typing', { matchId, typing: true });
      }
      // Reset the auto-clear timer
      if (state.clearAt) clearTimeout(state.clearAt as unknown as number);
      state.clearAt = setTimeout(() => {
        if (typingStateRef.current.isTyping) {
          typingStateRef.current.isTyping = false;
          wsEmit('chat:typing', { matchId, typing: false });
        }
      }, 2000) as unknown as number;
    },
    [matchId],
  );

  // Stop "typing" before leaving the screen.
  useEffect(() => {
    return () => {
      if (typingStateRef.current.isTyping) {
        wsEmit('chat:typing', { matchId, typing: false });
      }
      if (typingStateRef.current.clearAt) {
        clearTimeout(typingStateRef.current.clearAt as unknown as number);
      }
    };
  }, [matchId]);

  const sendMut = useMutation({
    mutationFn: ({ content, type }: { content: string; type: 'text' | 'sticker' }) =>
      sendMessage(matchId, content, type),
    onMutate: ({ content, type }) => {
      const pendingId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const optimistic: Message = {
        id: pendingId,
        pendingId,
        matchId,
        senderId: me?.id ?? 'me',
        content,
        type,
        createdAt: new Date().toISOString(),
        status: 'sending',
      };
      queryClient.setQueryData<Message[]>(
        ['chats', 'messages', matchId],
        (prev) => [...(prev ?? []), optimistic],
      );
      return { pendingId };
    },
    onSuccess: (real, _vars, ctx) => {
      queryClient.setQueryData<Message[]>(['chats', 'messages', matchId], (prev) =>
        (prev ?? []).map((m) =>
          m.pendingId === ctx?.pendingId ? { ...real, status: 'sent' } : m,
        ),
      );
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData<Message[]>(['chats', 'messages', matchId], (prev) =>
        (prev ?? []).map((m) =>
          m.pendingId === ctx?.pendingId ? { ...m, status: 'failed' } : m,
        ),
      );
    },
  });

  const onSend = useCallback(() => {
    const content = composing.trim();
    if (!content) return;
    setComposing('');
    sendMut.mutate({ content, type: 'text' });
  }, [composing, sendMut]);

  const onSticker = useCallback(
    (emoji: string) => {
      setShowStickers(false);
      sendMut.mutate({ content: emoji, type: 'sticker' });
    },
    [sendMut],
  );

  // Render a virtual list with time-divider rows interspersed
  const items = useMemo(() => buildItems(msgsQ.data ?? []), [msgsQ.data]);

  useEffect(() => {
    // scroll to bottom on initial load or new message
    if (items.length > 0) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [items.length]);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      edges={['top', 'bottom']}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        {thread && (
          <>
            <Avatar
              name={thread.user.nickname}
              uri={thread.user.avatarUrl}
              avatarIdx={idxFor(thread.user.id)}
              size={38}
              showOnline={thread.user.isOnline}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.text }}>
                {thread.user.nickname}
              </Text>
              <Text style={{ fontSize: 11.5, color: theme.colors.muted, marginTop: 2 }}>
                {otherTyping ? '正在输入…' : thread.user.isOnline ? '在线' : '离线'}
              </Text>
            </View>
            <Pressable
              style={iconBtn(theme)}
              onPress={() =>
                showSafetyMenu({
                  userId: thread.user.id,
                  userName: thread.user.nickname,
                  nav,
                  includeUnmatch: true,
                  onBlocked: () => {
                    queryClient.invalidateQueries({ queryKey: ['chats', 'list'] });
                    nav.goBack();
                  },
                  onUnmatch: async () => {
                    try {
                      await deleteConversation(matchId);
                      queryClient.invalidateQueries({ queryKey: ['chats', 'list'] });
                      nav.goBack();
                    } catch (e: any) {
                      // Safety-relevant: never silently pretend it worked.
                      const status = e?.response?.status;
                      const detail =
                        e?.response?.data?.error || e?.response?.data?.message || e?.message || 'unknown';
                      Alert.alert(
                        '取消配对失败',
                        `${detail}${status ? ` (HTTP ${status})` : ''}`,
                      );
                    }
                  },
                })
              }
            >
              <MoreHorizontal size={18} color={theme.colors.text} strokeWidth={1.6} />
            </Pressable>
          </>
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        style={{ flex: 1 }}
      >
        {msgsQ.isLoading ? (
          <View style={styles.centerFill}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={items}
            keyExtractor={(it, i) => it.kind === 'time' ? `t-${it.iso}` : `m-${it.msg.id ?? i}`}
            contentContainerStyle={{ paddingVertical: 12, paddingHorizontal: 14, gap: 6 }}
            renderItem={({ item }) => {
              if (item.kind === 'time') {
                return (
                  <Text
                    style={{
                      alignSelf: 'center',
                      color: theme.colors.muted,
                      fontSize: 11,
                      marginVertical: 6,
                    }}
                  >
                    {hhmm(item.iso)}
                  </Text>
                );
              }
              const mine = item.msg.senderId === me?.id;
              const failed = item.msg.status === 'failed';
              return (
                <View style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                  <Bubble
                    text={item.msg.content}
                    from={mine ? 'me' : 'them'}
                    style={failed ? { opacity: 0.6 } : undefined}
                  />
                </View>
              );
            }}
            ListFooterComponent={
              otherTyping ? <TypingDots /> : null
            }
          />
        )}

        {/* Sticker drawer */}
        {showStickers && (
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderTopWidth: 1,
              borderTopColor: theme.colors.line,
              padding: 12,
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            {STICKERS.map((e) => (
              <Pressable
                key={e}
                onPress={() => onSticker(e)}
                style={{
                  width: 44,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 12,
                  backgroundColor: theme.colors.surface2,
                }}
              >
                <Text style={{ fontSize: 22 }}>{e}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Composer */}
        <View
          style={[
            styles.composer,
            { backgroundColor: theme.colors.bg, borderTopColor: theme.colors.line },
          ]}
        >
          <Pressable onPress={() => setShowStickers((s) => !s)} hitSlop={8}>
            <Smile size={24} color={theme.colors.muted} strokeWidth={1.6} />
          </Pressable>
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: theme.colors.surface,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: theme.colors.line,
              paddingHorizontal: 14,
              minHeight: 40,
            }}
          >
            <TextInput
              value={composing}
              onChangeText={onComposeChange}
              placeholder="说点什么…"
              placeholderTextColor={theme.colors.muted}
              multiline
              style={{
                flex: 1,
                paddingVertical: 8,
                fontSize: 15,
                color: theme.colors.text,
                maxHeight: 120,
              }}
            />
          </View>
          {composing.trim() ? (
            <Pressable
              onPress={onSend}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: theme.colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Send size={18} color="#FFFFFF" strokeWidth={2} />
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type ListItem =
  | { kind: 'time'; iso: string }
  | { kind: 'msg'; msg: Message };

function buildItems(messages: Message[]): ListItem[] {
  const out: ListItem[] = [];
  let lastTime = 0;
  for (const m of messages) {
    const t = new Date(m.createdAt).getTime();
    // Insert a divider whenever there's a >10min gap between adjacent messages.
    if (t - lastTime > 10 * 60_000) {
      out.push({ kind: 'time', iso: m.createdAt });
    }
    out.push({ kind: 'msg', msg: m });
    lastTime = t;
  }
  return out;
}

function TypingDots() {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 4,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.line,
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 10,
        alignSelf: 'flex-start',
        marginLeft: 6,
        marginTop: 6,
      }}
    >
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: theme.colors.muted,
          }}
        />
      ))}
    </View>
  );
}

function iconBtn(theme: ReturnType<typeof useTheme>) {
  return {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
