import React from 'react';
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Search, Crown } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import { NameWithBadge } from '../../components/NameWithBadge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { useAuth } from '../../store/auth';
import { useUserActionSheet } from '../../utils/useUserActionSheet';
import { getRoomMembers, type RoomMember } from '../../api/worldChat';
import { getFollowing } from '../../api/me';
import { toggleFollow } from '../../api/follows';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'OnlineUsersList'>;
type Tab = 'online' | 'offline' | 'following';

function lastActiveMs(m: RoomMember) {
  const t = m.lastActiveAt ? Date.parse(m.lastActiveAt) : 0;
  return Number.isFinite(t) ? t : 0;
}

/**
 * v3.1.8 在线人数 redesign — the full-screen "查看全部" online-users list,
 * reached from the avatar strip's 👁 N pill (a real Screen, NOT a Modal/Sheet,
 * to avoid the vc115/117 sheet touch bugs). Three tabs (在线 / 离线 / 你关注的),
 * search, FlatList-virtualized for large rooms. Row tap → the shared user action
 * sheet (查看资料 / 添加好友 / 发私信).
 */
export function OnlineUsersListScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const { roomId, roomTitle } = useRoute<Rt>().params;
  const me = useAuth((s) => s.user);
  const myId = String((me as any)?.id ?? (me as any)?._id ?? '');
  const openUserActions = useUserActionSheet();

  const [tab, setTab] = React.useState<Tab>('online');
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');

  const membersQ = useQuery({
    queryKey: ['worldChat', 'roomMembers', roomId],
    queryFn: () => getRoomMembers(roomId),
    staleTime: 15_000,
    select: (d) => d.members,
  });
  const followingQ = useQuery({
    queryKey: ['users', 'following', myId],
    queryFn: () => getFollowing(myId),
    enabled: !!myId,
    staleTime: 60_000,
  });

  // Locally-toggled follows so the 关注 button flips instantly without a refetch.
  const [followedOverride, setFollowedOverride] = React.useState<Record<string, boolean>>({});
  const baseFollowed = React.useMemo(
    () => new Set((followingQ.data ?? []).map((f) => f._id)),
    [followingQ.data],
  );
  const isFollowed = (id: string) =>
    followedOverride[id] ?? baseFollowed.has(id);

  const members = membersQ.data ?? [];

  const rank = React.useCallback(
    (m: RoomMember) => {
      if (m.id === myId) return 0;
      if (m.isCreator) return 1;
      if (isFollowed(m.id)) return 2;
      return 3;
    },
    [myId, followedOverride, baseFollowed], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const list = React.useMemo(() => {
    let arr = members;
    if (tab === 'online') arr = members.filter((m) => m.isOnline);
    else if (tab === 'offline') arr = members.filter((m) => !m.isOnline);
    else arr = members.filter((m) => isFollowed(m.id));
    const sorted = [...arr].sort((a, b) => {
      // 你关注的 tab: online first, then recency. Others: priority then recency.
      if (tab === 'following' && a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      const r = rank(a) - rank(b);
      if (r !== 0) return r;
      return lastActiveMs(b) - lastActiveMs(a);
    });
    const q = query.trim().toLowerCase();
    return q ? sorted.filter((m) => (m.displayName || '').toLowerCase().includes(q)) : sorted;
  }, [members, tab, query, rank]); // eslint-disable-line react-hooks/exhaustive-deps

  const onFollow = async (id: string) => {
    setFollowedOverride((p) => ({ ...p, [id]: true })); // optimistic
    try {
      const { following } = await toggleFollow(id);
      setFollowedOverride((p) => ({ ...p, [id]: following }));
    } catch {
      setFollowedOverride((p) => ({ ...p, [id]: false }));
    }
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: 'online', label: t('worldChat.onlineList.tabOnline') },
    { key: 'offline', label: t('worldChat.onlineList.tabOffline') },
    { key: 'following', label: t('worldChat.onlineList.tabFollowing') },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={styles.iconBtn}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 17, fontWeight: '800', color: theme.colors.text }}>
          {roomTitle || t('worldChat.onlineList.title')}
        </Text>
        <Pressable onPress={() => setSearchOpen((v) => !v)} hitSlop={8} style={styles.iconBtn}>
          <Search size={22} color={searchOpen ? theme.colors.primary : theme.colors.text} />
        </Pressable>
      </View>

      {searchOpen && (
        <View style={{ paddingHorizontal: theme.spacing.l, paddingVertical: theme.spacing.s }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoFocus
            placeholder={t('worldChat.onlineList.searchPlaceholder')}
            placeholderTextColor={theme.colors.muted}
            style={{
              backgroundColor: theme.colors.surface2,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 10,
              fontSize: 15,
              color: theme.colors.text,
            }}
          />
        </View>
      )}

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: theme.colors.line }]}>
        {TABS.map((tb) => {
          const active = tab === tb.key;
          return (
            <Pressable key={tb.key} onPress={() => setTab(tb.key)} style={styles.tab}>
              <Text style={{ fontSize: 14.5, fontWeight: active ? '800' : '600', color: active ? theme.colors.primary : theme.colors.text2 }}>
                {tb.label}
              </Text>
              {active && <View style={[styles.tabUnderline, { backgroundColor: theme.colors.primary }]} />}
            </Pressable>
          );
        })}
      </View>

      {membersQ.isLoading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingVertical: 6 }}
          initialNumToRender={15}
          windowSize={11}
          renderItem={({ item }) => {
            const self = item.id === myId;
            const followed = isFollowed(item.id);
            return (
              <Pressable
                onPress={() => (self ? undefined : openUserActions(item.id))}
                style={({ pressed }) => [styles.row, { opacity: pressed && !self ? 0.6 : 1 }]}
              >
                <View>
                  <Avatar name={item.displayName || '?'} uri={item.avatarUrl} size={44} />
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: item.isOnline ? theme.colors.success : theme.colors.muted, borderColor: theme.colors.bg },
                    ]}
                  />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <NameWithBadge
                      name={item.displayName}
                      official={item.isOfficial}
                      verified={item.isVerified}
                      premium={item.isPremium}
                      badgeSize={14}
                      containerStyle={{ flexShrink: 1 }}
                      textStyle={{ fontSize: 15.5, fontWeight: '700', color: theme.colors.text }}
                    />
                    {item.isCreator && <Crown size={14} color={theme.colors.primary} strokeWidth={2.5} />}
                  </View>
                  <Text style={{ fontSize: 12.5, color: item.isOnline ? theme.colors.success : theme.colors.muted }}>
                    {item.isOnline ? t('worldChat.onlineList.online') : t('worldChat.onlineList.offline')}
                  </Text>
                </View>
                {!self && !followed && (
                  <Button label={t('worldChat.addFriend')} variant="soft" onPress={() => onFollow(item.id)} />
                )}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <EmptyState emoji="🫥" title={t('worldChat.onlineList.empty')} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabUnderline: { position: 'absolute', bottom: 0, height: 2.5, width: 40, borderRadius: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 9 },
  dot: { position: 'absolute', right: -1, bottom: -1, width: 13, height: 13, borderRadius: 7, borderWidth: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
