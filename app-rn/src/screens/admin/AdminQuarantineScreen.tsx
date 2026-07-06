import React from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Ban, ShieldCheck, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useTheme } from '../../theme/ThemeProvider';
import { EmptyState } from '../../components/EmptyState';
import { shortTime } from '../../utils/time';
import {
  getQuarantines,
  banQuarantine,
  approveQuarantine,
  type AdminQuarantine,
} from '../../api/admin';

/** Mask an IP for display so a raw address isn't shown in the UI.
 *  IPv4 a.b.c.d → a.b.***.***; IPv6 keeps the first two groups; anything else
 *  keeps only its first half. */
function maskIp(ip: string): string {
  if (!ip) return '—';
  if (ip.includes('.')) {
    const p = ip.split('.');
    if (p.length === 4) return `${p[0]}.${p[1]}.***.***`;
  }
  if (ip.includes(':')) {
    const g = ip.split(':').filter(Boolean);
    return `${g.slice(0, 2).join(':')}:***`;
  }
  return `${ip.slice(0, Math.ceil(ip.length / 2))}***`;
}

const QKEY = ['admin', 'quarantine'] as const;

/** Admin IP-quarantine review — ban or approve each quarantined IP + its users. */
export function AdminQuarantineScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<any>();
  const qc = useQueryClient();

  const quarQ = useQuery({ queryKey: QKEY, queryFn: getQuarantines });

  // Optimistically drop the row on either decision; roll back on error.
  const decide = (fn: (ip: string) => Promise<void>) => ({
    mutationFn: (ip: string) => fn(ip),
    onMutate: async (ip: string) => {
      await qc.cancelQueries({ queryKey: QKEY });
      const prev = qc.getQueryData<{ quarantines: AdminQuarantine[]; count: number }>(QKEY);
      qc.setQueryData(QKEY, (old: any) =>
        old
          ? {
              ...old,
              quarantines: old.quarantines.filter((q: AdminQuarantine) => q.ip !== ip),
              count: Math.max(0, old.count - 1),
            }
          : old,
      );
      return { prev };
    },
    onError: (_e: unknown, _ip: string, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(QKEY, ctx.prev);
      Alert.alert(t('adminQuarantine.actionFailed'));
    },
  });

  const banMut = useMutation(decide(banQuarantine));
  const approveMut = useMutation(decide(approveQuarantine));

  const confirmBan = (ip: string) =>
    Alert.alert(t('adminQuarantine.confirmBanTitle'), t('adminQuarantine.confirmBanBody', { ip: maskIp(ip) }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('adminQuarantine.ban'), style: 'destructive', onPress: () => banMut.mutate(ip) },
    ]);

  const quarantines = quarQ.data?.quarantines ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={theme.iconSize.l} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: theme.colors.text }]}>{t('adminQuarantine.title')}</Text>
      </View>

      {quarQ.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : quarantines.length === 0 ? (
        <FlatList
          data={[]}
          renderItem={null}
          refreshControl={
            <RefreshControl refreshing={quarQ.isFetching} onRefresh={() => quarQ.refetch()} tintColor={theme.colors.primary} />
          }
          contentContainerStyle={{ flexGrow: 1 }}
          ListEmptyComponent={<EmptyState emoji="🛡️" title={t('adminQuarantine.empty')} />}
        />
      ) : (
        <FlatList
          data={quarantines}
          keyExtractor={(q) => q.ip}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={
            <RefreshControl refreshing={quarQ.isFetching} onRefresh={() => quarQ.refetch()} tintColor={theme.colors.primary} />
          }
          renderItem={({ item }) => {
            const pending = banMut.isPending || approveMut.isPending;
            return (
              <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.line }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: theme.colors.text }}>
                    {maskIp(item.ip)}
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.colors.muted }}>{shortTime(item.triggeredAt)}</Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Users size={14} color={theme.colors.muted} strokeWidth={1.8} />
                    <Text style={{ fontSize: 12.5, color: theme.colors.text2 }}>
                      {t('adminQuarantine.userCount', { n: item.users?.length ?? 0 })}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12.5, color: theme.colors.text2 }}>
                    {t('adminQuarantine.voteCount', { n: item.voteCount ?? 0 })}
                  </Text>
                </View>

                {/* Involved users */}
                {(item.users ?? []).map((u, i) => (
                  <View
                    key={u.id || u.email || i}
                    style={[styles.userRow, { borderTopColor: theme.colors.line }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13.5, color: theme.colors.text }} numberOfLines={1}>
                        {u.nickname || '—'}
                      </Text>
                      <Text style={{ fontSize: 12, color: theme.colors.muted }} numberOfLines={1}>
                        {u.email}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11.5, color: theme.colors.muted }}>{shortTime(u.createdAt)}</Text>
                  </View>
                ))}

                {/* Decision buttons */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  <Pressable
                    disabled={pending}
                    onPress={() => confirmBan(item.ip)}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      { backgroundColor: theme.colors.error, opacity: pressed || pending ? 0.7 : 1 },
                    ]}
                  >
                    <Ban size={16} color="#FFFFFF" strokeWidth={2} />
                    <Text style={styles.actionLabel}>{t('adminQuarantine.ban')}</Text>
                  </Pressable>
                  <Pressable
                    disabled={pending}
                    onPress={() => approveMut.mutate(item.ip)}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      { backgroundColor: theme.colors.success, opacity: pressed || pending ? 0.7 : 1 },
                    ]}
                  >
                    <ShieldCheck size={16} color="#FFFFFF" strokeWidth={2} />
                    <Text style={styles.actionLabel}>{t('adminQuarantine.approve')}</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
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
  card: { borderRadius: 14, borderWidth: 1, padding: 14 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 999,
  },
  actionLabel: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' },
});
