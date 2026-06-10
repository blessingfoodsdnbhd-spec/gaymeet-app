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
  Modal,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send, ChevronLeft, MoreVertical, Crown, Lock, ImagePlus, Reply, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import { Sheet } from '../../components/Sheet';
import { PhotoConfirmModal } from '../../components/PhotoConfirmModal';
import { PhotoViewer } from '../../components/PhotoViewer';
import { useAuth } from '../../store/auth';
import {
  getRecentWorldChat,
  sendWorldChat,
  sendWorldChatPhoto,
  reportWorldChat,
  deleteWorldChatMessage,
  getChatRoom,
  type WorldChatMessage,
} from '../../api/worldChat';
import { uploadFile } from '../../api/upload';
import { blockUser } from '../../api/safety';
import { openConversation } from '../../api/chats';
import { on as wsOn, emit as wsEmit } from '../../api/ws';
import { shortTime } from '../../utils/time';
import { countryCodeToFlag } from '../../utils/countryFlag';
import { nativePlaceholder } from '../../utils/worldChatRooms';
import { RoomSettingsSheet } from './RoomSettingsSheet';
import { VerifiedBadge } from '../../components/NameWithBadge';
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
  const isCustom = route.params?.custom ?? /^[a-f0-9]{24}$/i.test(roomId);
  const KEY = React.useMemo(() => ['worldChat', 'recent', roomId], [roomId]);

  // Custom (user-created) rooms carry a title, member/online counts, privacy and
  // creator privileges — fetched here; country rooms skip this.
  const roomQ = useQuery({
    queryKey: ['worldChat', 'room', roomId],
    queryFn: () => getChatRoom(roomId),
    enabled: isCustom,
    staleTime: 10_000,
    select: (d) => d.room,
  });
  const room = roomQ.data;
  const headerTitle = room?.title ?? roomTitle;
  const isCreator = !!room?.isCreator;
  const creatorId = room?.creator?.id ?? null;
  const closed = room?.status === 'closed';

  const [settingsOpen, setSettingsOpen] = React.useState(false);

  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [online, setOnline] = React.useState<number | null>(null);
  const [loadingOlder, setLoadingOlder] = React.useState(false);
  // Whether older history might still exist. Without this, onEndReached on a
  // short list fires repeatedly and loadOlder loops → the footer spinner never
  // stops. Set false once a page comes back smaller than the page size.
  const [hasMore, setHasMore] = React.useState(true);
  const [selected, setSelected] = React.useState<WorldChatMessage | null>(null);
  // Photo send (mirrors ChatDetailScreen's pick → preview → upload flow).
  const [pendingPhoto, setPendingPhoto] = React.useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = React.useState(false);
  const [attachOpen, setAttachOpen] = React.useState(false);
  const [viewerPhoto, setViewerPhoto] = React.useState<string | null>(null);
  // Quoted reply target + transient highlight after jumping to a message.
  const [replyingTo, setReplyingTo] = React.useState<WorldChatMessage | null>(null);
  const [highlightedId, setHighlightedId] = React.useState<string | null>(null);
  const listRef = React.useRef<FlatList<WorldChatMessage>>(null);
  const highlightTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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
      // Room lifecycle (custom rooms only). room-closed is room-scoped; kicked is
      // user-targeted, so confirm it's THIS room.
      const uClosed = await wsOn('world-chat:room-closed', ({ roomId: rid }) => {
        if (!cancelled && rid === roomId) qc.invalidateQueries({ queryKey: ['worldChat', 'room', roomId] });
      });
      const uRoomDel = await wsOn('world-chat:room-deleted', ({ roomId: rid }) => {
        if (cancelled || rid !== roomId) return;
        Alert.alert(t('worldChat.rooms.roomDeleted'));
        nav.goBack();
      });
      const uKicked = await wsOn('world-chat:kicked', ({ roomId: rid }) => {
        if (cancelled || rid !== roomId) return;
        Alert.alert(t('worldChat.rooms.kicked'));
        nav.goBack();
      });
      if (cancelled) { uRecv(); uDel(); uCount(); uClosed(); uRoomDel(); uKicked(); return; }
      unsubs = [uRecv, uDel, uCount, uClosed, uRoomDel, uKicked];
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

  // Add a just-sent message optimistically; the WS echo dedupes by messageId.
  const insertMessage = (msg: WorldChatMessage) => {
    qc.setQueryData<Cache>(KEY, (prev) => {
      const arr = prev?.messages ?? [];
      if (arr.some((x) => x.messageId === msg.messageId)) return prev ?? { messages: arr };
      return { messages: [msg, ...arr] };
    });
  };

  const sendError = (e: any) => {
    const status = e?.response?.status;
    if (status === 429) Alert.alert(t('worldChat.rateLimited'));
    else if (status === 403) Alert.alert(t('worldChat.banned'));
    else Alert.alert(t('worldChat.sendFailed'), e?.response?.data?.error ?? '');
  };

  const onSend = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    const replyMsg = replyingTo;
    setSending(true);
    setDraft('');
    setReplyingTo(null);
    try {
      const msg = await sendWorldChat(body, roomId, replyMsg?.messageId);
      insertMessage(msg);
    } catch (e: any) {
      setDraft(body); // restore so the user doesn't lose their text
      if (replyMsg) setReplyingTo(replyMsg); // restore the quote too
      sendError(e);
    } finally {
      setSending(false);
    }
  };

  // ── Photo send ────────────────────────────────────────────────────────────
  const pickCamera = async () => {
    setAttachOpen(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert(t('chat.composer.cameraPermTitle'), t('chat.composer.cameraPermBody'));
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: Platform.OS === 'android',
      quality: 0.85,
    });
    if (res.canceled) return;
    setPendingPhoto(res.assets[0].uri);
  };

  const pickGallery = async () => {
    setAttachOpen(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert(t('profile.edit.photoPermTitle'), t('profile.edit.photoPermBody'));
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: Platform.OS === 'android',
      quality: 0.85,
    });
    if (res.canceled) return;
    setPendingPhoto(res.assets[0].uri);
  };

  // Preview-modal Send: upload to B2, then post as a photo message. The modal
  // shows its spinner via `uploadingPhoto` until the round-trip finishes.
  const confirmSendPhoto = async (caption: string) => {
    const uri = pendingPhoto;
    if (!uri || uploadingPhoto) return;
    const replyId = replyingTo?.messageId;
    setUploadingPhoto(true);
    try {
      const url = await uploadFile(uri);
      const msg = await sendWorldChatPhoto(url, caption.trim() || undefined, roomId, replyId);
      insertMessage(msg);
      setPendingPhoto(null);
      setReplyingTo(null);
    } catch (e: any) {
      sendError(e);
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Scroll the inverted list to a message and flash it. No-op if it isn't in
  // the currently-loaded window (older history may not be paged in yet).
  const jumpToMessage = React.useCallback(
    (messageId: string) => {
      const idx = messages.findIndex((m) => m.messageId === messageId);
      if (idx < 0) return;
      try {
        listRef.current?.scrollToIndex({ index: idx, viewPosition: 0.5, animated: true });
      } catch {
        // best-effort; onScrollToIndexFailed handles the variable-height case
      }
      setHighlightedId(messageId);
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      highlightTimer.current = setTimeout(() => setHighlightedId(null), 1800);
    },
    [messages],
  );

  // Deep link from a reply push: jump to the replied message once it's loaded.
  const scrollTarget = route.params?.scrollToMessageId;
  React.useEffect(() => {
    if (!scrollTarget || !messages.length) return;
    const t = setTimeout(() => jumpToMessage(scrollTarget), 300);
    return () => clearTimeout(t);
  }, [scrollTarget, messages.length, jumpToMessage]);

  React.useEffect(() => () => {
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
  }, []);

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

  const onDelete = (m: WorldChatMessage) => {
    setSelected(null);
    Alert.alert(t('worldChat.deleteConfirmTitle'), t('worldChat.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('worldChat.delete'),
        style: 'destructive',
        onPress: async () => {
          // Optimistic removal; the WS broadcast drops it for everyone else.
          qc.setQueryData<Cache>(KEY, (prev) =>
            prev ? { messages: prev.messages.filter((x) => x.messageId !== m.messageId) } : prev,
          );
          try {
            await deleteWorldChatMessage(m.messageId);
          } catch {
            Alert.alert(t('worldChat.actionFailed'));
            qc.invalidateQueries({ queryKey: KEY });
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.line, flexDirection: 'row', alignItems: 'center' }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={{ marginRight: 10 }}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            {isCustom && room?.isPrivate && <Lock size={13} color={theme.colors.muted} />}
            <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 18, fontWeight: '700', color: theme.colors.text }}>
              {headerTitle}
            </Text>
            {closed && (
              <Text style={{ fontSize: 11, color: theme.colors.muted, fontWeight: '700' }}>· {t('worldChat.rooms.closed')}</Text>
            )}
          </View>
          <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>
            {isCustom && room
              ? `${t('worldChat.rooms.memberCount', { n: room.memberCount })} · 🟢 ${online ?? room.onlineCount}`
              : `🟢 ${t('worldChat.online', { n: online ?? '—' })}`}
          </Text>
        </View>
        {isCustom && room && (
          <Pressable onPress={() => setSettingsOpen(true)} hitSlop={8} style={{ marginLeft: 8 }}>
            <MoreVertical size={22} color={theme.colors.text} />
          </Pressable>
        )}
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
            ref={listRef}
            data={messages}
            inverted
            keyExtractor={(m) => m.messageId}
            contentContainerStyle={{ paddingVertical: 12, paddingHorizontal: 14, gap: 10 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onEndReached={hasMore ? loadOlder : undefined}
            onEndReachedThreshold={0.3}
            onScrollToIndexFailed={(info) => {
              // Variable row heights → scrollToIndex can miss; approximate then retry.
              listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
              setTimeout(() => {
                try {
                  listRef.current?.scrollToIndex({ index: info.index, viewPosition: 0.5, animated: true });
                } catch {
                  /* give up silently */
                }
              }, 300);
            }}
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
                isCreator={!!creatorId && item.userId === creatorId}
                highlighted={item.messageId === highlightedId}
                onLongPress={() => setSelected(item)}
                onOpenUser={() =>
                  item.userId !== myId && nav.navigate('UserDetail', { userId: item.userId })
                }
                onReplyJump={item.replyTo ? () => jumpToMessage(item.replyTo!.messageId) : undefined}
                onOpenPhoto={() => item.photoUrl && setViewerPhoto(item.photoUrl)}
              />
            )}
          />
        )}

        {/* Reply quote banner (above the composer) */}
        {replyingTo && !closed && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingHorizontal: 16,
              paddingVertical: 8,
              backgroundColor: theme.colors.surface,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: theme.colors.line,
            }}
          >
            <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: theme.colors.primary }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.primary }} numberOfLines={1}>
                {t('worldChat.reply.banner', { name: replyingTo.displayName })}
              </Text>
              <Text style={{ fontSize: 12.5, color: theme.colors.muted }} numberOfLines={1}>
                {replyingTo.type === 'photo' ? replyingTo.caption || '📷' : replyingTo.body}
              </Text>
            </View>
            <Pressable onPress={() => setReplyingTo(null)} hitSlop={8}>
              <X size={18} color={theme.colors.muted} />
            </Pressable>
          </View>
        )}

        {/* Composer (hidden once a custom room is closed) */}
        {closed ? (
          <View style={[styles.composer, { backgroundColor: theme.colors.bg, borderTopColor: theme.colors.line, justifyContent: 'center' }]}>
            <Text style={{ flex: 1, textAlign: 'center', color: theme.colors.muted, fontSize: 13.5 }}>
              {t('worldChat.rooms.closedNotice')}
            </Text>
          </View>
        ) : (
        <View style={[styles.composer, { backgroundColor: theme.colors.bg, borderTopColor: theme.colors.line }]}>
          <Pressable
            onPress={() => setAttachOpen(true)}
            disabled={sending || uploadingPhoto}
            hitSlop={6}
            accessibilityLabel={t('worldChat.photo.label')}
            style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
          >
            <ImagePlus size={24} color={theme.colors.primary} strokeWidth={2} />
          </Pressable>
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
        )}
      </KeyboardAvoidingView>

      {/* Long-press action sheet: own message → delete; others → report/block/DM */}
      <Sheet open={!!selected} onClose={() => setSelected(null)} maxHeight="40%">
        {selected &&
          (selected.userId === myId ? (
            <>
              <ActionRow
                label={`💬 ${t('worldChat.reply.label')}`}
                onPress={() => {
                  setReplyingTo(selected);
                  setSelected(null);
                }}
              />
              <ActionRow label={t('worldChat.delete')} danger onPress={() => onDelete(selected)} />
              <ActionRow label={t('common.cancel')} centered onPress={() => setSelected(null)} />
            </>
          ) : (
            <>
              <ActionRow
                label={`💬 ${t('worldChat.reply.label')}`}
                onPress={() => {
                  setReplyingTo(selected);
                  setSelected(null);
                }}
              />
              <ActionRow label={t('worldChat.report')} onPress={() => onReport(selected)} />
              <ActionRow label={t('worldChat.block')} danger onPress={() => onBlock(selected)} />
              <ActionRow label={t('worldChat.dm')} onPress={() => onDM(selected)} />
              <ActionRow label={t('common.cancel')} centered onPress={() => setSelected(null)} />
            </>
          ))}
      </Sheet>

      {/* Custom-room settings (creator) / leave (member). */}
      {isCustom && room && (
        <RoomSettingsSheet
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          room={room}
          onChanged={() => {
            setSettingsOpen(false);
            roomQ.refetch();
          }}
          onExit={() => {
            setSettingsOpen(false);
            nav.goBack();
          }}
        />
      )}

      {/* Attach: choose camera or gallery */}
      <Sheet open={attachOpen} onClose={() => setAttachOpen(false)} maxHeight="35%">
        <ActionRow label={t('chat.composer.camera')} onPress={pickCamera} />
        <ActionRow label={t('chat.composer.gallery')} onPress={pickGallery} />
        <ActionRow label={t('common.cancel')} centered onPress={() => setAttachOpen(false)} />
      </Sheet>

      {/* Preview + optional caption before sending a photo */}
      <PhotoConfirmModal
        uri={pendingPhoto}
        open={pendingPhoto !== null}
        sending={uploadingPhoto}
        onCancel={() => {
          if (!uploadingPhoto) setPendingPhoto(null);
        }}
        onSend={confirmSendPhoto}
      />

      {/* Full-screen photo viewer */}
      <Modal visible={!!viewerPhoto} transparent animationType="fade" onRequestClose={() => setViewerPhoto(null)}>
        <PhotoViewer
          open={!!viewerPhoto}
          photos={viewerPhoto ? [viewerPhoto] : []}
          initialIndex={0}
          onClose={() => setViewerPhoto(null)}
        />
      </Modal>
    </SafeAreaView>
  );
}

