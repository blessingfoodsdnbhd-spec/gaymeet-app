import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';
import { Check, Search } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Sheet } from './Sheet';
import { Avatar } from './Avatar';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../store/auth';
import { getFollowing, getFollowers, type FollowedUser } from '../api/me';

export interface TagPick {
  _id: string;
  nickname: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Currently-selected ids (to pre-check). */
  selectedIds: string[];
  /** Max selectable (backend caps at 10). */
  max?: number;
  onConfirm: (picks: TagPick[]) => void;
}

/**
 * Pick friends to tag in a Moment. Source = people I follow + people who follow
 * me (deduped) — the same set the backend allows tagging. Search + checkboxes.
 */
export function FriendPickerSheet({ open, onClose, selectedIds, max = 10, onConfirm }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const myId = useAuth((s) => s.user?.id);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Record<string, TagPick>>({});

  // Seed the local selection from the parent each time the sheet opens.
  React.useEffect(() => {
    if (open) {
      const seed: Record<string, TagPick> = {};
      selectedIds.forEach((id) => (seed[id] = { _id: id, nickname: '' }));
      setPicked(seed);
      setQuery('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const friendsQ = useQuery({
    queryKey: ['me', 'tagcandidates', myId],
    queryFn: async () => {
      const [following, followers] = await Promise.all([
        getFollowing(myId!),
        getFollowers(myId!),
      ]);
      const map = new Map<string, FollowedUser>();
      [...following, ...followers].forEach((u) => map.set(u._id, u));
      return Array.from(map.values());
    },
    enabled: open && !!myId,
    staleTime: 60_000,
  });

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = friendsQ.data ?? [];
    return q ? all.filter((u) => u.nickname.toLowerCase().includes(q)) : all;
  }, [friendsQ.data, query]);

  const count = Object.keys(picked).length;

  const toggle = (u: FollowedUser) => {
    setPicked((prev) => {
      const next = { ...prev };
      if (next[u._id]) delete next[u._id];
      else if (count < max) next[u._id] = { _id: u._id, nickname: u.nickname };
      return next;
    });
  };

  const confirm = () => {
    // Backfill nicknames for ids seeded without one.
    const all = friendsQ.data ?? [];
    const byId = new Map(all.map((u) => [u._id, u.nickname]));
    onConfirm(
      Object.values(picked).map((p) => ({
        _id: p._id,
        nickname: p.nickname || byId.get(p._id) || '',
      })),
    );
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} maxHeight="80%">
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {t('moments.compose.tag')}
        </Text>
        <Pressable onPress={confirm} hitSlop={8}>
          <Text style={{ color: theme.colors.primary, fontSize: 14, fontWeight: '600' }}>
            {t('moments.compose.taggedCount', { n: count })}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.searchRow, { backgroundColor: theme.colors.surface2 }]}>
        <Search size={16} color={theme.colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('common.search')}
          placeholderTextColor={theme.colors.muted}
          style={{ flex: 1, fontSize: 15, color: theme.colors.text, paddingVertical: 0 }}
        />
      </View>

      <FlatList
        data={data}
        keyExtractor={(u) => u._id}
        style={{ maxHeight: 380 }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const sel = !!picked[item._id];
          return (
            <Pressable onPress={() => toggle(item)} style={styles.row}>
              <Avatar name={item.nickname} uri={item.avatarUrl} avatarIdx={0} size={40} />
              <Text style={{ flex: 1, fontSize: 15, color: theme.colors.text }}>
                {item.nickname}
              </Text>
              <View
                style={[
                  styles.check,
                  {
                    borderColor: sel ? theme.colors.primary : theme.colors.line,
                    backgroundColor: sel ? theme.colors.primary : 'transparent',
                  },
                ]}
              >
                {sel && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', color: theme.colors.muted, marginTop: 24 }}>
            {t('moments.compose.noFriends')}
          </Text>
        }
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { fontSize: 17, fontWeight: '700' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
