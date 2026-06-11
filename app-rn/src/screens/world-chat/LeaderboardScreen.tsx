import React from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { TopBar, IconButton } from '../../components/TopBar';
import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import { RoleDot } from '../../components/RoleDot';
import { getRoomLeaderboard, getUserLeaderboard } from '../../api/plaza';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const REFRESH_MS = 5 * 60 * 1000; // board refreshes every 5 min

/** 🏆 今日热门 — daily hot rooms + most-active users (Plaza Phase 3). */
export function LeaderboardScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const nav = useNavigation<Nav>();
  const lang = (i18n.language?.startsWith('zh') ? 'zh' : 'en') as 'zh' | 'en';

  const roomsQ = useQuery({
    queryKey: ['plaza', 'leaderboard', 'rooms'],
    queryFn: () => getRoomLeaderboard('today'),
    refetchInterval: REFRESH_MS,
    staleTime: REFRESH_MS,
  });
  const usersQ = useQuery({
    queryKey: ['plaza', 'leaderboard', 'users'],
    queryFn: () => getUserLeaderboard('today'),
    refetchInterval: REFRESH_MS,
    staleTime: REFRESH_MS,
  });

  const loading = roomsQ.isLoading || usersQ.isLoading;
  const rooms = (roomsQ.data?.rooms ?? []).filter((r) => r.onlineCount > 0).slice(0, 8);
  const users = usersQ.data?.users ?? [];

  const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <TopBar
        title={t('plaza.todayHot')}
        left={<IconButton onPress={() => nav.goBack()}><ChevronLeft size={24} color={theme.colors.text} /></IconButton>}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.userId}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          ListHeaderComponent={
            <View>
              {/* Hot rooms */}
              <Text style={[styles.section, { color: theme.colors.muted }]}>{t('plaza.hotChannels')}</Text>
              {rooms.length === 0 ? (
                <Text style={{ color: theme.colors.muted, marginBottom: 18 }}>{t('plaza.noActivity')}</Text>
              ) : (
                <View style={{ marginBottom: 22, gap: 8 }}>
                  {rooms.map((r) => (
                    <Pressable
                      key={r.id}
                      onPress={() =>
                        r.kind === 'builtin'
                          ? nav.navigate('CountryRooms', { countryCode: r.id, title: `${r.flag} ${r.label[lang]}` })
                          : nav.navigate('WorldChatRoom', { roomId: r.id, title: r.label[lang], custom: true })
                      }
                      style={({ pressed }) => [
                        styles.roomRow,
                        { backgroundColor: theme.colors.surface, borderColor: theme.colors.line, opacity: pressed ? 0.9 : 1 },
                      ]}
                    >
                      <Text style={{ fontSize: 22 }}>🔥</Text>
                      <Text style={{ fontSize: 24 }}>{r.flag}</Text>
                      <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: theme.colors.text }} numberOfLines={1}>
                        {r.label[lang]}
                      </Text>
                      <Text style={{ fontSize: 13, color: theme.colors.online, fontWeight: '700' }}>
                        {t('worldChat.online', { n: r.onlineCount })}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <Text style={[styles.section, { color: theme.colors.muted }]}>{t('plaza.todayActive')}</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => nav.navigate('UserDetail', { userId: item.userId })}
              style={({ pressed }) => [
                styles.userRow,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.line, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <Text style={[styles.rank, { color: item.rank <= 3 ? theme.colors.text : theme.colors.muted }]}>
                {medal(item.rank)}
              </Text>
              <Avatar name={item.nickname} uri={item.avatarUrl} size={36} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 }}>
                <RoleDot role={item.role} size={8} />
                <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.text }} numberOfLines={1}>
                  {item.nickname}
                </Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: '800', color: theme.colors.primary }}>+{item.xp} XP</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={{ color: theme.colors.muted, textAlign: 'center', marginTop: 8 }}>{t('plaza.noActivity')}</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  section: { fontSize: 12, letterSpacing: 0.7, textTransform: 'uppercase', fontWeight: '700', marginBottom: 12 },
  roomRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  rank: { width: 26, textAlign: 'center', fontSize: 15, fontWeight: '800' },
});
