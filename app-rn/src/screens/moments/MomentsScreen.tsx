import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { TopBar, IconButton } from '../../components/TopBar';
import { Button } from '../../components/Button';
import { MomentItem } from './MomentItem';
import type { RootStackParamList } from '../../navigation/types';
import {
  getMoments,
  toggleLike,
  type Moment,
  type MomentsFilter,
} from '../../api/moments';

const FILTERS: { id: MomentsFilter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'friends', label: '我的同好' },
  { id: 'nearby', label: '附近' },
  { id: 'interest', label: '兴趣' },
];

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function MomentsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<MomentsFilter>('all');

  const feedQ = useQuery({
    queryKey: ['moments', filter],
    queryFn: () => getMoments(filter),
    staleTime: 30_000,
  });

  const likeMut = useMutation({
    mutationFn: (id: string) => toggleLike(id),
    onMutate: async (id) => {
      queryClient.setQueryData<Moment[]>(['moments', filter], (prev) =>
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
      // Revert optimistic toggle
      queryClient.setQueryData<Moment[]>(['moments', filter], (prev) =>
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
      <TopBar
        title={t('tabs.moments')}
        right={
          <>
            <IconButton>
              <Camera size={18} color={theme.colors.text} strokeWidth={1.6} />
            </IconButton>
            <IconButton onPress={() => nav.navigate('Composer')}>
              <Plus size={18} color={theme.colors.text} strokeWidth={1.6} />
            </IconButton>
          </>
        }
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}
      >
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: active ? theme.colors.text : theme.colors.surface,
                borderWidth: active ? 0 : 1,
                borderColor: theme.colors.line,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: active ? theme.colors.surface : theme.colors.text2,
                }}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {feedQ.isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : feedQ.isError ? (
        <View style={styles.centerFill}>
          <Text style={{ color: theme.colors.muted, marginBottom: 12 }}>无法加载</Text>
          <Button label="重试" variant="soft" onPress={() => feedQ.refetch()} />
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
              <Text style={{ color: theme.colors.muted }}>这里还没有动态</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 28,
  },
});
