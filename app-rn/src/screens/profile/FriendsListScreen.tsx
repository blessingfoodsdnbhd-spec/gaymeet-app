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
import { SortChipRow } from '../../components/SortChipRow';
import { sortList } from '../../utils/listSort';
import { useListSortPrefs } from '../../store/listSortPrefs';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { getFollowing, getFollowers, type FollowedUser } from '../../api/me';
import { toggleFollow } from '../../api/follows';
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

  // 关注 (following — people I follow) vs 粉丝 (followers — people who follow me).
  // Previously this screen showed following only, so tapping 关注 with nobody
  // followed looked like nothing happened.
  const [tab, setTab] = React.useState<'following' | 'followers'>('following');

  const friendsQ = useQuery({
    queryKey: ['me', tab, myId],
    queryFn: () => (tab === 'following' ? getFollowing(myId!) : getFollowers(myId!)),
    enabled: !!myId,
    staleTime: 60_000,
  });

  const sortKey = useListSortPrefs((s) => s.sort.following);
  const setSort = useListSortPrefs((s) => s.setSort);
  const sortOptions = [
    { key: 'recent', label: t('sort.followTime') },
    { key: 'distance', label: t('sort.distance') },
    { key: 'age', label: t('sort.age') },
    { key: 'active', label: t('sort.active') },
  ];
  const data = React.useMemo(
    () =>
      sortList(friendsQ.data ?? [], sortKey, {
        distanceM: (u) => u.distanceM,
        dob: (u) => u.dob,
        lastActive: (u) => u.lastActiveAt,
      }),
    [friendsQ.data, sortKey],
  );

  // Follow/unfollow directly from a row. In 关注 (following) an unfollow removes
  // the row; in 粉丝 (followers) it just flips the follow-back pill (they still
  // follow me, so the row stays). Optimistic, reverts on error.
  const onTogglePill = (u: FollowedUser) => {
    const key = ['me', tab, myId];
    const doToggle = () => {
      if (tab === 'following') {
        queryClient.setQueryData<FollowedUser[]>(key, (prev) =>
          (prev ?? []).filter((x) => x._id !== u._id),
        );
      } else {
        queryClient.setQueryData<FollowedUser[]>(key, (prev) =>
          (prev ?? []).map((x) => (x._id === u._id ? { ...x, isFollowing: !x.isFollowing } : x)),
        );
      }
      toggleFollow(u._id).catch(() => queryClient.invalidateQueries({ queryKey: key }));
      queryClient.invalidateQueries({ queryKey: ['me', 'stats'] });
    };
    // Confirm only when removing a follow; following back is a single tap.
    const isUnfollow = tab === 'following' || u.isFollowing;
    if (isUnfollow) {
      Alert.alert(t('about.unfollowConfirm'), '', [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('about.unfollowAction'), style: 'destructive', onPress: doToggle },
      ]);
    } else {
      doToggle();
    }
  };

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

      {/* 关注 (following) / 粉丝 (followers) toggle. */}
      <View style={[styles.tabRow, { borderBottomColor: theme.colors.line }]}>
        {(['following', 'followers'] as const).map((k) => {
          const active = tab === k;
          return (
            <Pressable key={k} onPress={() => setTab(k)} style={styles.tabBtn}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: active ? '700' : '500',
                  color: active ? theme.colors.primary : theme.colors.muted,
                }}
              >
                {t(k === 'following' ? 'friends.tabFollowing' : 'friends.tabFollowers')}
              </Text>
              {active && (
                <View style={[styles.tabUnderline, { backgroundColor: theme.colors.primary }]} />
              )}
            </Pressable>
          );
        })}
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
          data={data}
          keyExtractor={(u) => u._id}
          contentContainerStyle={{ paddingVertical: 4 }}
          ListHeaderComponent={
            data.length > 0 ? (
              <SortChipRow options={sortOptions} active={sortKey} onChange={(k) => setSort('following', k as any)} />
            ) : null
          }
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
            <FriendRow
              user={item}
              onPress={() => nav.navigate('UserDetail', { userId: item._id })}
              // 关注 tab: every row is followed → "已关注". 粉丝 tab: pill reflects
              // whether I follow them back.
              following={tab === 'following' ? true : !!item.isFollowing}
              onTogglePill={() => onTogglePill(item)}
            />
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

function FriendRow({
  user,
  onPress,
  following,
  onTogglePill,
}: {
  user: FollowedUser;
  onPress: () => void;
  following: boolean;
  onTogglePill: () => void;
}) {
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
      {/* Direct follow/unfollow. Nested Pressable so the row's onPress (→ profile)
          doesn't also fire when the pill is tapped. following → "已关注" (filled);
          not following (粉丝 tab) → "关注回去" (outlined). */}
      <Pressable
        onPress={onTogglePill}
        hitSlop={6}
        style={[
          styles.pill,
          following
            ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
            : { backgroundColor: 'transparent', borderColor: theme.colors.primary },
        ]}
      >
        <Text
          style={{
            fontSize: 12.5,
            fontWeight: '600',
            color: following ? '#FFFFFF' : theme.colors.primary,
          }}
        >
          {following ? t('about.following') : t('friends.followBack')}
        </Text>
      </Pressable>
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
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    width: 40,
    borderRadius: 1,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
});
