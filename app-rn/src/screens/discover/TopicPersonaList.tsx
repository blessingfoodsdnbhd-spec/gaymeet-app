import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import {
  getTopicPersonas,
  type Topic,
  type TopicPersonaListItem,
  type TopicPersonaListPage,
} from '../../api/topics';
import { TopicPersonaCard } from './TopicPersonaCard';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Props {
  slug: string;
  // Full Topic object so the join CTA can pass name + icon to the
  // edit screen without an extra lookup. Optional for back-compat.
  topic?: Topic;
  // Locale for picking name.en vs name.zh on the join CTA. Optional;
  // default 'en'.
  locale?: 'en' | 'zh';
  onOpenPersona: (item: TopicPersonaListItem) => void;
}

/**
 * 2-column grid of TopicPersonaCards for a given topic. Uses
 * useInfiniteQuery against /api/topics/:slug/personas with cursor
 * pagination on updatedAt. Pull-to-refresh resets to the head.
 */
export function TopicPersonaList({
  slug,
  topic,
  locale = 'en',
  onOpenPersona,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const nav = useNavigation<Nav>();

  const goJoin = () => {
    if (!topic) return;
    nav.navigate('TopicPersonaEdit', {
      topicSlug: topic.slug,
      topicName: topic.name[locale] ?? topic.name.en ?? topic.slug,
      topicIcon: topic.icon,
    });
  };

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

  // Has the requester already joined? Self is pinned to the top of the
  // first page by the backend, so we can derive this without a
  // separate /api/me/topic-personas query.
  const meHasJoined = flat.some((it) => it.isSelf);

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
        <Text
          style={{
            color: theme.colors.muted,
            fontSize: 13,
            textAlign: 'center',
            marginBottom: 14,
          }}
        >
          {t('topics.emptyList')}
        </Text>
        {topic && (
          <Pressable
            onPress={goJoin}
            style={({ pressed }) => [
              styles.joinPill,
              {
                backgroundColor: theme.colors.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={styles.joinPillText}>
              + {t('topics.joinThisTopic')}
            </Text>
          </Pressable>
        )}
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
      ListHeaderComponent={
        !meHasJoined && topic ? (
          <Pressable
            onPress={goJoin}
            style={({ pressed }) => [
              styles.joinPill,
              {
                backgroundColor: theme.colors.primary,
                alignSelf: 'center',
                marginBottom: 12,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={styles.joinPillText}>
              + {t('topics.joinThisTopic')}
            </Text>
          </Pressable>
        ) : null
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
  joinPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  joinPillText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
