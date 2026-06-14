import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  Copy,
  Edit2,
  Flag,
  MoreHorizontal,
  Plus,
  Trash2,
  X,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { showSafetyMenu } from '../../utils/safetyMenu';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import { Bubble } from '../../components/Bubble';
import { ChatComposer } from '../../components/ChatComposer';
import { SwipeToReply } from '../../components/SwipeToReply';
import { Sheet } from '../../components/Sheet';
import { PhotoViewer } from '../../components/PhotoViewer';
import { ImageBubble } from './ImageBubble';
import { LocationBubble } from './LocationBubble';
import { NameWithBadge } from '../../components/NameWithBadge';
import { useAuth } from '../../store/auth';
import { useChats } from '../../store/chats';
import {
  deleteConversation,
  deleteMessage,
  editMessage,
  getConversations,
  getMessages,
  sendMessage,
  sendImageMessage,
  uploadChatVoice,
  sendVoiceMessage,
  toggleReaction,
  markConversationRead,
  type Message,
  type ChatThread,
} from '../../api/chats';
import { uploadFile } from '../../api/upload';
import { PhotoConfirmModal } from '../../components/PhotoConfirmModal';
import { VoicePlayButton } from '../../components/VoicePlayButton';
import { UpgradePremiumSheet } from '../../components/UpgradePremiumSheet';
import { IcebreakerCard } from './IcebreakerCard';
import {
  on as wsOn,
  emit as wsEmit,
  type WsChatReceive,
  type WsChatTyping,
  type WsChatEdited,
  type WsChatDeleted,
  type WsChatReaction,
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

// Quick-reaction row shown on long-press (WhatsApp/iMessage style).
const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '👎'];
// Curated grid for the "+" full picker — pure-JS (no native emoji-lib dependency,
// so it can't break the EAS build). Covers the common faces/gestures/hearts.
const EMOJI_PICKER = [
  '❤️', '😂', '😮', '😢', '👍', '👎', '🔥', '🎉', '😍', '🥰', '😘', '😎',
  '🤔', '😅', '🙃', '😴', '🥺', '😭', '😡', '🤯', '🥳', '😇', '🤗', '🙏',
  '👏', '💪', '🤝', '✌️', '🤞', '👌', '✨', '⭐', '💯', '💖', '💔', '💋',
  '😋', '😜', '🤪', '😏', '🙄', '😬', '😱', '🤩', '🥲', '😤', '👀', '💀',
];

/** Apply a reaction toggle locally (optimistic): add the user to the emoji's
 *  list, or remove + drop empty buckets if already present. */
function applyReactionToggle(
  reactions: Record<string, string[]> | undefined,
  emoji: string,
  uid: string,
): Record<string, string[]> {
  const next: Record<string, string[]> = { ...(reactions ?? {}) };
  const list = next[emoji] ?? [];
  if (list.includes(uid)) {
    const filtered = list.filter((x) => x !== uid);
    if (filtered.length) next[emoji] = filtered;
    else delete next[emoji];
  } else {
    next[emoji] = [...list, uid];
  }
  return next;
}

// Normalize a message's senderId to a string id. Defensive: senderId is a
// string id across all current delivery paths, but a populated {_id,…} object
// (or ObjectId) from any future path would silently break the `=== me.id`
// ownership check that gates Edit/Delete (WWWW).
function senderIdOf(m: any): string {
  const s = m?.senderId;
  return s && typeof s === 'object' ? String(s._id ?? s.id ?? '') : String(s ?? '');
}

// One-line, language-neutral summary of a message for a reply quote. Mirrors the
// backend's Message.replyPreviewOf so the optimistic quote matches what the
// server stores on reload.
function replyPreviewText(m: Message): string {
  switch (m.type) {
    case 'image':
      return '📷';
    case 'voice':
      return '🎙️';
    case 'location':
      return '📍';
    default:
      return m.content || '';
  }
}

