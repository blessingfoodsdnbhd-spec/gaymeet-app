import React from 'react';
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useTheme } from '../../theme/ThemeProvider';
import { useAuth } from '../../store/auth';
import { Button } from '../../components/Button';
import { MomentItem } from '../moments/MomentItem';
import { getUserMoments, toggleLike, type Moment } from '../../api/moments';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * "My Moments" — the user's own posts, presented as a personal feed.
 * Reuses MomentItem from the global moments feed for consistency.
 */
export function MyMomentsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const me = useAuth((s) => s.user);
  const queryClient = useQueryClient();

  const myId = me?.id;

  const feedQ = useQuery({
    queryKey: ['moments', 'user', myId],
    queryFn: () => getUserMoments(myId!),
    enabled: !!myId,
    staleTime: 30_000,
  });

  // Optimistic like — same pattern as MomentsScreen.
  const likeMut = useMutation({
    mutationFn: (id: string) => toggleLike(id),
    onMutate: async (id) => {
      queryClient.setQueryData<Moment[]>(['moments', 'user', myId], (prev) =>
        (prev ?? []).map((m) =>
          m._id === id
            ? {
                ...m,
                isLiked: !m.isLiked,
                likeCount: m.likeCount + (m.isLiked ? -1 : 1),
              }
            : m,
        ),
      );
    },
    onError: (_e, id) => {
      queryClient.setQueryData<Moment[]>(['moments', 'user', myId], (prev) =>
        (prev ?? []).map((m) =>
          m._id === id
            ? {
                ...m,
                isLiked: !m.isLiked,
                likeCount: m.likeCount + (m.isLiked ? -1 : 1),
              }
            : m,
        ),
      );
    },
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ marginLeft: 8, fontSize: 16, fontWeight: '600', color: theme.colors.text }}>
          {t('profile.stats.moments')}
        </Text>
      </View>

      {feedQ.isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : feedQ.isError ? (
        <View style={styles.centerFill}>
          <Text style={{ color: theme.colors.muted, marginBottom: 12 }}>
            {t('moments.loadFailed')}
          </Text>
          <Button label={t('common.retry')} variant="soft" onPress={() => feedQ.refetch()} />
        </View>
      ) : (
        <FlatList
          data={feedQ.data ?? []}
          keyExtractor={(m) => m._id}
          renderItem={({ item }) => (
            <MomentItem
              moment={item}
              onToggleLike={(m) => likeMut.mutate(m._id)}
              onOpenComments={(m) => nav.navigate('Comments', { momentId: m._id })}
            />
          )}
          refreshing={feedQ.isFetching && !feedQ.isLoading}
          onRefresh={() => feedQ.refetch()}
          ListEmptyComponent={
            <View style={styles.centerFill}>
              <Text style={{ color: theme.colors.muted }}>{t('moments.empty')}</Text>
            </View>
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