function Row({
  msg,
  mine,
  isCreator,
  highlighted,
  onLongPress,
  onOpenUser,
  onReplyJump,
  onOpenPhoto,
}: {
  msg: WorldChatMessage;
  mine: boolean;
  isCreator?: boolean;
  highlighted?: boolean;
  onLongPress: () => void;
  onOpenUser: () => void;
  onReplyJump?: () => void;
  onOpenPhoto: () => void;
}) {
  const theme = useTheme();
  // "🇲🇾 吉隆坡 · jacky teh" — location prefix when known, else just the name.
  const loc = [countryCodeToFlag(msg.countryCode), msg.city || ''].filter(Boolean).join(' ');
  const senderLabel = loc ? `${loc} · ${msg.displayName}` : msg.displayName;
  const isPhoto = msg.type === 'photo' && !!msg.photoUrl;
  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={300}
      style={{
        flexDirection: mine ? 'row-reverse' : 'row',
        gap: 10,
        alignItems: 'flex-start',
        borderRadius: 12,
        paddingVertical: highlighted ? 4 : 0,
        backgroundColor: highlighted ? theme.colors.primarySoft : 'transparent',
      }}
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
          {!mine && msg.isOfficial && <VerifiedBadge size={13} />}
          {isCreator && <Crown size={12} color={theme.colors.primary} />}
          <Text style={{ fontSize: 11, color: theme.colors.muted }}>{shortTime(msg.createdAt)}</Text>
        </View>

        {/* Quoted reply — tap to jump to the original. Brand-color left border. */}
        {msg.replyTo && (
          <Pressable
            onPress={onReplyJump}
            style={{
              maxWidth: '92%',
              marginBottom: 4,
              backgroundColor: theme.colors.surface2,
              borderRadius: 10,
              borderLeftWidth: 3,
              borderLeftColor: theme.colors.primary,
              paddingVertical: 5,
              paddingHorizontal: 9,
            }}
          >
            <Text numberOfLines={1} style={{ fontSize: 11.5, fontWeight: '700', color: theme.colors.primary }}>
              {msg.replyTo.displayName}
            </Text>
            <Text numberOfLines={1} style={{ fontSize: 12.5, color: theme.colors.muted }}>
              {msg.replyTo.type === 'photo' ? msg.replyTo.body || '📷' : msg.replyTo.body}
            </Text>
          </Pressable>
        )}

        {isPhoto ? (
          <Pressable onPress={onOpenPhoto} style={{ borderRadius: 14, overflow: 'hidden', maxWidth: '92%' }}>
            <ExpoImage
              source={{ uri: msg.photoUrl! }}
              style={{ width: 220, height: 280, backgroundColor: theme.colors.surface2 }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={120}
            />
            {!!msg.caption && (
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  backgroundColor: 'rgba(0,0,0,0.4)',
                }}
              >
                <Text numberOfLines={2} style={{ color: '#FFFFFF', fontSize: 13, lineHeight: 18 }}>
                  {msg.caption}
                </Text>
              </View>
            )}
          </Pressable>
        ) : (
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
        )}
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