export function ChatDetailScreen() {
  const theme = useTheme();
  const { width: winWidth } = useWindowDimensions();
  // Absolute-px cap for the text bubble's width. The shared <Bubble> caps at
  // '78%', a PERCENTAGE that only resolves against a parent with a DEFINITE
  // width. To overlay the ✕ we wrap the bubble in a shrink-wrapped (indefinite)
  // container, so we hand the text bubble a concrete pixel cap instead — same
  // ~78% of the usable row (screen minus the list's 14pt horizontal padding on
  // each side), but immune to the indefinite-parent percentage trap on Android.
  const textBubbleMaxW = Math.round((winWidth - 28) * 0.78);
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const queryClient = useQueryClient();
  const me = useAuth((s) => s.user);
  // My id, tolerant of id vs _id. Drives message ownership (Edit/Delete).
  const myId = String((me as any)?.id ?? (me as any)?._id ?? '');

  const matchId = route.params.chatId; // route param is named chatId but holds matchId
  const storeThread: ChatThread | undefined = useChats((s) =>
    s.threads.find((t) => t.matchId === matchId),
  );
  const setThreads = useChats((s) => s.setThreads);

  // Self-sufficient thread resolution. The Zustand `threads` store is populated
  // ONLY by ChatsListScreen — so a push-notification deep-link straight into a
  // chat (cold start, or any time the Chats tab hasn't mounted) finds an empty
  // store, leaving `otherId` undefined and the messages query disabled — i.e.
  // the chat hangs blank until the user manually opens the list. Fetch the
  // conversation list here too (shared ['chats','list'] key → dedupes with
  // ChatsListScreen and reuses its cache when warm), and resolve the thread
  // from the store OR this fetch, whichever lands first.
  const convosQ = useQuery({
    queryKey: ['chats', 'list'],
    queryFn: getConversations,
    staleTime: 30_000,
    enabled: !storeThread,
  });
  const thread: ChatThread | undefined =
    storeThread ?? convosQ.data?.find((tt) => tt.matchId === matchId);

  // Keep the store in sync so the rest of the app (and a later list visit) sees
  // these threads, and so re-renders here read a stable reference.
  useEffect(() => {
    if (!storeThread && convosQ.data) setThreads(convosQ.data);
  }, [storeThread, convosQ.data, setThreads]);

  const setFocus = useChats((s) => s.setFocus);
  const markRead = useChats((s) => s.markRead);
  const typingMap = useChats((s) => s.typing);
  const otherTyping = !!typingMap[matchId];

  const [composing, setComposing] = useState('');
  // Swipe-to-reply quote target + transient highlight after jumping to the
  // quoted original.
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Live mirror of the rendered (inverted) list so jumpToMessage can resolve an
  // index without being recreated whenever the message list changes.
  const invItemsRef = useRef<ListItem[]>([]);
  const [showStickers, setShowStickers] = useState(false);
  // Premium upsell sheet — holds the contextual reason string (null = closed).
  const [upsellReason, setUpsellReason] = useState<string | null>(null);
  // Long-press action sheet target message (null = closed)
  const [actionsFor, setActionsFor] = useState<Message | null>(null);
  // "+" full emoji picker target, and who-reacted modal target ({msg, emoji}).
  const [emojiPickerFor, setEmojiPickerFor] = useState<Message | null>(null);
  const [whoReactedFor, setWhoReactedFor] = useState<{ msg: Message; emoji: string } | null>(null);
  // Inline-edit target (swipe-right). Drives the composer's "Editing …" chip and
  // pre-fills `composing`; on Save, onSend routes to editMut. No separate sheet.
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  // Several long-press actions (edit, full emoji picker) open their OWN <Modal>
  // sheet. On iOS a Modal can't be presented while another is still dismissing,
  // so opening one in the same tick we close the actions sheet makes it
  // silently fail to appear (the "edit does nothing" bug).
  //
  // #181 queued the follow-up and ran it from the actions <Modal onDismiss>.
  // That callback is UNRELIABLE on the New Architecture (Fabric, this app runs
  // newArchEnabled) + RN 0.76 — it frequently never fires, so the queued edit
  // stayed parked in the ref and "编辑" did nothing again on Build 61. Don't
  // depend on onDismiss: close the actions sheet, then present the follow-up
  // after a fixed delay long enough for the native modal to finish tearing
  // down (its animationType is "none", so dismissal is near-instant; ~320ms is
  // comfortably safe and barely perceptible). Android has no race — run now.
  const pendingActionRef = useRef<(() => void) | null>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runPending = useCallback(() => {
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    const next = pendingActionRef.current;
    if (next) {
      pendingActionRef.current = null;
      next();
    }
  }, []);
  const closeActionsThen = useCallback(
    (next: () => void) => {
      // Both platforms now defer through the same pending mechanism, only the
      // delay differs:
      //   iOS — the present-while-dismissing race above needs ~320ms.
      //   Android — there is no present race, but if we open the edit sheet in
      //     the SAME tick the actions Modal is torn down, the edit input's
      //     keyboard rises WHILE the actions Modal is still on screen. Under
      //     edge-to-edge (Build 53) Android pans that still-present Modal to the
      //     top of the window — this is the "action sheet flies to the top"
      //     glitch. Waiting ~160ms lets the actions Modal (animationType="none",
      //     near-instant) fully unmount first, so only the edit sheet is present
      //     when its keyboard appears. (Pre-#218 the Android keyboard often
      //     didn't rise — autoFocus was dropped — so the pan never showed; #218
      //     hardened focus(), which is why this surfaced in Build 54.)
      pendingActionRef.current = next;
      setActionsFor(null);
      pendingTimerRef.current = setTimeout(runPending, Platform.OS === 'ios' ? 320 : 160);
    },
    [runPending],
  );
  // Don't leave a queued sheet to pop after the screen is gone.
  useEffect(() => () => {
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
  }, []);
  // Image viewer Modal
  const [viewerImage, setViewerImage] = useState<Message | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null); // VVVV — photo awaiting confirm
  const isPremium = !!(me as any)?.isPremium;
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
    // Mark read on the server. The WS emit is kept (it also joins the socket
    // room for live receipts), but it's fire-and-forget and DROPS when the
    // socket isn't connected — which left the badge stuck until the 2nd open.
    // The HTTP call is the reliable path: it deterministically zeroes the
    // server-side unreadCount so the back-nav refetch returns 0.
    wsEmit('join_room', { matchId });
    markConversationRead(matchId).catch(() => {});
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

  // Show conversation starters (ICE1) on an empty chat: messages loaded, none
  // of them real (non-system), the user hasn't started typing, sticker tray closed.
  const hasRealMessages = (msgsQ.data ?? []).some((m) => !m.isSystem);
  const showIcebreakers =
    !msgsQ.isLoading && msgsQ.isSuccess && !hasRealMessages && !composing.trim() && !showStickers;

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
      // chat:reaction-added / -removed — both carry the message's FULL updated
      // reactions map, so one handler replaces it wholesale. Cross-match ignored.
      const onReaction = (evt: WsChatReaction) => {
        if (cancelled || evt.matchId !== matchId) return;
        queryClient.setQueryData<Message[]>(
          ['chats', 'messages', matchId],
          (prev) =>
            (prev ?? []).map((m) =>
              m.id === evt.messageId ? { ...m, reactions: evt.reactions } : m,
            ),
        );
      };
      const uRa = await wsOn('chat:reaction-added', onReaction);
      const uRr = await wsOn('chat:reaction-removed', onReaction);

      if (cancelled) { u1(); uE(); uD(); uRa(); uRr(); return; }
      unsubRecv = () => { u1(); uE(); uD(); uRa(); uRr(); };

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
    mutationFn: ({
      content,
      type,
      replyTo,
    }: {
      content: string;
      type: 'text' | 'sticker';
      replyTo?: Message | null;
    }) => sendMessage(matchId, content, type, replyTo?.id),
    onMutate: ({ content, type, replyTo }) => {
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
        // Show the quote immediately; the server echo re-sets the same fields.
        replyTo: replyTo
          ? {
              id: replyTo.id,
              senderId: senderIdOf(replyTo),
              type: replyTo.type,
              preview: replyPreviewText(replyTo),
            }
          : null,
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
      // Mark the chats list stale so its lastMessage preview reflects what we
      // just sent. The list screen also refetches on focus, so this keeps the
      // outside preview in sync even if the WS self-echo never arrives.
      queryClient.invalidateQueries({ queryKey: ['chats', 'list'] });
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
    // Inline-edit mode (swipe-right): Save the edit instead of sending a new
    // message. editMut is declared further down — go through a ref so this
    // callback doesn't touch it during render (TDZ) nor list it as a dep.
    if (editingMsg) {
      const orig = editingMsg;
      setEditingMsg(null);
      setComposing('');
      if (content !== orig.content) editMutRef.current.mutate({ msgId: orig.id, content });
      return;
    }
    const replyTo = replyingTo;
    setComposing('');
    setReplyingTo(null);
    sendMut.mutate({ content, type: 'text', replyTo });
  }, [composing, sendMut, replyingTo, editingMsg]);

  // Begin an inline edit (swipe-right on an own text message). Premium-gated;
  // free users get the upsell. Only own text messages within 24h are editable.
  const onEditSwipe = useCallback(
    (msg: Message) => {
      if (msg.pendingId || msg.isSystem || msg.status === 'failed') return;
      const mine = !!myId && senderIdOf(msg) === myId;
      if (!mine || msg.type !== 'text') return;
      const within24h = Date.now() - new Date(msg.createdAt).getTime() < 24 * 60 * 60 * 1000;
      if (!within24h) {
        Alert.alert(t('chat.message.editExpired'));
        return;
      }
      if (!isPremium) {
        setUpsellReason(t('premium.upsell.editMsgReason'));
        return;
      }
      setReplyingTo(null);
      setEditingMsg(msg);
      setComposing(msg.content);
    },
    [myId, isPremium, t],
  );

  // Swipe-right on a bubble → quote it in the composer. Ignore rows that aren't
  // real server messages yet (optimistic/failed sends have no usable id).
  const onReplyTo = useCallback((msg: Message) => {
    if (msg.pendingId || msg.isSystem || msg.status === 'failed') return;
    setReplyingTo(msg);
  }, []);

  // Tap a quote → scroll to the original (if it's in the loaded window) and
  // flash it. No-op for older messages not yet paged in.
  const jumpToMessage = useCallback(
    (id: string) => {
      const idx = invItemsRef.current.findIndex(
        (it) => it.kind === 'msg' && it.msg.id === id,
      );
      if (idx < 0) return;
      try {
        listRef.current?.scrollToIndex({ index: idx, viewPosition: 0.5, animated: true });
      } catch {
        // onScrollToIndexFailed handles the variable-height retry
      }
      setHighlightedId(id);
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      highlightTimer.current = setTimeout(() => setHighlightedId(null), 1800);
    },
    [],
  );

  useEffect(
    () => () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    },
    [],
  );

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

  const sendVoiceFromUri = useCallback(
    async (uri: string, durationMs: number) => {
      const pendingId = `tmp-voice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const optimistic: Message = {
        id: pendingId,
        pendingId,
        matchId,
        senderId: me?.id ?? 'me',
        content: '',
        type: 'voice',
        mediaUrl: uri,
        duration: durationMs,
        createdAt: new Date().toISOString(),
        status: 'sending',
      };
      queryClient.setQueryData<Message[]>(
        ['chats', 'messages', matchId],
        (prev) => [...(prev ?? []), optimistic],
      );
      try {
        const { mediaUrl } = await uploadChatVoice(uri);
        const real = await sendVoiceMessage(matchId, mediaUrl, durationMs);
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
        Alert.alert(t('chat.voice.sendFailed'), detail);
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
      // Free-aspect crop on Android only; iOS editor is square-only so keep the
      // photo's natural shape there (PR JJJ).
      allowsEditing: Platform.OS === 'android',
      quality: 0.85,
    });
    if (res.canceled) return;
    setPendingPhoto(res.assets[0].uri); // VVVV — confirm before sending
  }, [t]);

  const pickGallery = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert(t('profile.edit.photoPermTitle'), t('profile.edit.photoPermBody'));
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // Free-aspect crop on Android only; iOS editor is square-only (PR JJJ).
      allowsEditing: Platform.OS === 'android',
      quality: 0.85,
    });
    if (res.canceled) return;
    setPendingPhoto(res.assets[0].uri); // VVVV — confirm before sending
  }, [t]);

  // VVVV — staged photo awaiting the preview/confirm modal. On Send we fire the
  // existing optimistic image send (which shows the sending bubble) and, if a
  // caption was typed, send it as a follow-up text message.
  const confirmSendPhoto = useCallback(
    (caption: string) => {
      const uri = pendingPhoto;
      setPendingPhoto(null);
      if (!uri) return;
      sendImageFromUri(uri);
      const c = caption.trim();
      if (c) sendMut.mutate({ content: c, type: 'text' });
    },
    [pendingPhoto, sendImageFromUri, sendMut],
  );


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
  // Stable handle so onSend (declared earlier) can fire the edit without taking
  // editMut as a dep (it's defined here, after onSend → TDZ if referenced there).
  const editMutRef = useRef(editMut);
  editMutRef.current = editMut;

  // Delete one of MY messages. Optimistic removal with rollback on failure.
  const deleteMut = useMutation({
    mutationFn: (msgId: string) => deleteMessage(matchId, msgId),
    onMutate: (msgId) => {
      const prev = queryClient.getQueryData<Message[]>(['chats', 'messages', matchId]);
      queryClient.setQueryData<Message[]>(['chats', 'messages', matchId], (p) =>
        (p ?? []).filter((m) => m.id !== msgId),
      );
      return { prev };
    },
    onError: (e: any, _msgId, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['chats', 'messages', matchId], ctx.prev);
      const status = e?.response?.status;
      const detail = e?.response?.data?.error || e?.message || '';
      if (status === 402) Alert.alert(t('chat.message.premiumOnly'));
      else Alert.alert(t('chat.message.deleteFailed'), detail);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats', 'list'] });
    },
  });

  // ✕ next to an own message → delete it. Premium-gated like the ChatsList ✕:
  // every user sees the ✕, free users get the upsell, Premium gets a confirm.
  const onDeleteMsg = useCallback(
    (msg: Message) => {
      if (msg.pendingId || msg.isSystem || msg.status === 'failed' || !msg.id) return;
      const mine = !!myId && senderIdOf(msg) === myId;
      if (!mine) return;
      if (!isPremium) {
        setUpsellReason(t('premium.upsell.deleteMsgReason'));
        return;
      }
      Alert.alert(t('chat.message.deleteConfirm'), undefined, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('chat.message.deleteAction'),
          style: 'destructive',
          onPress: () => deleteMut.mutate(msg.id),
        },
      ]);
    },
    [myId, isPremium, t, deleteMut],
  );

  // Reaction toggle. Optimistically updates the bubble's pills, then POSTs;
  // the server echoes the authoritative full map (and broadcasts to the peer
  // via WS). On error we refetch to undo the optimistic change.
  const reactMut = useMutation({
    mutationFn: ({ msgId, emoji }: { msgId: string; emoji: string }) =>
      toggleReaction(matchId, msgId, emoji),
    onSuccess: (res) => {
      queryClient.setQueryData<Message[]>(
        ['chats', 'messages', matchId],
        (prev) =>
          (prev ?? []).map((m) =>
            m.id === res.messageId ? { ...m, reactions: res.reactions } : m,
          ),
      );
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['chats', 'messages', matchId] });
    },
  });

  const onReact = useCallback(
    (msg: Message, emoji: string) => {
      const uid = me?.id;
      if (!uid || !msg.id) return;
      queryClient.setQueryData<Message[]>(
        ['chats', 'messages', matchId],
        (prev) =>
          (prev ?? []).map((m) =>
            m.id === msg.id
              ? { ...m, reactions: applyReactionToggle(m.reactions, emoji, uid) }
              : m,
          ),
      );
      reactMut.mutate({ msgId: msg.id, emoji });
    },
    [me?.id, matchId, queryClient, reactMut],
  );


  // Render a virtual list with time-divider rows interspersed
  const items = useMemo(() => buildItems(msgsQ.data ?? []), [msgsQ.data]);

  // The message list is an INVERTED FlatList: newest-first data, so the newest
  // message sits at the natural bottom anchor (scroll offset 0) with no scroll
  // math at all. This replaces the old scrollToEnd-after-onContentSizeChange +
  // 50ms setTimeout dance, which under-scrolled on entry whenever virtualized
  // rows or async-loading image bubbles grew the content AFTER the scroll had
  // already fired. Inverting also keeps the view pinned to the bottom as new
  // messages arrive, while (correctly) not yanking the user down mid-scroll
  // when they're reading older history.
  const invItems = useMemo(() => items.slice().reverse(), [items]);
  invItemsRef.current = invItems;

  // maintainVisibleContentPosition — iOS ONLY. It keeps the inverted list from
  // "jumping" when a new row inserts (#127). But on the New Architecture
  // (Fabric, RN 0.76.5) + Android it mis-anchors and SNAPS the inverted list to
  // the top whenever the underlying ScrollView is re-measured — which a <Modal>
  // mount does. So on Android, long-pressing a bubble (opening the actions
  // sheet) or opening the edit sheet made every message "fly to the top" and
  // overlap the header (Build 52, Android only). WorldChatScreen is an inverted
  // chat list with NO maintainVisibleContentPosition and never jumps on Android
  // — an inverted list already keeps position on insert there natively — so we
  // simply omit the prop on Android to match. (undefined === prop disabled.)
  const keepVisiblePosition = useMemo(
    () =>
      Platform.OS === 'ios'
        ? { minIndexForVisible: 0, autoscrollToTopThreshold: 10 }
        : undefined,
    [],
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      edges={['top', 'bottom']}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.line, backgroundColor: theme.colors.bg }]}>
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
                <NameWithBadge
                  name={thread.user.nickname}
                  official={thread.user.isOfficial}
                  verified={thread.user.isVerified}
                  premium={thread.user.isPremium}
                  numberOfLines={1}
                  badgeSize={16}
                  textStyle={{ fontSize: 16, fontWeight: '600', color: theme.colors.text }}
                />
                <Text style={{ fontSize: 11.5, color: theme.colors.muted, marginTop: 2 }}>
                  {otherTyping ? t('chats.detail.typing') : thread.user.isOnline ? t('chats.detail.online') : t('chats.detail.offline')}
                </Text>
              </View>
            </Pressable>
            <Pressable
              style={iconBtn(theme)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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
        // keyboard-controller's KeyboardAvoidingView (driven by KeyboardProvider
        // in App.tsx) tracks the native keyboard animation on BOTH platforms, so
        // "padding" is correct everywhere — it does NOT double-compensate against
        // Android's adjustResize the way RN's behavior="height" did under API 35
        // forced edge-to-edge (the "fly-to-top" bug). iOS behaviour is unchanged.
        behavior="padding"
        keyboardVerticalOffset={0}
        style={{ flex: 1 }}
      >
        {msgsQ.isLoading || (!thread && convosQ.isLoading) ? (
          <View style={styles.centerFill}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={invItems}
            inverted
            onScrollToIndexFailed={(info) => {
              // Variable row heights → scrollToIndex can miss; approximate then retry.
              listRef.current?.scrollToOffset({
                offset: info.averageItemLength * info.index,
                animated: true,
              });
              setTimeout(() => {
                try {
                  listRef.current?.scrollToIndex({
                    index: info.index,
                    viewPosition: 0.5,
                    animated: true,
                  });
                } catch {
                  /* give up silently */
                }
              }, 300);
            }}
            // Keep the chat CONTENT from jumping when a new row inserts (a
            // message either side sends, the optimistic→real swap, a WS echo).
            // iOS-only — see `keepVisiblePosition` above for why this is off on
            // Android (Fabric mis-anchors it to the top when a Modal opens).
            maintainVisibleContentPosition={keepVisiblePosition}
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
              const msg = item.msg;
              // System message (match greeting) — centered, no bubble/avatar,
              // localized client-side (the stored content is a fallback).
              if (msg.isSystem) {
                return (
                  <Text
                    style={{
                      alignSelf: 'center',
                      textAlign: 'center',
                      color: theme.colors.muted,
                      fontSize: 13,
                      fontStyle: 'italic',
                      marginVertical: 14,
                      marginHorizontal: 40,
                      lineHeight: 19,
                    }}
                  >
                    {t('system.match.created')}
                  </Text>
                );
              }
              const mine = !!myId && senderIdOf(msg) === myId;
              const failed = msg.status === 'failed';
              // Long-press is intentionally a NO-OP (Build 76, both platforms).
              // It used to open a reactions-only sheet (emoji row + "+"); removed
              // per spec. Existing reactions still DISPLAY and stay tappable under
              // the bubble (see the reactions row below) — there's just no
              // long-press entry to add new ones. ✕-delete, swipe edit/reply,
              // photo-tap, and the header "..." menu are unaffected.
              const onLongPress = undefined;

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
                  // LocationBubble is itself a Pressable (tap → maps), so we
                  // forward onLongPress into it rather than wrapping — an outer
                  // Pressable would have its long-press swallowed by the inner one.
                  <LocationBubble msg={msg} from={mine ? 'me' : 'them'} onLongPress={onLongPress} />
                );
              } else if (msg.type === 'voice') {
                const secs = Math.max(1, Math.round((msg.duration ?? 0) / 1000));
                bubble = (
                  <Pressable onLongPress={onLongPress} delayLongPress={350}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        backgroundColor: mine ? theme.colors.primary : theme.colors.surface2,
                        borderRadius: 20,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        opacity: failed ? 0.6 : 1,
                      }}
                    >
                      <VoicePlayButton
                        url={msg.mediaUrl ?? ''}
                        size={22}
                        color={mine ? '#FFFFFF' : theme.colors.primaryDeep}
                        preload
                      />
                      {/* simple static waveform glyph */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        {[10, 18, 13, 22, 15, 9, 17, 12].map((h, i) => (
                          <View
                            key={i}
                            style={{
                              width: 3,
                              height: h,
                              borderRadius: 2,
                              backgroundColor: mine ? 'rgba(255,255,255,0.85)' : theme.colors.muted,
                            }}
                          />
                        ))}
                      </View>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: mine ? '#FFFFFF' : theme.colors.text2 }}>
                        {secs}s
                      </Text>
                    </View>
                  </Pressable>
                );
              } else {
                bubble = (
                  <Pressable onLongPress={onLongPress} delayLongPress={350}>
                    <Bubble
                      text={msg.content}
                      from={mine ? 'me' : 'them'}
                      style={[{ maxWidth: textBubbleMaxW }, failed ? { opacity: 0.6 } : null]}
                    />
                  </Pressable>
                );
              }
              const highlighted = !!msg.id && msg.id === highlightedId;
              return (
                <SwipeToReply
                  enabled={!msg.pendingId}
                  onReply={() => onReplyTo(msg)}
                  onEdit={mine && msg.type === 'text' ? () => onEditSwipe(msg) : undefined}
                >
                  <View
                    style={{
                      flexDirection: 'column',
                      alignItems: mine ? 'flex-end' : 'flex-start',
                      borderRadius: 12,
                      paddingVertical: highlighted ? 4 : 0,
                      paddingHorizontal: highlighted ? 4 : 0,
                      backgroundColor: highlighted
                        ? theme.colors.primarySoft
                        : 'transparent',
                    }}
                  >
                  {/* Quoted reply — tap to jump to the original. */}
                  {msg.replyTo && (
                    <Pressable
                      onPress={() => msg.replyTo?.id && jumpToMessage(msg.replyTo.id)}
                      style={{
                        maxWidth: '78%',
                        marginBottom: 3,
                        alignSelf: mine ? 'flex-end' : 'flex-start',
                        backgroundColor: theme.colors.surface2,
                        borderRadius: 10,
                        borderLeftWidth: 3,
                        borderLeftColor: theme.colors.primary,
                        paddingVertical: 5,
                        paddingHorizontal: 9,
                      }}
                    >
                      <Text
                        numberOfLines={1}
                        style={{ fontSize: 11.5, fontWeight: '700', color: theme.colors.primary }}
                      >
                        {msg.replyTo.senderId === myId
                          ? t('chats.detail.you')
                          : thread?.user.nickname ?? ''}
                      </Text>
                      <Text numberOfLines={1} style={{ fontSize: 12.5, color: theme.colors.muted }}>
                        {msg.replyTo.preview}
                      </Text>
                    </Pressable>
                  )}
                  {mine && !msg.pendingId && !msg.isSystem && msg.status !== 'failed' && !!msg.id ? (
                    // Own message → small ✕ delete afffordance to the LEFT of the
                    // bubble. Premium-gated (free → upsell). Light grey so it never
                    // competes with the bubble.
                    //
                    // The ✕ is an ABSOLUTE overlay, NOT a flex-row sibling. PR #245
                    // put it in a `flexDirection:'row'` next to the bubble, which
                    // on Android collapsed short bubbles to one glyph per line
                    // ("hi" → h/i, "你好" → 你/好): a <Text> inside a row reports its
                    // min-intrinsic (single-glyph) width and Yoga lays it out that
                    // narrow. iOS measures it naturally, so iPhone looked fine.
                    // Keeping the bubble a plain column child (as it was pre-#245)
                    // restores natural text measurement; the ✕ floats over the
                    // empty gutter just left of the bubble and steals no layout
                    // space. The wrapper shrink-wraps to the bubble, so left:-27
                    // tracks the bubble's (dynamic, right-aligned) left edge.
                    <View style={{ position: 'relative', alignSelf: 'flex-end' }}>
                      {bubble}
                      <Pressable
                        onPress={() => onDeleteMsg(msg)}
                        hitSlop={10}
                        accessibilityLabel={t('chat.message.deleteAction')}
                        style={{
                          position: 'absolute',
                          left: -27,
                          top: 0,
                          bottom: 0,
                          width: 23,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <X size={15} color={theme.colors.muted} strokeWidth={2} />
                      </Pressable>
                    </View>
                  ) : (
                    bubble
                  )}
                  {!mine && msg.flagged && (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        marginTop: 4,
                        maxWidth: '80%',
                        backgroundColor: theme.colors.warning + '22',
                        borderRadius: 10,
                        paddingHorizontal: 9,
                        paddingVertical: 6,
                      }}
                    >
                      <Flag size={13} color={theme.colors.warning} strokeWidth={2} />
                      <Text style={{ flex: 1, fontSize: 11.5, color: theme.colors.text2, lineHeight: 16 }}>
                        {t('chat.scamWarning')}
                      </Text>
                    </View>
                  )}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        justifyContent: mine ? 'flex-end' : 'flex-start',
                        gap: 4,
                        marginTop: 3,
                        maxWidth: '80%',
                      }}
                    >
                      {Object.entries<string[]>(msg.reactions).map(([emoji, ids]) => {
                        const reactedByMe = !!me?.id && ids.includes(me.id);
                        return (
                          <Pressable
                            key={emoji}
                            onPress={() => onReact(msg, emoji)}
                            onLongPress={() => setWhoReactedFor({ msg, emoji })}
                            delayLongPress={300}
                            hitSlop={4}
                            style={[
                              styles.reactionPill,
                              {
                                backgroundColor: reactedByMe
                                  ? theme.colors.primarySoft
                                  : theme.colors.surface2,
                                borderColor: reactedByMe
                                  ? theme.colors.primary
                                  : theme.colors.line,
                              },
                            ]}
                          >
                            <Text style={{ fontSize: 13 }}>{emoji}</Text>
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: '600',
                                color: reactedByMe
                                  ? theme.colors.primaryDeep
                                  : theme.colors.text2,
                              }}
                            >
                              {ids.length}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
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
                </SwipeToReply>
              );
            }}
            // Inverted list: ListHeaderComponent renders at the VISUAL BOTTOM,
            // which is where the typing indicator belongs (below newest msg).
            ListHeaderComponent={
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

        {/* Conversation starters (ICE1) — only on an empty chat. */}
        {showIcebreakers && otherId && (
          <IcebreakerCard otherUserId={otherId} onPick={(text) => onComposeChange(text)} />
        )}

        {/* Composer */}
        <ChatComposer
          value={composing}
          onChangeText={onComposeChange}
          onSend={onSend}
          onPickPhotoFromLibrary={pickGallery}
          onTakePhoto={pickCamera}
          onVoiceRecorded={(uri, durationMs) => sendVoiceFromUri(uri, durationMs)}
          onOpenStickers={() => setShowStickers((s) => !s)}
          placeholder={t('chats.detail.messagePlaceholder')}
          replyTo={
            replyingTo
              ? {
                  id: replyingTo.id,
                  name:
                    senderIdOf(replyingTo) === myId
                      ? t('chats.detail.you')
                      : thread?.user.nickname,
                  text: replyPreviewText(replyingTo),
                }
              : null
          }
          onCancelReply={() => setReplyingTo(null)}
          editing={
            editingMsg ? { id: editingMsg.id, preview: editingMsg.content } : null
          }
          onCancelEdit={() => {
            setEditingMsg(null);
            setComposing('');
          }}
        />
      </KeyboardAvoidingView>

      {/* Premium upsell — shown when a free user swipes to edit a message. */}
      <UpgradePremiumSheet
        open={!!upsellReason}
        onClose={() => setUpsellReason(null)}
        reason={upsellReason ?? undefined}
      />

      {/* Long-press message menu + "+" emoji picker REMOVED (Build 76): both were
          the reactions-add entry (the long-press sheet was reactions-ONLY), now
          gone on both platforms. Existing reactions still render + stay tappable
          under each bubble; the who-reacted sheet (below) still works. */}

      {/* Who-reacted list. 1-on-1 chat has only two participants, so every
          userId resolves to me or the other person — no extra lookups. */}
      <Sheet
        open={!!whoReactedFor}
        onClose={() => setWhoReactedFor(null)}
        maxHeight="45%"
      >
        {whoReactedFor && (
          <>
            <Text style={[styles.pickerTitle, { color: theme.colors.text }]}>
              {whoReactedFor.emoji}{'  '}
              {t('chat.reactions.who', {
                count: whoReactedFor.msg.reactions?.[whoReactedFor.emoji]?.length ?? 0,
              })}
            </Text>
            {(whoReactedFor.msg.reactions?.[whoReactedFor.emoji] ?? []).map((uid) => {
              const isMe = uid === me?.id;
              const name = isMe
                ? t('chats.detail.you')
                : thread?.user.nickname ?? '';
              const avatarUri = isMe ? me?.avatarUrl : thread?.user.avatarUrl;
              return (
                <View key={uid} style={styles.whoRow}>
                  <Avatar
                    name={name}
                    uri={avatarUri ?? undefined}
                    avatarIdx={idxFor(uid)}
                    size={36}
                  />
                  {isMe ? (
                    <Text style={{ fontSize: 15, color: theme.colors.text }}>
                      {name}
                    </Text>
                  ) : (
                    <NameWithBadge
                      name={name}
                      official={thread?.user.isOfficial}
                      verified={thread?.user.isVerified}
                      premium={thread?.user.isPremium}
                      badgeSize={14}
                      textStyle={{ fontSize: 15, color: theme.colors.text }}
                    />
                  )}
                </View>
              );
            })}
          </>
        )}
      </Sheet>

      {/* Inline edit replaces the old edit sheet — see the composer's "Editing …"
          chip (driven by `editingMsg`). */}

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

      {/* VVVV — preview + confirm before a picked photo is actually sent. */}
      <PhotoConfirmModal
        uri={pendingPhoto}
        open={pendingPhoto !== null}
        onCancel={() => setPendingPhoto(null)}
        onSend={confirmSendPhoto}
      />
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
    // zIndex orders RN's own sibling layout so the header sits above the inverted
    // messages list. NO `elevation` here: on Android elevation paints a Material
    // drop shadow on ALL FOUR sides, which reads as a dark rectangular outline
    // boxing the whole header (the user-reported Android-only outline; iOS ignores
    // elevation so it never showed there). The "..." safety-menu tap is handled by
    // the native Alert.alert path (#245), not by raising the header's z-order, so
    // dropping elevation costs nothing. (Build 74 fix, lost when Build 75/76 cut
    // off origin/main where PR #250 never merged — re-applied in Build 76.)
    zIndex: 10,
  },
  // Reaction pill shown under a message bubble.
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 11,
    borderWidth: 1,
  },
  // Quick-reaction emoji row at the top of the long-press action sheet.
  reactionPickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  reactionPickerEmoji: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  emojiGridCell: {
    width: '12.5%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
