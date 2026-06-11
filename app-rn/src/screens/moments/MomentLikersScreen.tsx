import React from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import { NameWithBadge } from '../../components/NameWithBadge';
import { EmptyState } from '../../components/EmptyState';
import { getMomentLikers, type MomentLiker } from '../../api/moments';
import { toggleFollow } from '../../api/follows';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'MomentLikers'>;

function idxFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 10;
}

/** Full-screen list of users who liked a moment (AAAA). Mirrors the
 *  FriendsListScreen row + follow-pill pattern. */
export function MomentLikersScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const qc = useQueryClient();
  const { momentId } = route.params;
  const KEY = ['moment', momentId, 'likers'];

  const likersQ = useQuery({
    queryKey: KEY,
    queryFn: () => getMomentLikers(momentId),
    staleTime: 30_000,
  });

  const onTogglePill = (u: MomentLiker) => {
    const flip = () => {
      qc.setQueryData<MomentLiker[]>(KEY, (prev) =>
        (prev ?? []).map((x) => (x._id === u._id ? { ...x, isFollowing: !x.isFollowing } : x)),
      );
      toggleFollow(u._id).catch(() => qc.invalidateQueries({ queryKey: KEY }));
    };
    if (u.isFollowing) {
      Alert.alert(t('about.unfollowConfirm'), '', [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('about.unfollowAction'), style: 'destructive', onPress: flip },
      ]);
    } else {
      flip();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ marginLeft: 8, fontSize: 16, fontWeight: '600', color: theme.colors.text }}>
          {t('moments.likers.title')}
        </Text>
      </View>

      {likersQ.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={likersQ.data ?? []}
          keyExtractor={(u) => u._id}
          contentContainerStyle={{ paddingVertical: 4 }}
          ItemSeparatorComponent={() => (
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.line, marginLeft: 76 }} />
          )}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => nav.navigate('UserDetail', { userId: item._id })}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 20,
                paddingVertical: 12,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Avatar name={item.nickname} uri={item.avatarUrl} avatarIdx={idxFor(item._id)} size={48} />
              <View style={{ flex: 1 }}>
                <NameWithBadge
                  name={item.nickname}
                  official={item.isOfficial}
                  verified={item.isVerified}
                  premium={item.isPremium}
                  textStyle={{ fontSize: 15, fontWeight: '600', color: theme.colors.text }}
                  numberOfLines={1}
                  badgeSize={14}
                />
              </View>
              <Pressable
                onPress={() => onTogglePill(item)}
                hitSlop={6}
                style={[
                  styles.pill,
                  item.isFollowing
                    ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                    : { backgroundColor: 'transparent', borderColor: theme.colors.primary },
                ]}
              >
                <Text
                  style={{
                    fontSize: 12.5,
                    fontWeight: '600',
                    color: item.isFollowing ? '#FFFFFF' : theme.colors.primary,
                  }}
                >
                  {item.isFollowing ? t('about.following') : t('about.follow')}
                </Text>
              </Pressable>
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState emoji="❤️" title={t('moments.likers.empty')} />}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
});
