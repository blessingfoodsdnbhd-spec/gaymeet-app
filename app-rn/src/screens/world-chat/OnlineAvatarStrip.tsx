import React from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { Eye, Crown } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import type { PlazaRosterUser } from '../../api/worldChat';

/**
 * v3.1.8 在线人数 redesign — a horizontal avatar strip pinned under the room
 * header (replaces the old "在线 N 人" sheet button). Shows the live online
 * roster, sorted: self → creator → admin → followed → everyone else (server
 * order). A trailing 👁 N pill opens the full-screen OnlineUsersList.
 *
 * This is a normal flex child (NOT position:absolute) — the vc117 lesson: an
 * absolute root gets a broken hit region on Fabric. Avatars use expo-image via
 * <Avatar> (disk+memory cached), so hundreds of users don't jank the scroll.
 */
export function OnlineAvatarStrip({
  users,
  online,
  myId,
  creatorId,
  followedIds,
  onPressUser,
  onViewAll,
}: {
  users: PlazaRosterUser[];
  online: number;
  myId: string;
  creatorId: string | null;
  followedIds: Set<string>;
  onPressUser: (userId: string) => void;
  onViewAll: () => void;
}) {
  const theme = useTheme();

  // Stable priority sort. The roster already arrives server-sorted (tier → level
  // → join order); we only lift self / creator / admin / followed to the front,
  // preserving the incoming order within each bucket (stable index tiebreak).
  const sorted = React.useMemo(() => {
    const rank = (u: PlazaRosterUser) => {
      if (u.userId === myId) return 0;
      if (creatorId && u.userId === creatorId) return 1;
      if (u.tier === 'admin') return 2;
      if (followedIds.has(u.userId)) return 3;
      return 4;
    };
    return users
      .map((u, i) => ({ u, i }))
      .sort((a, b) => rank(a.u) - rank(b.u) || a.i - b.i)
      .map((x) => x.u);
  }, [users, myId, creatorId, followedIds]);

  if (sorted.length === 0) return null;

  return (
    <View style={[styles.bar, { borderBottomColor: theme.colors.line, backgroundColor: theme.colors.bg }]}>
      <FlatList
        data={sorted}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(u) => u.userId}
        contentContainerStyle={{ paddingHorizontal: theme.spacing.l, gap: theme.spacing.s, alignItems: 'center' }}
        renderItem={({ item }) => {
          const isSelf = item.userId === myId;
          const isCreator = !!creatorId && item.userId === creatorId;
          return (
            <Pressable
              onPress={() => (isSelf ? undefined : onPressUser(item.userId))}
              hitSlop={4}
              style={({ pressed }) => [styles.avatarWrap, { opacity: pressed && !isSelf ? 0.6 : 1 }]}
            >
              <View
                style={[
                  styles.ring,
                  { borderColor: isSelf ? theme.colors.success : 'transparent' },
                ]}
              >
                <Avatar name={item.name || '?'} uri={item.avatarUrl} size={38} />
              </View>
              {isCreator && (
                <View style={[styles.crown, { backgroundColor: theme.colors.surface }]}>
                  <Crown size={11} color={theme.colors.primary} strokeWidth={2.5} />
                </View>
              )}
            </Pressable>
          );
        }}
        ListFooterComponent={
          <Pressable
            onPress={onViewAll}
            hitSlop={6}
            style={({ pressed }) => [
              styles.viewAll,
              { backgroundColor: theme.colors.surface2, borderColor: theme.colors.line, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Eye size={15} color={theme.colors.text2} />
            <Text style={{ fontSize: 12.5, fontWeight: '800', color: theme.colors.text2 }}>{online}</Text>
          </Pressable>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarWrap: { alignItems: 'center', justifyContent: 'center' },
  ring: {
    borderWidth: 2,
    borderRadius: 999,
    padding: 1,
  },
  crown: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    borderRadius: 999,
    padding: 1,
  },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    marginLeft: 2,
  },
});
