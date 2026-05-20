import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Search, Flame } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { TopBar, IconButton } from '../../components/TopBar';
import { Avatar } from '../../components/Avatar';
import { getConversations, type ChatThread } from '../../api/chats';
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
  const [q, setQ] = useState('');

  const threadsQ = useQuery({
    queryKey: ['chats', 'list'],
    queryFn: getConversations,
    staleTime: 30_000,
  });

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <TopBar
        title={t('tabs.chats')}
        right={
          <>
            <IconButton>
              <Search size={18} color={theme.colors.text} strokeWidth={1.6} />
            </IconButton>
            <IconButton>
              <Plus size={18} color={theme.colors.text} strokeWidth={1.6} />
            </IconButton>
          </>
        }
      />

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
            placeholder="搜索"
            placeholderTextColor={theme.colors.muted}
            style={{ flex: 1, fontSize: 14, color: theme.colors.text, padding: 0 }}
          />
        </View>
      </View>

      {threadsQ.isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t) => t.matchId}
          ListHeaderComponent={
            newMatches.length > 0 ? (
              <NewMatchesStrip
                threads={newMatches}
                onTap={(th) => openThread(th)}
              />
            ) : null
          }
          renderItem={({ item }) => (
            <ThreadRow thread={item} onPress={() => openThread(item)} />
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
            <View style={styles.centerFill}>
              <Text style={{ color: theme.colors.muted, fontSize: 14 }}>
                还没有消息 — 去发现 tab 找同频的人吧
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
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
        新密友 · {threads.length}
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
            <Text
              numberOfLines={1}
              style={{
                fontSize: 11,
                color: theme.colors.text,
                marginTop: 6,
                maxWidth: 60,
              }}
            >
              {th.user.nickname}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function ThreadRow({
  thread,
  onPress,
}: {
  thread: ChatThread;
  onPress: () => void;
}) {
  const theme = useTheme();
  const time = thread.lastMessageAt
    ? sameDay(thread.lastMessageAt)
      ? hhmm(thread.lastMessageAt)
      : shortTime(thread.lastMessageAt)
    : '';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        gap: 12,
        backgroundColor: pressed ? theme.colors.surface2 : 'transparent',
      })}
    >
      <Avatar
        name={thread.user.nickname}
        uri={thread.user.avatarUrl}
        avatarIdx={idxFor(thread.user.id)}
        size={52}
        showOnline={thread.user.isOnline}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontSize: 15,
              fontWeight: '600',
              color: theme.colors.text,
            }}
          >
            {thread.user.nickname}
          </Text>
          {thread.source === 'match' && (
            <Flame size={13} color={theme.colors.primary} fill={theme.colors.primary} />
          )}
          <Text style={{ fontSize: 12, color: theme.colors.muted }}>{time}</Text>
        </View>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 13,
            color: theme.colors.text2,
            marginTop: 4,
          }}
        >
          {thread.lastMessage || '说声你好吧 →'}
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
