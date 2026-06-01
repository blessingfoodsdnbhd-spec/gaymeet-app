import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Camera,
  ChevronLeft,
  Copy,
  Edit2,
  Image as ImageIcon,
  MapPin,
  MoreHorizontal,
  Plus,
  Send,
  Smile,
  Trash2,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Clipboard from 'expo-clipboard';
import { showSafetyMenu } from '../../utils/safetyMenu';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import { Bubble } from '../../components/Bubble';
import { Sheet } from '../../components/Sheet';
import { PhotoViewer } from '../../components/PhotoViewer';
import { ImageBubble } from './ImageBubble';
import { LocationBubble } from './LocationBubble';
import { useAuth } from '../../store/auth';
import { useChats } from '../../store/chats';
import {
  deleteConversation,
  deleteMessage,
  editMessage,
  getMessages,
  sendMessage,
  sendImageMessage,
  sendLocationMessage,
  type Message,
  type ChatThread,
} from '../../api/chats';
import { uploadFile } from '../../api/upload';
import {
  on as wsOn,
  emit as wsEmit,
  type WsChatReceive,
  type WsChatTyping,
  type WsChatEdited,
  type WsChatDeleted,
} from '../../api/ws';
import { downloadAndCache, deleteCachedImage } from '../../utils/imageCache';
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
  const { t } = useTranslation();
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
  // +-button action sheet (camera / gallery / location)
  const [composerActionsOpen, setComposerActionsOpen] = useState(false);
  // Long-press action sheet target message (null = closed)
  const [actionsFor, setActionsFor] = useState<Message | null>(null);
  // Edit sheet state
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [editDraft, setEditDraft] = useState('');
  // Image viewer Modal
  const [viewerImage, setViewerImage] = useState<Message | null>(null);
  const isPremium = !!(me as any)?.isPremium;
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
    // Tell the server we're now reading this thread. The backend
    // `join_room` handler (services/socketService.js) marks all unread
    // messages as readBy this user AND resets unreadCounts[userId] = 0
    // on the Match document — so the next /api/conversations fetch
    // returns unreadCount: 0 for this row.
    wsEmit('join_room', { matchId });
    // Mirror that reset locally in the chats-list query cache so the
    // badge clears the moment the user navigates back, instead of
    // waiting for the next refetch (ChatsListScreen reads the FlatList
    // data from React Query, not from Zustand — `markRead` above only
    // updates Zustand which doesn't drive the rendered list).
    queryClient.setQueryData<ChatThread[]>(['chats', 'list'], (prev) =>
      (prev ?? []).map((t) =>
        t.matchId === matchId ? { ...t, unreadCount: 0 } : t,
      ),
    );
    return () => setFocus(null);
  }, [matchId, setFocus, markRead, queryClient]);

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

  // Subscribe to WS events for this match (message + typing).
  // wsOn is async (it awaits the socket connect), so the unsubscribe
  // function only arrives later. If the component unmounts before that
  // promise resolves, naively storing the result into a ref would leak
  // the handler. Guard with `cancelled` and tear down inline if so.
  useEffect(() => {
    let unsubRecv: (() => void) | null = null;
    let unsubTyping: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      const u1 = await wsOn('chat:receive', (msg: WsChatReceive) => {
        if (cancelled) return;
        // Any incoming message — whether for this match or another —
        // changes some thread's preview / unreadCount / lastMessageAt,
        // so invalidate the chats-list cache. Done before the matchId
        // gate so cross-match messages still bubble the list when the
        // user pops back from this screen.
        queryClient.invalidateQueries({ queryKey: ['chats', 'list'] });
        if (msg.matchId !== matchId) return;
        // Prefetch image into local cache so the bubble renders from
        // disk on first paint instead of streaming over the network.
        if (msg.type === 'image' && msg.mediaUrl) {
          downloadAndCache(msg.id, msg.mediaUrl).catch(() => {});
        }
        queryClient.setQueryData<Message[]>(
          ['chats', 'messages', matchId],
          (prev) => {
            const arr = prev ?? [];
            if (arr.find((m) => m.id === msg.id)) return arr;
            return [...arr, msg as unknown as Message];
          },
        );
      });

      // chat:edited — server-side edit broadcast. Update the matching
      // row's content + edited flags in our message cache. Cross-match
      // events are ignored.
      const uE = await wsOn('chat:edited', (evt: WsChatEdited) => {
        if (cancelled) return;
        queryClient.invalidateQueries({ queryKey: ['chats', 'list'] });
        if (evt.matchId !== matchId) return;
        queryClient.setQueryData<Message[]>(
          ['chats', 'messages', matchId],
          (prev) =>
            (prev ?? []).map((m) =>
              m.id === evt.id
                ? {
                    ...m,
                    content: evt.content,
                    edited: true,
                    editedAt: evt.editedAt,
                  }
                : m,
            ),
        );
      });

      // chat:deleted — drop the row + any cached image file.
      const uD = await wsOn('chat:deleted', (evt: WsChatDeleted) => {
        if (cancelled) return;
        queryClient.invalidateQueries({ queryKey: ['chats', 'list'] });
        if (evt.matchId !== matchId) return;
        deleteCachedImage(evt.messageId).catch(() => {});
        queryClient.setQueryData<Message[]>(
          ['chats', 'messages', matchId],
          (prev) => (prev ?? []).filter((m) => m.id !== evt.messageId),
        );
      });
      if (cancelled) { u1(); uE(); uD(); return; }
      unsubRecv = () => { u1(); uE(); uD(); };

      const u2 = await wsOn('chat:typing', (evt: WsChatTyping) => {
        if (cancelled || evt.matchId !== matchId) return;
        setTyping(matchId, !!evt.typing);
      });
      if (cancelled) { u2(); return; }
      unsubTyping = u2;
    })();

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
      // The WS chat:receive echo can arrive BEFORE this HTTP POST returns.
      // If it did, the real message is already in the cache (added by the
      // WS handler) AND the optimistic message is still there with
      // pendingId. Naively replacing the optimistic with `real` then leaves
      // two cache entries with the same real.id → React duplicate-key.
      // Detect that case and drop the optimistic instead of replacing it.
      queryClient.setQueryData<Message[]>(['chats', 'messages', matchId], (prev) => {
        const arr = prev ?? [];
        const wsAlreadyHasIt = arr.some(
          (m) => m.id === real.id && m.pendingId !== ctx?.pendingId,
        );
        if (wsAlreadyHasIt) {
          return arr.filter((m) => m.pendingId !== ctx?.pendingId);
        }
        return arr.map((m) =>
          m.pendingId === ctx?.pendingId ? { ...real, status: 'sent' } : m,
        );
      });
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

  /**
   * Push an optimistic image message into the cache, upload the file to
   * B2, then POST /send with the resulting URL. Mirrors sendMut's
   * onSuccess dedupe: if the WS chat:receive echo already added the
   * real message we drop our optimistic copy instead of double-rendering.
   */
  const sendImageFromUri = useCallback(
    async (uri: string) => {
      const pendingId = `tmp-img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const optimistic: Message = {
        id: pendingId,
        pendingId,
        matchId,
        senderId: me?.id ?? 'me',
        content: '',
        type: 'image',
        mediaUrl: uri,
        mediaType: 'image',
        createdAt: new Date().toISOString(),
        status: 'sending',
      };
      queryClient.setQueryData<Message[]>(
        ['chats', 'messages', matchId],
        (prev) => [...(prev ?? []), optimistic],
      );
      try {
        const b2Url = await uploadFile(uri);
        const real = await sendImageMessage(matchId, b2Url);
        queryClient.setQueryData<Message[]>(
          ['chats', 'messages', matchId],
          (prev) => {
            const arr = prev ?? [];
            const wsAlreadyHasIt = arr.some(
              (m) => m.id === real.id && m.pendingId !== pendingId,
            );
            if (wsAlreadyHasIt) {
              return arr.filter((m) => m.pendingId !== pendingId);
            }
            return arr.map((m) =>
              m.pendingId === pendingId ? { ...real, status: 'sent' } : m,
            );
          },
        );
        // Seed the cache with the picked file under the real msg id so
        // the bubble doesn't re-download a fresh copy from B2 — same
        // bytes anyway. Best-effort.
        if (real.id) downloadAndCache(real.id, b2Url).catch(() => {});
      } catch (e: any) {
        console.error('[chat-image] send failed', {
          uri,
          status: e?.response?.status,
          message: e?.message,
        });
        queryClient.setQueryData<Message[]>(
          ['chats', 'messages', matchId],
          (prev) =>
            (prev ?? []).map((m) =>
              m.pendingId === pendingId ? { ...m, status: 'failed' } : m,
            ),
        );
        const detail = e?.response?.data?.error || e?.message || '';
        Alert.alert(t('chat.image.uploadFailed'), detail);
      }
    },
    [matchId, me, queryClient, t],
  );

  const pickCamera = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert(t('chat.composer.cameraPermTitle'), t('chat.composer.cameraPermBody'));
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (res.canceled) return;
    sendImageFromUri(res.assets[0].uri);
  }, [sendImageFromUri, t]);

  const pickGallery = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert(t('profile.edit.photoPermTitle'), t('profile.edit.photoPermBody'));
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (res.canceled) return;
    sendImageFromUri(res.assets[0].uri);
  }, [sendImageFromUri, t]);

  const shareLocation = useCallback(async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert(
        t('chat.composer.locationPermTitle'),
        t('chat.composer.locationPermBody'),
      );
      return;
    }
    let lat: number;
    let lng: number;
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {
      Alert.alert(t('chat.composer.locationFailed'));
      return;
    }
    let label: string | null = null;
    try {
      const places = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lng,
      });
      const p = places?.[0];
      if (p) {
        label =
          [p.name, p.street, p.city, p.region]
            .filter((s): s is string => !!s && s.trim().length > 0)
            .slice(0, 3)
            .join(', ')
            .slice(0, 200) || null;
      }
    } catch {
      // reverse geocode is optional — proceed with lat/lng fallback
    }

    const pendingId = `tmp-loc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const optimistic: Message = {
      id: pendingId,
      pendingId,
      matchId,
      senderId: me?.id ?? 'me',
      content: '',
      type: 'location',
      location: { lat, lng, label },
      createdAt: new Date().toISOString(),
      status: 'sending',
    };
    queryClient.setQueryData<Message[]>(
      ['chats', 'messages', matchId],
      (prev) => [...(prev ?? []), optimistic],
    );
    try {
      const real = await sendLocationMessage(matchId, lat, lng, label);
      queryClient.setQueryData<Message[]>(
        ['chats', 'messages', matchId],
        (prev) => {
          const arr = prev ?? [];
          const wsAlreadyHasIt = arr.some(
            (m) => m.id === real.id && m.pendingId !== pendingId,
          );
          if (wsAlreadyHasIt) {
            return arr.filter((m) => m.pendingId !== pendingId);
          }
          return arr.map((m) =>
            m.pendingId === pendingId ? { ...real, status: 'sent' } : m,
          );
        },
      );
    } catch (e: any) {
      queryClient.setQueryData<Message[]>(
        ['chats', 'messages', matchId],
        (prev) =>
          (prev ?? []).map((m) =>
            m.pendingId === pendingId ? { ...m, status: 'failed' } : m,
          ),
      );
      const detail = e?.response?.data?.error || e?.message || '';
      Alert.alert(t('chat.location.sendFailed'), detail);
    }
  }, [matchId, me, queryClient, t]);

  // Edit / delete mutations for Phase 2f. Both gated by Premium server-side;
  // the long-press action sheet hides options the caller doesn't meet, but
  // the routes also enforce — so a custom client can't slip past either.
  const editMut = useMutation({
    mutationFn: ({ msgId, content }: { msgId: string; content: string }) =>
      editMessage(matchId, msgId, content),
    onSuccess: (data) => {
      // Optimistic local update so the new content shows immediately —
      // WS chat:edited will also arrive and re-set the same fields.
      queryClient.setQueryData<Message[]>(
        ['chats', 'messages', matchId],
        (prev) =>
          (prev ?? []).map((m) =>
            m.id === data.id
              ? {
                  ...m,
                  content: data.content,
                  edited: true,
                  editedAt: data.editedAt,
                }
              : m,
          ),
      );
    },
    onError: (e: any) => {
      const status = e?.response?.status;
      const detail = e?.response?.data?.error || e?.message || '';
      if (status === 410) {
        Alert.alert(t('chat.message.editExpired'));
      } else if (status === 402) {
        Alert.alert(t('chat.message.premiumOnly'));
      } else {
        Alert.alert(t('chat.message.editFailed'), detail);
      }
    },
  });

  const deleteMut = useMutation({
    mutationFn: (msgId: string) => deleteMessage(matchId, msgId),
    onSuccess: (data) => {
      // Local cache + image cache drop; WS chat:deleted will catch up.
      deleteCachedImage(data.messageId).catch(() => {});
      queryClient.setQueryData<Message[]>(
        ['chats', 'messages', matchId],
        (prev) => (prev ?? []).filter((m) => m.id !== data.messageId),
      );
    },
    onError: (e: any) => {
      const status = e?.response?.status;
      const detail = e?.response?.data?.error || e?.message || '';
      if (status === 402) {
        Alert.alert(t('chat.message.premiumOnly'));
      } else {
        Alert.alert(t('chat.message.deleteFailed'), detail);
      }
    },
  });

  /** Compute which long-press actions to show for a given message. */
  const actionsAvailable = useMemo(() => {
    if (!actionsFor) {
      return { canEdit: false, canDelete: false };
    }
    const mine = actionsFor.senderId === me?.id;
    const within24h =
      Date.now() - new Date(actionsFor.createdAt).getTime() < 24 * 60 * 60 * 1000;
    return {
      canEdit:
        mine && isPremium && actionsFor.type === 'text' && within24h,
      canDelete: mine && isPremium,
    };
  }, [actionsFor, me, isPremium]);

  const onCopyMessage = useCallback(async (msg: Message) => {
    let text = msg.content || '';
    if (msg.type === 'location' && msg.location) {
      text = msg.location.label
        ? `${msg.location.label} (${msg.location.lat}, ${msg.location.lng})`
        : `${msg.location.lat}, ${msg.location.lng}`;
    } else if (msg.type === 'image' && msg.mediaUrl) {
      text = msg.mediaUrl;
    }
    if (!text) return;
    await Clipboard.setStringAsync(text);
    Alert.alert(t('chat.message.copied'));
  }, [t]);

  const onConfirmDelete = useCallback(
    (msg: Message) => {
      Alert.alert(t('chat.message.deleteConfirm'), '', [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('chat.message.deleteAction'),
          style: 'destructive',
          onPress: () => deleteMut.mutate(msg.id),
        },
      ]);
    },
    [deleteMut, t],
  );

  // Render a virtual list with time-divider rows interspersed
  const items = useMemo(() => buildItems(msgsQ.data ?? []), [msgsQ.data]);

  // First-render scroll uses animated:false so we *jump* to the bottom
  // instead of animating from the top — the latter is visible to the
  // user as a "rolling up from old messages" effect on entry. Subsequent
  // scrolls (new messages) animate smoothly. The flag lives in a ref so
  // toggling it doesn't re-render.
  const hasScrolledInitially = useRef(false);

  // onContentSizeChange fires AFTER the FlatList has measured its
  // children — strictly more reliable than the previous
  // `useEffect + requestAnimationFrame` pair, which raced the layout
  // pass and left the user halfway up the thread on entry. It also
  // covers the "new message arrives" case since the content height
  // grows when a row is appended.
  const onMsgsContentSizeChange = useCallback(() => {
    if (items.length === 0) return;
    listRef.current?.scrollToEnd({ animated: hasScrolledInitially.current });
    // Belt-and-suspenders for FlatList virtualization on first entry:
    // the initial scrollToEnd lands at the end of the *currently
    // rendered* window (default initialNumToRender = 10), not the
    // absolute end of the data array. The virtualized rows below
    // mount on the next frame; firing a second non-animated scrollToEnd
    // ~50ms later lands at the true bottom. Subsequent calls (after
    // hasScrolledInitially flips) animate normally, so this only
    // affects the chat-entry moment.
    if (!hasScrolledInitially.current) {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: false });
      }, 50);
    }
    hasScrolledInitially.current = true;
  }, [items.length]);

  // Reset the initial-scroll flag whenever the thread itself changes,
  // so navigating from one chat to another also performs a jump-to-end
  // on the new thread's first content-size measurement.
  useEffect(() => {
    hasScrolledInitially.current = false;
  }, [matchId]);

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
            {/* Avatar + name → tap to open this user's full profile.
                Wrapped in one Pressable so the whole strip between back
                arrow and safety-menu icon is tappable — matches Insta
                / WhatsApp UX. */}
            <Pressable
              onPress={() =>
                nav.navigate('UserDetail', { userId: thread.user.id })
              }
              hitSlop={4}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}
            >
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
                  {otherTyping ? t('chats.detail.typing') : thread.user.isOnline ? t('chats.detail.online') : t('chats.detail.offline')}
                </Text>
              </View>
            </Pressable>
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
                        t('chats.detail.unmatchFailed'),
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
        // Android (esp. tablets under the forced edge-to-edge of API 35) drifted
        // the composer out of place with behavior=undefined + a fixed 24px
        // offset. Use "height" on Android and drop the offset — the system
        // adjustResize then positions the input correctly across phone/tablet.
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
            ref={listRef}
            data={items}
            keyExtractor={(it, i) => it.kind === 'time' ? `t-${it.iso}` : `m-${it.msg.id ?? i}`}
            contentContainerStyle={{ paddingVertical: 12, paddingHorizontal: 14, gap: 6 }}
            onContentSizeChange={onMsgsContentSizeChange}
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
              const msg = item.msg;
              const mine = msg.senderId === me?.id;
              const failed = msg.status === 'failed';
              const onLongPress = () => setActionsFor(msg);

              let bubble: React.ReactNode;
              if (msg.type === 'image') {
                bubble = (
                  // ImageBubble is itself a Pressable, so DON'T wrap it in
                  // another Pressable — the inner one swallowed the tap and the
                  // viewer never opened. Pass the open + long-press handlers
                  // straight into ImageBubble instead.
                  <ImageBubble
                    msg={msg}
                    from={mine ? 'me' : 'them'}
                    onPress={() =>
                      !msg.expired && msg.mediaUrl ? setViewerImage(msg) : null
                    }
                    onLongPress={onLongPress}
                  />
                );
              } else if (msg.type === 'location') {
                bubble = (
                  <Pressable onLongPress={onLongPress} delayLongPress={350}>
                    <LocationBubble msg={msg} from={mine ? 'me' : 'them'} />
                  </Pressable>
                );
              } else {
                bubble = (
                  <Pressable onLongPress={onLongPress} delayLongPress={350}>
                    <Bubble
                      text={msg.content}
                      from={mine ? 'me' : 'them'}
                      style={failed ? { opacity: 0.6 } : undefined}
                    />
                  </Pressable>
                );
              }
              return (
                <View
                  style={{
                    flexDirection: 'column',
                    alignItems: mine ? 'flex-end' : 'flex-start',
                  }}
                >
                  {bubble}
                  {msg.edited && (
                    <Text
                      style={{
                        fontSize: 10,
                        color: theme.colors.muted,
                        marginTop: 2,
                        marginHorizontal: 8,
                      }}
                    >
                      {t('chat.message.edited')}
                    </Text>
                  )}
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
          <Pressable onPress={() => setComposerActionsOpen(true)} hitSlop={8}>
            <Plus size={24} color={theme.colors.muted} strokeWidth={1.6} />
          </Pressable>
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
              placeholder={t('chats.detail.messagePlaceholder')}
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

      {/* +-button action sheet: Camera / Gallery / Location */}
      <Sheet
        open={composerActionsOpen}
        onClose={() => setComposerActionsOpen(false)}
        maxHeight="40%"
      >
        <ActionRow
          icon={<Camera size={20} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
          label={t('chat.composer.camera')}
          onPress={() => {
            setComposerActionsOpen(false);
            pickCamera();
          }}
        />
        <ActionRow
          icon={<ImageIcon size={20} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
          label={t('chat.composer.gallery')}
          onPress={() => {
            setComposerActionsOpen(false);
            pickGallery();
          }}
        />
        <ActionRow
          icon={<MapPin size={20} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
          label={t('chat.composer.location')}
          onPress={() => {
            setComposerActionsOpen(false);
            shareLocation();
          }}
        />
        <ActionRow
          label={t('chat.composer.cancel')}
          centered
          onPress={() => setComposerActionsOpen(false)}
        />
      </Sheet>

      {/* Long-press action sheet for an individual message */}
      <Sheet
        open={!!actionsFor}
        onClose={() => setActionsFor(null)}
        maxHeight="40%"
      >
        {actionsFor && (
          <>
            {actionsAvailable.canEdit && (
              <ActionRow
                icon={<Edit2 size={20} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
                label={t('chat.message.actions.edit')}
                onPress={() => {
                  const m = actionsFor;
                  setActionsFor(null);
                  setEditingMsg(m);
                  setEditDraft(m.content);
                }}
              />
            )}
            <ActionRow
              icon={<Copy size={20} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
              label={t('chat.message.actions.copy')}
              onPress={() => {
                const m = actionsFor;
                setActionsFor(null);
                onCopyMessage(m);
              }}
            />
            {actionsAvailable.canDelete && (
              <ActionRow
                icon={<Trash2 size={20} color="#D14B4B" strokeWidth={1.8} />}
                label={t('chat.message.actions.delete')}
                labelColor="#D14B4B"
                onPress={() => {
                  const m = actionsFor;
                  setActionsFor(null);
                  onConfirmDelete(m);
                }}
              />
            )}
            <ActionRow
              label={t('chat.message.actions.cancel')}
              centered
              onPress={() => setActionsFor(null)}
            />
          </>
        )}
      </Sheet>

      {/* Edit sheet — TextInput prefilled with the message content */}
      <Sheet
        open={!!editingMsg}
        onClose={() => setEditingMsg(null)}
        maxHeight="50%"
      >
        {editingMsg && (
          <View style={{ paddingHorizontal: 4 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: theme.colors.text,
                marginBottom: 14,
              }}
            >
              {t('chat.message.editTitle')}
            </Text>
            <TextInput
              value={editDraft}
              onChangeText={setEditDraft}
              placeholder={t('chat.message.editPlaceholder')}
              placeholderTextColor={theme.colors.muted}
              multiline
              autoFocus
              style={{
                backgroundColor: theme.colors.surface,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: theme.colors.line,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 15,
                color: theme.colors.text,
                minHeight: 88,
                maxHeight: 200,
                textAlignVertical: 'top',
              }}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Pressable
                onPress={() => setEditingMsg(null)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 14,
                  alignItems: 'center',
                  backgroundColor: theme.colors.surface2,
                }}
              >
                <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '600' }}>
                  {t('common.cancel')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const m = editingMsg;
                  const draft = editDraft.trim();
                  if (!m || !draft || draft === m.content) {
                    setEditingMsg(null);
                    return;
                  }
                  editMut.mutate({ msgId: m.id, content: draft });
                  setEditingMsg(null);
                }}
                disabled={editMut.isPending}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 14,
                  alignItems: 'center',
                  backgroundColor: theme.colors.primary,
                  opacity: editMut.isPending ? 0.6 : 1,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>
                  {t('common.save')}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </Sheet>

      {/* Full-screen photo viewer. ChatDetailScreen is a pushed screen
          (NOT a Modal), so a single Modal here is safe — no nested-Modal
          stacking problem like the one we had on AboutUserSheet. */}
      <Modal
        visible={!!viewerImage}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerImage(null)}
        statusBarTranslucent
      >
        <PhotoViewer
          open={!!viewerImage}
          photos={viewerImage?.mediaUrl ? [viewerImage.mediaUrl] : []}
          initialIndex={0}
          onClose={() => setViewerImage(null)}
        />
      </Modal>
    </SafeAreaView>
  );
}

interface ActionRowProps {
  icon?: React.ReactNode;
  label: string;
  labelColor?: string;
  centered?: boolean;
  onPress: () => void;
}

function ActionRow({ icon, label, labelColor, centered, onPress }: ActionRowProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 14,
        paddingHorizontal: 8,
        justifyContent: centered ? 'center' : 'flex-start',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {icon}
      <Text
        style={{
          fontSize: 15,
          fontWeight: '600',
          color: labelColor ?? theme.colors.text,
        }}
      >
        {label}
      </Text>
    </Pressable>
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
