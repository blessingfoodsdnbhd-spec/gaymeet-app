import React from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import { NameWithBadge } from '../../components/NameWithBadge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import {
  getApprovedViewers,
  revokeViewer,
  revokeAllViewers,
  type PrivatePhotoViewer,
} from '../../api/privatePhotos';
import { shortTime } from '../../utils/time';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function idxFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 10;
}

/**
 * 私密照片管理 — who currently has access to MY private photos. Each row has a
 * 🔒 button to silently revoke that one person (no notification to them); a
 * header CTA revokes everyone at once. Reached from the 我 tab.
 */
export function MyPrivatePhotoAccessScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const qc = useQueryClient();

  const viewersQ = useQuery({
    queryKey: ['privatePhotos', 'approvedViewers'],
    queryFn: getApprovedViewers,
    staleTime: 15_000,
  });
  const viewers = viewersQ.data?.viewers ?? [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['privatePhotos', 'approvedViewers'] });
    qc.invalidateQueries({ queryKey: ['photoRequests', 'approvedCount'] });
  };

  const revokeOneMut = useMutation({
    mutationFn: (userId: string) => revokeViewer(userId),
    onSuccess: invalidate,
    onError: (e: any) =>
      Alert.alert(t('privateAccess.revokeFailed'), e?.response?.data?.error || e?.message || ''),
  });

  const revokeAllMut = useMutation({
    mutationFn: revokeAllViewers,
    onSuccess: invalidate,
    onError: (e: any) =>
      Alert.alert(t('privateAccess.revokeFailed'), e?.response?.data?.error || e?.message || ''),
  });

  const onRevokeOne = (v: PrivatePhotoViewer) => {
    Alert.alert(
      t('privateAccess.revokeOneTitle', { name: v.user.nickname }),
      t('privateAccess.revokeOneBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('privateAccess.revoke'),
          style: 'destructive',
          onPress: () => revokeOneMut.mutate(v.user._id),
        },
      ],
    );
  };

  const onRevokeAll = () => {
    if (viewers.length === 0) return;
    Alert.alert(
      t('profile.revokeAllConfirmTitle'),
      t('profile.revokeAllConfirmBody', { n: viewers.length }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.revokeAllAction'),
          style: 'destructive',
          onPress: () => revokeAllMut.mutate(),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ marginLeft: 8, fontSize: 16, fontWeight: '600', color: theme.colors.text }}>
          {t('privateAccess.title')}
        </Text>
      </View>

      {viewersQ.isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : viewersQ.isError ? (
        <View style={styles.centerFill}>
          <Text style={{ color: theme.colors.muted, marginBottom: 12 }}>
            {t('privateAccess.loadFailed')}
          </Text>
          <Button label={t('common.retry')} variant="soft" onPress={() => viewersQ.refetch()} />
        </View>
      ) : (
        <FlatList
          data={viewers}
          keyExtractor={(v) => v.requestId}
          contentContainerStyle={{ paddingVertical: 4, flexGrow: 1 }}
          ListHeaderComponent={
            viewers.length > 0 ? (
              <View style={styles.headerRow}>
                <Text style={[styles.sectionLabel, { color: theme.colors.muted }]}>
                  {t('privateAccess.header', { n: viewers.length })}
                </Text>
                <Pressable onPress={onRevokeAll} hitSlop={8} disabled={revokeAllMut.isPending}>
                  <Text
                    style={{
                      color: theme.colors.error,
                      fontSize: 13,
                      fontWeight: '700',
                      opacity: revokeAllMut.isPending ? 0.5 : 1,
                    }}
                  >
                    {t('privateAccess.revokeAll')}
                  </Text>
                </Pressable>
              </View>
            ) : null
          }
          ItemSeparatorComponent={() => (
            <View
              style={{
                height: StyleSheet.hairlineWidth,
                backgroundColor: theme.colors.line,
                marginLeft: 76,
              }}
            />
          )}
          renderItem={({ item }) => {
            const u = item.user;
            return (
              <View style={styles.row}>
                <Pressable
                  onPress={() => nav.navigate('UserDetail', { userId: u._id })}
                  hitSlop={6}
                >
                  <Avatar
                    name={u.nickname}
                    uri={u.avatarUrl}
                    avatarIdx={idxFor(u._id)}
                    size={48}
                    showOnline={u.isOnline}
                  />
                </Pressable>
                <View style={{ flex: 1 }}>
                  <NameWithBadge
                    name={u.nickname}
                    verified={u.isVerified}
                    premium={u.isPremium}
                    textStyle={{ fontSize: 15, fontWeight: '600', color: theme.colors.text }}
                    numberOfLines={1}
                    badgeSize={14}
                  />
                  {!!item.grantedAt && (
                    <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>
                      {t('privateAccess.grantedAt', { time: shortTime(item.grantedAt) })}
                    </Text>
                  )}
                </View>
                <Pressable
                  onPress={() => onRevokeOne(item)}
                  disabled={revokeOneMut.isPending}
                  hitSlop={6}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: theme.colors.surface2,
                    opacity: pressed || revokeOneMut.isPending ? 0.55 : 1,
                  })}
                  accessibilityLabel={t('privateAccess.revoke')}
                >
                  <Lock size={14} color={theme.colors.error} strokeWidth={2.2} />
                  <Text style={{ color: theme.colors.error, fontSize: 13, fontWeight: '700' }}>
                    {t('privateAccess.revoke')}
                  </Text>
                </Pressable>
              </View>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              emoji="🔒"
              title={t('privateAccess.emptyTitle')}
              subtitle={t('privateAccess.emptyBody')}
            />
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 28,
  },
  sectionLabel: {
    fontSize: 12,
    letterSpacing: 0.72,
    textTransform: 'uppercase',
  },
});
