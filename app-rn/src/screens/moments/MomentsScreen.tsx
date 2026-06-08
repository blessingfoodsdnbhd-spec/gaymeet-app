import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';

import { useTheme } from '../../theme/ThemeProvider';
import { TopBar, IconButton } from '../../components/TopBar';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { MomentItem } from './MomentItem';
import { useAboutUserSheet } from '../../components/useAboutUserSheet';
import { uploadFile } from '../../api/upload';
import { postMoment } from '../../api/moments';
import type { RootStackParamList } from '../../navigation/types';
import {
  getMoments,
  toggleLike,
  type Moment,
  type MomentsFilter,
} from '../../api/moments';

const FILTER_IDS: MomentsFilter[] = ['all', 'friends', 'nearby', 'interest'];

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function MomentsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<MomentsFilter>('all');
  const filters = FILTER_IDS.map((id) => ({ id, label: t(`moments.filters.${id}`) }));
  const { openAbout, aboutSheet } = useAboutUserSheet();

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
          // Single "+" entry point — the camera button was a duplicate path to
          // posting (it quick-posted a photo); the composer (+) covers it.
          <IconButton onPress={() => nav.navigate('Composer')}>
            <Plus size={18} color={theme.colors.text} strokeWidth={1.6} />
          </IconButton>
        }
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // flexGrow:0 alone wasn't enough — under Fabric in a column
        // flex parent, the chip ScrollView's outer box was reported
        // smaller than its actual content height. The next sibling
        // (the FlatList) then painted over the chip row's bottom
        // edge, which looked like the labels "字被遮一半" — the
        // overlap was from below, not the text itself.
        // flexShrink:0 prevents the outer box from being squeezed
        // below the chips' real height.
        style={{ flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 10 }}
      >
        {filters.map((f) => {
          const active = filter === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={{
                // Bigger padding both axes → the borderRadius:999 pill
                // looks fully rounded instead of capsule-flat, and the
                // chip has room around the larger label.
                paddingHorizontal: 18,
                paddingVertical: 10,
                borderRadius: 999,
                backgroundColor: active ? theme.colors.text : theme.colors.surface,
                // Keep borderWidth identical between states so the chip's
                // outer dimensions don't jump by 2px on toggle (which made
                // labels look slightly off-vertical vs their neighbours).
                borderWidth: 1,
                borderColor: active ? theme.colors.text : theme.colors.line,
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 15,
                  // Explicit lineHeight ≥ 1.3× fontSize. Under
                  // Fabric/Bridgeless (newArchEnabled: true), a
                  // <Text numberOfLines={1}> with intrinsic line-height
                  // can be measured at height ≈ fontSize, which then
                  // clips CJK glyphs (全部 / 同好 / 附近 / 兴趣) ~2-3px
                  // top and bottom — the "字被遮一半" report after the
                  // fontSize 13→15 bump. Pinning lineHeight to 20
                  // reserves the right line-box height so glyphs render
                  // in full. (Opposite of the MomentItem caption fix
                  // in 06e904e where multi-line CJK needed lineHeight
                  // DROPPED — different RN measurement path.)
                  lineHeight: 20,
                  fontWeight: '600',
                  // Use primary text colour for inactive chips so the
                  // labels stay legible — text2 (#605F70) was too washed
                  // out for the white-pill background.
                  color: active ? theme.colors.surface : theme.colors.text,
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
          <Text style={{ color: theme.colors.muted, marginBottom: 12 }}>{t('moments.loadFailed')}</Text>
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
              onTapAuthor={(m) => openAbout(m.user._id)}
              onOpenComments={(m) => nav.navigate('Comments', { momentId: m._id })}
            />
          )}
          refreshing={feedQ.isFetching && !feedQ.isLoading}
          onRefresh={() => feedQ.refetch()}
          // flex:1 confines the list to the space left after TopBar +
          // chip row, so its first item can't paint above its own box.
          // Without this the FlatList's container collapsed to content
          // height and the first MomentItem drew on top of the chip
          // row's bottom edge.
          style={{ flex: 1 }}
          // iOS would otherwise auto-inset the scroll content for the
          // parent SafeAreaView's top edge a SECOND time, pulling the
          // first row up under the chip header. We've already handled
          // the safe area at the SafeAreaView; don't double-count.
          contentInsetAdjustmentBehavior="never"
          ListEmptyComponent={
            <EmptyState
              emoji="📷"
              title={t(`moments.emptyByFilter.${filter}`)}
              primaryLabel={t('empty.moments.cta')}
              onPrimary={() => nav.navigate('Composer')}
            />
          }
        />
      )}

      {aboutSheet}
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
