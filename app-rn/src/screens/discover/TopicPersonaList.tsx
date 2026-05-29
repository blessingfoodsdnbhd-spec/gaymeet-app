import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../theme/ThemeProvider';
import {
  getTopicPersonas,
  type TopicPersonaListItem,
  type TopicPersonaListPage,
} from '../../api/topics';
import { TopicPersonaCard } from './TopicPersonaCard';

interface Props {
  slug: string;
  onOpenPersona: (item: TopicPersonaListItem) => void;
}

/**
 * 2-column grid of TopicPersonaCards for a given topic. Uses
 * useInfiniteQuery against /api/topics/:slug/personas with cursor
 * pagination on updatedAt. Pull-to-refresh resets to the head.
 */
export function TopicPersonaList({ slug, onOpenPersona }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();

  const cols = 2;
  const horizontalPad = 14;
  const gap = 10;
  const tileW = (width - horizontalPad * 2 - gap * (cols - 1)) / cols;

  const q = useInfiniteQuery<TopicPersonaListPage, Error>({
    queryKey: ['topics', slug, 'personas'],
    queryFn: ({ pageParam }) =>
      getTopicPersonas(slug, (pageParam as string | undefined) ?? undefined),
    getNextPageParam: (last) => last.cursor ?? undefined,
    initialPageParam: undefined,
  });

  const flat: TopicPersonaListItem[] =
    q.data?.pages.flatMap((p) => p.items) ?? [];

  const onEnd = useCallback(() => {
    if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
  }, [q]);

  if (q.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (q.isError) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: theme.colors.muted, fontSize: 13 }}>
          {t('topics.loadFailed')}
        </Text>
      </View>
    );
  }

  if (flat.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: theme.colors.muted, fontSize: 13 }}>
          {t('topics.emptyList')}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={flat}
      keyExtractor={(it) => it.userId}
      numColumns={cols}
      columnWrapperStyle={{ gap }}
      contentContainerStyle={{
        paddingHorizontal: horizontalPad,
        paddingTop: 12,
        paddingBottom: 24,
        gap,
      }}
      renderItem={({ item }) => (
        <TopicPersonaCard
          item={item}
          width={tileW}
          onPress={() => onOpenPersona(item)}
        />
      )}
      onEndReached={onEnd}
      onEndReachedThreshold={0.6}
      refreshControl={
        <RefreshControl
          refreshing={q.isRefetching && !q.isFetchingNextPage}
          onRefresh={() => q.refetch()}
          tintColor={theme.colors.primary}
        />
      }
      ListFooterComponent={
        q.isFetchingNextPage ? (
          <View style={{ paddingVertical: 16 }}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
});
