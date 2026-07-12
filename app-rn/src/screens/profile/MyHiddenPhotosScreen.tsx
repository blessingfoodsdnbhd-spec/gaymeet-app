import React from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Check, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import { NameWithBadge } from '../../components/NameWithBadge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { shortTime } from '../../utils/time';
import {
  getHiddenRequests,
  getHiddenGrants,
  respondHiddenRequest,
  revokeHiddenPhotos,
  type HiddenRequest,
  type HiddenGrant,
} from '../../api/hiddenPhotos';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function idxFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 10;
}

type Row = { kind: 'header'; label: string } | { kind: 'request'; req: HiddenRequest } | { kind: 'grant'; grant: HiddenGrant };

/**
 * 隐藏照片管理 — the owner's hub for hidden photos.
 *   1) Pending requests (谁申请了我的) → Approve / Deny inline.
 *   2) Granted viewers (我开放给了谁) → Revoke each.
 */
export function MyHiddenPhotosScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const qc = useQueryClient();

  const requestsQ = useQuery({
    queryKey: ['me', 'hiddenRequests'],
    queryFn: () => getHiddenRequests('pending'),
    staleTime: 15_000,
  });
  const grantsQ = useQuery({
    queryKey: ['me', 'hiddenGrants'],
    queryFn: getHiddenGrants,
    staleTime: 15_000,
  });

  const respondMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) => respondHiddenRequest(id, action),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me', 'hiddenRequests'] });
      qc.invalidateQueries({ queryKey: ['me', 'hiddenGrants'] });
    },
    onError: (e: any) => Alert.alert(t('common.error'), e?.response?.data?.error || e?.message || ''),
  });

  const revokeMut = useMutation({
    mutationFn: (userId: string) => revokeHiddenPhotos(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'hiddenGrants'] }),
    onError: (e: any) => Alert.alert(t('common.error'), e?.response?.data?.error || e?.message || ''),
  });

  const confirmRevoke = (grant: HiddenGrant) => {
    Alert.alert(
      t('hiddenPhotos.revokeConfirmTitle'),
      t('hiddenPhotos.revokeConfirmBody', { name: grant.user.nickname }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('hiddenPhotos.revoke'), style: 'destructive', onPress: () => revokeMut.mutate(grant.user._id) },
      ],
    );
  };

  const pending = (requestsQ.data?.requests ?? []).filter((r) => r.fromUser);
  const grants = (grantsQ.data?.grants ?? []).filter((g) => g.user);

  // Flatten into a single sectioned list.
  const rows: Row[] = [];
  rows.push({ kind: 'header', label: t('hiddenPhotos.pendingHeader', { n: pending.length }) });
  pending.forEach((req) => rows.push({ kind: 'request', req }));
  rows.push({ kind: 'header', label: t('hiddenPhotos.grantedHeader', { n: grants.length }) });
  grants.forEach((grant) => rows.push({ kind: 'grant', grant }));

  const loading = requestsQ.isLoading || grantsQ.isLoading;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ marginLeft: 8, fontSize: 16, fontWeight: '600', color: theme.colors.text }}>
          {t('hiddenPhotos.manageTitle')}
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row, i) =>
            row.kind === 'header' ? `h${i}` : row.kind === 'request' ? `r${row.req.id}` : `g${row.grant.user._id}`
          }
          contentContainerStyle={{ paddingVertical: 4, flexGrow: 1 }}
          renderItem={({ item }) => {
            if (item.kind === 'header') {
              return (
                <Text style={[styles.sectionLabel, { color: theme.colors.muted }]}>{item.label}</Text>
              );
            }
            if (item.kind === 'request') {
              const r = item.req.fromUser;
              return (
                <PersonRow
                  id={r._id}
                  name={r.nickname}
                  avatarUrl={r.avatarUrl}
                  online={r.isOnline}
                  official={r.isOfficial}
                  verified={r.isVerified}
                  premium={r.isPremium}
                  subtitle={shortTime(item.req.createdAt)}
                  onTap={() => nav.navigate('UserDetail', { userId: r._id })}
                  right={
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <CircleBtn bg={theme.colors.surface2} onPress={() => respondMut.mutate({ id: item.req.id, action: 'reject' })} busy={respondMut.isPending}>
                        <X size={18} color={theme.colors.text} strokeWidth={2} />
                      </CircleBtn>
                      <CircleBtn bg={theme.colors.primary} onPress={() => respondMut.mutate({ id: item.req.id, action: 'approve' })} busy={respondMut.isPending}>
                        <Check size={18} color="#FFFFFF" strokeWidth={2.4} />
                      </CircleBtn>
                    </View>
                  }
                />
              );
            }
            const g = item.grant.user;
            return (
              <PersonRow
                id={g._id}
                name={g.nickname}
                avatarUrl={g.avatarUrl}
                online={g.isOnline}
                official={g.isOfficial}
                verified={g.isVerified}
                premium={g.isPremium}
                subtitle={t(`hiddenPhotos.source_${item.grant.source}`)}
                onTap={() => nav.navigate('UserDetail', { userId: g._id })}
                right={
                  <Pressable
                    onPress={() => confirmRevoke(item.grant)}
                    disabled={revokeMut.isPending}
                    style={({ pressed }) => ({
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      borderRadius: 999,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: theme.colors.line,
                      opacity: pressed || revokeMut.isPending ? 0.6 : 1,
                    })}
                  >
                    <Text style={{ color: theme.colors.error, fontSize: 13, fontWeight: '700' }}>{t('hiddenPhotos.revoke')}</Text>
                  </Pressable>
                }
              />
            );
          }}
          ListEmptyComponent={<EmptyState emoji="🔒" title={t('hiddenPhotos.manageEmpty')} />}
        />
      )}
    </SafeAreaView>
  );
}

function PersonRow({
  id, name, avatarUrl, online, official, verified, premium, subtitle, onTap, right,
}: {
  id: string; name: string; avatarUrl?: string | null; online?: boolean;
  official?: boolean; verified?: boolean; premium?: boolean; subtitle: string;
  onTap: () => void; right: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 }}>
      <Pressable onPress={onTap} hitSlop={6}>
        <Avatar name={name} uri={avatarUrl} avatarIdx={idxFor(id)} size={48} showOnline={online} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <NameWithBadge
          name={name}
          official={official}
          verified={verified}
          premium={premium}
          textStyle={{ fontSize: 15, fontWeight: '600', color: theme.colors.text }}
          numberOfLines={1}
          badgeSize={14}
        />
        <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>{subtitle}</Text>
      </View>
      {right}
    </View>
  );
}

function CircleBtn({ bg, onPress, busy, children }: { bg: string; onPress: () => void; busy: boolean; children: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
        backgroundColor: bg, opacity: pressed || busy ? 0.55 : 1,
      })}
    >
      {children}
    </Pressable>
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
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 28 },
  sectionLabel: {
    fontSize: 12,
    letterSpacing: 0.72,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 6,
  },
});
