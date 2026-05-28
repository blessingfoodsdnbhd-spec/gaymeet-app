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
import { ChevronLeft, Check, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import {
  getInbox,
  getApprovedCount,
  respondRequest,
  relockAll,
  type PhotoRequest,
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
 * Owner's photo-request management. Two sections:
 *   1) Pending — inbound requests with Approve / Deny rows.
 *   2) Approved — count + bulk "Revoke all" button.
 *
 * Backend already filters null requesters server-side; we filter again
 * client-side for defense-in-depth (mirrors LikedMeScreen).
 */
export function PhotoRequestsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const queryClient = useQueryClient();

  const inboxQ = useQuery({
    queryKey: ['photoRequests', 'inbox'],
    queryFn: getInbox,
    staleTime: 15_000,
  });
  const approvedQ = useQuery({
    queryKey: ['photoRequests', 'approvedCount'],
    queryFn: getApprovedCount,
    staleTime: 15_000,
  });

  const respondMut = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      respondRequest(id, accept),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photoRequests', 'inbox'] });
      queryClient.invalidateQueries({ queryKey: ['photoRequests', 'approvedCount'] });
    },
    onError: (e: any, vars) => {
      Alert.alert(
        vars.accept ? t('photoRequests.approveFailed') : t('photoRequests.denyFailed'),
        e?.response?.data?.error || e?.message || '',
      );
    },
  });

  const relockMut = useMutation({
    mutationFn: relockAll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photoRequests', 'approvedCount'] });
    },
  });

  const onRevokeAll = () => {
    const n = approvedQ.data?.count ?? 0;
    if (n === 0) return;
    Alert.alert(
      t('profile.revokeAllConfirmTitle'),
      t('profile.revokeAllConfirmBody', { n }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.revokeAllAction'),
          style: 'destructive',
          onPress: () => relockMut.mutate(),
        },
      ],
    );
  };

  const pending = (inboxQ.data?.requests ?? []).filter((r) => r.requester);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ marginLeft: 8, fontSize: 16, fontWeight: '600', color: theme.colors.text }}>
          {t('photoRequests.title')}
        </Text>
      </View>

      {inboxQ.isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : inboxQ.isError ? (
        <View style={styles.centerFill}>
          <Text style={{ color: theme.colors.muted, marginBottom: 12 }}>
            {t('photoRequests.loadFailed')}
          </Text>
          <Button label={t('common.retry')} variant="soft" onPress={() => inboxQ.refetch()} />
        </View>
      ) : (
        <FlatList
          data={pending}
          keyExtractor={(r) => r._id}
          contentContainerStyle={{ paddingVertical: 4 }}
          ListHeaderComponent={
            <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 6 }}>
              <Text style={[styles.sectionLabel, { color: theme.colors.muted }]}>
                {t('photoRequests.pendingHeader', { n: pending.length })}
              </Text>
              {pending.length > 0 && (
                <Text style={{ color: theme.colors.muted, fontSize: 12, marginTop: 4 }}>
                  {t('photoRequests.tapAvatarHint')}
                </Text>
              )}
            </View>
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
          renderItem={({ item }) => (
            <RequestRow
              req={item}
              onTapAvatar={() =>
                item.requester && nav.navigate('UserDetail', { userId: item.requester._id })
              }
              onApprove={() => respondMut.mutate({ id: item._id, accept: true })}
              onDeny={() => respondMut.mutate({ id: item._id, accept: false })}
              busy={respondMut.isPending}
            />
          )}
          ListEmptyComponent={
            <View style={styles.centerFill}>
              <Text style={{ color: theme.colors.muted, textAlign: 'center' }}>
                {t('photoRequests.empty')}
              </Text>
            </View>
          }
          ListFooterComponent={
            <ApprovedFooter
              count={approvedQ.data?.count ?? 0}
              onRevokeAll={onRevokeAll}
              busy={relockMut.isPending}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

function RequestRow({
  req,
  onTapAvatar,
  onApprove,
  onDeny,
  busy,
}: {
  req: PhotoRequest;
  onTapAvatar: () => void;
  onApprove: () => void;
  onDeny: () => void;
  busy: boolean;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  // requester is non-null at the call site (we filter above), but TS doesn't know.
  const r = req.requester!;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 20,
        paddingVertical: 14,
      }}
    >
      <Pressable onPress={onTapAvatar} hitSlop={6}>
        <Avatar
          name={r.nickname}
          uri={r.avatarUrl}
          avatarIdx={idxFor(r._id)}
          size={48}
          showOnline={r.isOnline}
        />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.text }}>
          {r.nickname}
        </Text>
        <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>
          {shortTime(req.createdAt)}
        </Text>
      </View>
      <Pressable
        onPress={onDeny}
        disabled={busy}
        hitSlop={6}
        style={({ pressed }) => ({
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.surface2,
          opacity: pressed || busy ? 0.55 : 1,
        })}
        accessibilityLabel={t('photoRequests.deny')}
      >
        <X size={18} color={theme.colors.text} strokeWidth={2} />
      </Pressable>
      <Pressable
        onPress={onApprove}
        disabled={busy}
        hitSlop={6}
        style={({ pressed }) => ({
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.primary,
          opacity: pressed || busy ? 0.55 : 1,
        })}
        accessibilityLabel={t('photoRequests.approve')}
      >
        <Check size={18} color="#FFFFFF" strokeWidth={2.4} />
      </Pressable>
    </View>
  );
}

function ApprovedFooter({
  count,
  onRevokeAll,
  busy,
}: {
  count: number;
  onRevokeAll: () => void;
  busy: boolean;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  if (count === 0) return null;
  return (
    <View
      style={{
        marginTop: 28,
        marginHorizontal: 20,
        padding: 16,
        borderRadius: 18,
        backgroundColor: theme.colors.surface2,
      }}
    >
      <Text style={[styles.sectionLabel, { color: theme.colors.muted, marginBottom: 10 }]}>
        {t('photoRequests.approvedHeader', { n: count })}
      </Text>
      <Button
        label={t('photoRequests.revokeAll')}
        variant="soft"
        onPress={onRevokeAll}
        loading={busy}
      />
    </View>
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
  sectionLabel: {
    fontSize: 12,
    letterSpacing: 0.72,
    textTransform: 'uppercase',
  },
});
