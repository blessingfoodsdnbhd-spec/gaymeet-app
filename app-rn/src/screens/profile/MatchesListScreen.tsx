import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { getConversations, type ChatThread } from '../../api/chats';
import { shortTime } from '../../utils/time';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function idxFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 10;
}

/**
 * "Matches" — list of users the current user has matched with. Reuses
 * /api/conversations for the data (which already resolves the OTHER user
 * per thread and includes matchedAt), but filters to source === 'match'
 * to exclude one-sided DMs.
 *
 * Tap a row → ChatDetail.
 */
export function MatchesListScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();

  const threadsQ = useQuery({
    queryKey: ['chats', 'list'],
    queryFn: getConversations,
    staleTime: 30_000,
  });

  const matches = useMemo(
    () => (threadsQ.data ?? []).filter((t) => t.source === 'match'),
    [threadsQ.data],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ marginLeft: 8, fontSize: 16, fontWeight: '600', color: theme.colors.text }}>
          {t('profile.stats.matches')}
        </Text>
      </View>

      {threadsQ.isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : threadsQ.isError ? (
        <View style={styles.centerFill}>
          <Text style={{ color: theme.colors.muted, marginBottom: 12 }}>
            {t('moments.loadFailed')}
          </Text>
          <Button label={t('common.retry')} variant="soft" onPress={() => threadsQ.refetch()} />
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(m) => m.matchId}
          contentContainerStyle={{ paddingVertical: 4 }}
          ItemSeparatorComponent={() => (
            <View
              style={{
                height: StyleSheet.hairlineWidth,
                backgroundColor: theme.colors.line,
                marginLeft: 76,
              }}
            />
          )}
          renderItem={({ item }) => (
            <MatchRow
              thread={item}
              onPress={() => nav.navigate('ChatDetail', { chatId: item.matchId })}
            />
          )}
          ListEmptyComponent={
            <View style={styles.centerFill}>
              <Text style={{ color: theme.colors.muted, textAlign: 'center' }}>
                {t('profile.matchesList.empty')}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function MatchRow({ thread, onPress }: { thread: ChatThread; onPress: () => void }) {
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
        paddingVertical: 12,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Avatar
        name={thread.user.nickname}
        uri={thread.user.avatarUrl}
        avatarIdx={idxFor(thread.user.id)}
        size={48}
        showOnline={thread.user.isOnline}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.text }}>
          {thread.user.nickname}
        </Text>
        <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>
          {shortTime(thread.matchedAt)} {t('profile.matchesList.matchedSuffix')}
        </Text>
      </View>
      {thread.unreadCount > 0 && (
        <View
          style={{
            minWidth: 20,
            height: 20,
            borderRadius: 10,
            paddingHorizontal: 6,
            backgroundColor: theme.colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
            {thread.unreadCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 28,
  },
});
