import React from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { TopBar, IconButton } from '../../components/TopBar';
import { Avatar } from '../../components/Avatar';
import { RoleDot } from '../../components/RoleDot';
import { useTheme } from '../../theme/ThemeProvider';
import {
  getLeaderboardRooms,
  getLeaderboardUsers,
  type LeaderboardRoomEntry,
  type LeaderboardUserEntry,
} from '../../api/plaza';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Tab = 'rooms' | 'users';

const REFRESH_MS = 5 * 60 * 1000; // snapshot refreshes every 5 min

function medal(rank: number): string {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
}

export function PlazaLeaderboardScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const nav = useNavigation<Nav>();
  const lang = i18n.language?.startsWith('zh') ? 'zh' : 'en';
  const [tab, setTab] = React.useState<Tab>('rooms');

  const roomsQ = useQuery({
    queryKey: ['plaza', 'leaderboard', 'rooms'],
    queryFn: () => getLeaderboardRooms('today'),
    refetchInterval: REFRESH_MS,
    staleTime: REFRESH_MS,
  });
  const usersQ = useQuery({
    queryKey: ['plaza', 'leaderboard', 'users'],
    queryFn: () => getLeaderboardUsers('today'),
    refetchInterval: REFRESH_MS,
    staleTime: REFRESH_MS,
  });

  const loading = tab === 'rooms' ? roomsQ.isLoading : usersQ.isLoading;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <TopBar
        title={t('plaza.leaderboard.title')}
        subtitle={t('plaza.leaderboard.subtitle')}
        left={
          <IconButton onPress={() => nav.goBack()}>
            <ChevronLeft size={24} color={theme.colors.text} />
          </IconButton>
        }
      />

      {/* Tab switch */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
        {(['rooms', 'users'] as Tab[]).map((k) => {
          const active = tab === k;
          return (
            <Pressable
              key={k}
              onPress={() => setTab(k)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 18,
                borderRadius: 999,
                backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                borderWidth: active ? 0 : 1,
                borderColor: theme.colors.line,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: active ? '#fff' : theme.colors.text }}>
                {k === 'rooms' ? t('plaza.leaderboard.tabRooms') : t('plaza.leaderboard.tabUsers')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : tab === 'rooms' ? (
        <FlatList
          data={roomsQ.data ?? []}
          keyExtractor={(r) => r.roomId}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 28 }}
          refreshing={roomsQ.isRefetching}
          onRefresh={() => roomsQ.refetch()}
          ListEmptyComponent={
            <Text style={{ color: theme.colors.muted, textAlign: 'center', marginTop: 40 }}>
              {t('plaza.leaderboard.empty')}
            </Text>
          }
          renderItem={({ item }: { item: LeaderboardRoomEntry }) => (
            <Pressable
              onPress={() =>
                nav.navigate('WorldChatRoom', { roomId: item.roomId, title: `${item.flag} ${item.label[lang]}` })
              }
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: theme.colors.line,
                borderRadius: 16,
                padding: 14,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Text style={{ fontSize: 18, fontWeight: '800', width: 30, textAlign: 'center', color: theme.colors.text }}>
                {medal(item.rank)}
              </Text>
              <Text style={{ fontSize: 28 }}>{item.flag}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text }}>{item.label[lang]}</Text>
                <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>
                  {t('plaza.leaderboard.roomMeta', { messages: item.messages, speakers: item.speakers })}
                </Text>
              </View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.online }}>
                🟢 {item.onlineCount}
              </Text>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={usersQ.data ?? []}
          keyExtractor={(u) => u.user.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 28 }}
          refreshing={usersQ.isRefetching}
          onRefresh={() => usersQ.refetch()}
          ListEmptyComponent={
            <Text style={{ color: theme.colors.muted, textAlign: 'center', marginTop: 40 }}>
              {t('plaza.leaderboard.empty')}
            </Text>
          }
          renderItem={({ item }: { item: LeaderboardUserEntry }) => (
            <Pressable
              onPress={() => nav.navigate('UserDetail', { userId: item.user.id })}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: theme.colors.line,
                borderRadius: 16,
                padding: 14,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Text style={{ fontSize: 18, fontWeight: '800', width: 30, textAlign: 'center', color: theme.colors.text }}>
                {medal(item.rank)}
              </Text>
              <Avatar name={item.user.nickname} uri={item.user.avatarUrl} size={42} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <RoleDot tag={item.user.roleTag} hideNormal />
                  <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text }}>
                    {item.user.nickname}
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>
                  {item.source === 'ticket'
                    ? t('plaza.leaderboard.ticketMeta', { n: item.ticketCount })
                    : t('plaza.leaderboard.popularMeta', { n: item.user.popularityScore ?? 0 })}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
