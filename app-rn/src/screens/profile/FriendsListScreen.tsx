import React from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useTheme } from '../../theme/ThemeProvider';
import { useAuth } from '../../store/auth';
import { EmptyState } from '../../components/EmptyState';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { getFollowing, type FollowedUser } from '../../api/me';
import { openConversation } from '../../api/chats';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function idxFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 10;
}

/**
 * "Friends" — list of users the current user follows. Tapping a row
 * opens (or creates) a conversation with that user, mirroring the
 * existing DiscoverScreen.openIntroChat flow.
 */
export function FriendsListScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const me = useAuth((s) => s.user);
  const queryClient = useQueryClient();

  const myId = me?.id;

  const friendsQ = useQuery({
    queryKey: ['me', 'following', myId],
    queryFn: () => getFollowing(myId!),
    enabled: !!myId,
    staleTime: 60_000,
  });

  const openWith = async (user: FollowedUser) => {
    try {
      const res = await openConversation(user._id);
      queryClient.invalidateQueries({ queryKey: ['chats', 'list'] });
      nav.navigate('ChatDetail', { chatId: res.matchId });
    } catch (e: any) {
      const status = e?.response?.status;
      const body = e?.response?.data;
      // 402 = backend says this opening requires Premium (user isn't matched
      // with the friend yet and isn't a Premium subscriber).
      if (status === 402 && body?.reason === 'premium_required') {
        const monthly = body?.pricing?.monthly?.price ?? 39.9;
        const annual = body?.pricing?.annual?.price ?? 399.9;
        Alert.alert(
          t('discover.premiumTitle'),
          t('discover.premiumBody', { monthly, annual }),
          [{ text: t('discover.premiumOk') }],
        );
      } else {
        Alert.alert(
          t('discover.openFailedTitle'),
          body?.error || e?.message || t('discover.openFailedFallback'),
        );
      }
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ marginLeft: 8, fontSize: 16, fontWeight: '600', color: theme.colors.text }}>
          {t('profile.stats.friends')}
        </Text>
      </View>

      {friendsQ.isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : friendsQ.isError ? (
        <View style={styles.centerFill}>
          <Text style={{ color: theme.colors.muted, marginBottom: 12 }}>
            {t('moments.loadFailed')}
          </Text>
          <Button label={t('common.retry')} variant="soft" onPress={() => friendsQ.refetch()} />
        </View>
      ) : (
        <FlatList
          data={friendsQ.data ?? []}
          keyExtractor={(u) => u._id}
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
            <FriendRow user={item} onPress={() => openWith(item)} />
          )}
          ListEmptyComponent={
            <EmptyState
              emoji="🫂"
              title={t('empty.friends.title')}
              subtitle={t('empty.friends.subtitle')}
              primaryLabel={t('empty.friends.cta')}
              onPrimary={() => nav.navigate('Main', { screen: 'WorldChat' })}
              secondaryLabel={t('empty.friends.cta2')}
              onSecondary={() => nav.navigate('Main', { screen: 'Discover' })}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

function FriendRow({ user, onPress }: { user: FollowedUser; onPress: () => void }) {
  const theme = useTheme();
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
        name={user.nickname}
        uri={user.avatarUrl}
        avatarIdx={idxFor(user._id)}
        size={48}
        showOnline={user.isOnline}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.text }}>
          {user.nickname}
        </Text>
        {user.isPremium && (
          <Text style={{ fontSize: 11.5, color: theme.colors.muted, marginTop: 2 }}>
            Premium
          </Text>
        )}
      </View>
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
