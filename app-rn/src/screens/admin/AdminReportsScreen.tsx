import React from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useTheme } from '../../theme/ThemeProvider';
import { EmptyState } from '../../components/EmptyState';
import { getAdminReports, resolveReport, type AdminReport } from '../../api/admin';

/** Admin reports dashboard (REPORT1) — unresolved reports across content types. */
export function AdminReportsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<any>();
  const qc = useQueryClient();

  const reportsQ = useQuery({ queryKey: ['admin', 'reports'], queryFn: getAdminReports });

  const resolveMut = useMutation({
    mutationFn: ({ kind, id }: { kind: string; id: string }) => resolveReport(kind, id),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: ['admin', 'reports'] });
      const prev = qc.getQueryData<{ reports: AdminReport[]; count: number }>(['admin', 'reports']);
      qc.setQueryData(['admin', 'reports'], (old: any) =>
        old ? { ...old, reports: old.reports.filter((r: AdminReport) => r.id !== id), count: old.count - 1 } : old,
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(['admin', 'reports'], ctx.prev),
  });

  const reports = reportsQ.data?.reports ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={theme.iconSize.l} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: theme.colors.text }]}>{t('adminReports.title')}</Text>
      </View>

      {reportsQ.isLoading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>
      ) : reports.length === 0 ? (
        <EmptyState emoji="✅" title={t('adminReports.empty')} />
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(r) => `${r.kind}-${r.id}`}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.line }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.kindChip, { backgroundColor: theme.colors.primarySoft }]}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.primaryDeep }}>
                    {t(`adminReports.kind.${item.kind}`)}
                  </Text>
                </View>
                <Text style={{ flex: 1, fontSize: 12, color: theme.colors.muted }} numberOfLines={1}>
                  {item.reporter} → {item.target}
                </Text>
              </View>
              <Text style={{ marginTop: 8, fontSize: 14, color: theme.colors.text }}>
                {item.reason || t('adminReports.noReason')}
              </Text>
              <Pressable
                onPress={() => resolveMut.mutate({ kind: item.kind, id: item.id })}
                style={({ pressed }) => [styles.resolveBtn, { backgroundColor: theme.colors.primary, opacity: pressed ? 0.8 : 1 }]}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>{t('adminReports.resolve')}</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 16, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 14, borderWidth: 1, padding: 14 },
  kindChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  resolveBtn: { marginTop: 12, alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
});
