import React from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';

import { useTheme } from '../../../theme/ThemeProvider';
import { EmptyState } from '../../../components/EmptyState';
import { Avatar } from '../../../components/Avatar';
import { Button } from '../../../components/Button';
import { getBlockedUsers, unblockUser, type BlockedUser } from '../../../api/safety';

function idxFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 10;
}

/**
 * Manage blocked users (Apple guideline-friendly safety control). Lists every
 * account the user has blocked with an inline "unblock" button. Mirrors the
 * FriendsListScreen row pattern + design-system tokens (see CLAUDE.md).
 */
export function BlockedListScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<any>();
  const qc = useQueryClient();

  const blockedQ = useQuery({ queryKey: ['blockedUsers'], queryFn: getBlockedUsers });

  const unblockMut = useMutation({
    mutationFn: (userId: string) => unblockUser(userId),
    onMutate: async (userId) => {
      await qc.cancelQueries({ queryKey: ['blockedUsers'] });
      const prev = qc.getQueryData<BlockedUser[]>(['blockedUsers']);
      qc.setQueryData<BlockedUser[]>(['blockedUsers'], (old) =>
        (old ?? []).filter((u) => u.id !== userId),
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(['blockedUsers'], ctx.prev);
    },
  });

  const data = blockedQ.data ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={theme.iconSize.l} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: theme.colors.text }]}>{t('blocked.title')}</Text>
      </View>

      {blockedQ.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : data.length === 0 ? (
        <EmptyState emoji="🚫" title={t('blocked.emptyTitle')} subtitle={t('blocked.emptySubtitle')} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ paddingVertical: 8 }}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Avatar uri={item.avatarUrl} name={item.nickname} avatarIdx={idxFor(item.id)} size={44} />
              <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>
                {item.nickname}
              </Text>
              <Button
                label={t('blocked.unblock')}
                variant="soft"
                onPress={() => unblockMut.mutate(item.id)}
              />
            </View>
          )}
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 16, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  name: { flex: 1, fontSize: 15, fontWeight: '500' },
});
