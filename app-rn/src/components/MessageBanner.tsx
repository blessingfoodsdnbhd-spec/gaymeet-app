import React, { useEffect, useState, useRef } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { useQueryClient } from '@tanstack/react-query';

import { useTheme } from '../theme/ThemeProvider';
import { Avatar } from './Avatar';
import { useAuth } from '../store/auth';
import { useChats } from '../store/chats';
import { on as wsOn, type WsChatReceive } from '../api/ws';
import type { ChatThread } from '../api/chats';
import type { RootStackParamList } from '../navigation/types';

interface Banner {
  matchId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string | null;
  preview: string;
}

function idxFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 10;
}

/**
 * Listens for `chat:receive` WS events anywhere in the app. When the message
 * is FROM someone else AND the user is not currently viewing that thread,
 * shows a top banner with the sender's avatar + name + message preview.
 * Auto-dismisses after 4 seconds, or on tap to open the thread.
 */
export function MessageBanner() {
  const theme = useTheme();
  const nav = useNavigation<NavigationProp<RootStackParamList>>();
  const me = useAuth((s) => s.user);
  const focusedMatchId = useChats((s) => s.focusedMatchId);
  const threads = useChats((s) => s.threads);
  const setThreads = useChats((s) => s.setThreads);
  const queryClient = useQueryClient();
  const [banner, setBanner] = useState<Banner | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ty = useSharedValue(-120);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!me) return;
    let unsub: (() => void) | null = null;
    let cancelled = false;

    wsOn('chat:receive', (msg: WsChatReceive) => {
      if (cancelled) return;

      // Bump the relevant thread to the top of the chats list and freshen
      // its lastMessage / lastMessageAt, regardless of whose echo it is —
      // both sender and receiver want their list re-ordered.
      const isMine = msg.senderId === me.id;
      const bump = (list: ChatThread[]) => {
        const idx = list.findIndex((t) => t.matchId === msg.matchId);
        if (idx === -1) return list;
        const thread = list[idx];
        const updated: ChatThread = {
          ...thread,
          lastMessage:
            msg.type === 'sticker' ? msg.content : msg.content.slice(0, 100),
          lastMessageAt: msg.createdAt,
          unreadCount:
            !isMine && focusedMatchId !== msg.matchId
              ? thread.unreadCount + 1
              : thread.unreadCount,
        };
        return [updated, ...list.filter((_, i) => i !== idx)];
      };
      queryClient.setQueryData<ChatThread[]>(['chats', 'list'], (prev) =>
        prev ? bump(prev) : prev,
      );
      setThreads(bump(threads));

      // Ignore my own echo for the banner. Skip if user is already in
      // that thread.
      if (isMine) return;
      if (focusedMatchId === msg.matchId) return;

      const thread = threads.find((t) => t.matchId === msg.matchId);
      const preview =
        msg.type === 'sticker'
          ? msg.content // single emoji
          : msg.content.length > 60
            ? msg.content.slice(0, 60) + '…'
            : msg.content;

      setBanner({
        matchId: msg.matchId,
        senderId: msg.senderId,
        senderName: thread?.user.nickname ?? '新消息',
        senderAvatarUrl: thread?.user.avatarUrl,
        preview,
      });
    }).then((u) => {
      unsub = u;
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [me, focusedMatchId, threads]);

  // Animate in/out when banner changes
  useEffect(() => {
    if (banner) {
      ty.value = withTiming(0, { duration: 280, easing: Easing.bezier(0.2, 0.7, 0.2, 1) });
      opacity.value = withTiming(1, { duration: 200 });
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      dismissTimer.current = setTimeout(() => dismiss(), 4000);
    }
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banner]);

  const dismiss = () => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
    opacity.value = withTiming(0, { duration: 180 });
    ty.value = withTiming(
      -120,
      { duration: 220, easing: Easing.bezier(0.4, 0, 1, 1) },
      (finished) => {
        if (finished) runOnJS(setBanner)(null);
      },
    );
  };

  const onTap = () => {
    if (!banner) return;
    const target = banner.matchId;
    dismiss();
    // Open the chat after a small delay so the animation reads cleanly
    setTimeout(() => {
      nav.navigate('ChatDetail', { chatId: target });
    }, 60);
  };

  const aStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));

  if (!banner) return null;

  return (
    <Animated.View style={[styles.wrap, aStyle]} pointerEvents="box-none">
      <SafeAreaView edges={['top']} style={{ width: '100%' }}>
        <Pressable
          onPress={onTap}
          style={({ pressed }) => [
            styles.banner,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.line,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
            theme.shadows.card,
          ]}
        >
          <Avatar
            name={banner.senderName}
            uri={banner.senderAvatarUrl}
            avatarIdx={idxFor(banner.senderId)}
            size={40}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{
                color: theme.colors.text,
                fontSize: 14,
                fontWeight: '600',
              }}
            >
              {banner.senderName}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                color: theme.colors.text2,
                fontSize: 13,
                marginTop: 2,
              }}
            >
              {banner.preview}
            </Text>
          </View>
        </Pressable>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
});
