import React, { useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ChevronLeft, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useTheme } from '../../theme/ThemeProvider';
import { EmptyState } from '../../components/EmptyState';
import { getAdminReports, actOnReport, type AdminReport, type ReportAction } from '../../api/admin';

/** Admin reports dashboard (REPORT2) — unresolved reports across content types,
 *  each triaged with four actions (approve / remove-content / ban-user / ban-ip)
 *  plus a "view content" affordance. */
export function AdminReportsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<any>();
  const qc = useQueryClient();

  // Enlarged-image viewer (nsfw image / vote entry photo / message photo).
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const reportsQ = useQuery({ queryKey: ['admin', 'reports'], queryFn: getAdminReports });

  const actMut = useMutation({
    mutationFn: ({ kind, id, action }: { kind: string; id: string; action: ReportAction }) =>
      actOnReport(kind, id, action),
    // Optimistically drop the row — every action resolves the report.
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: ['admin', 'reports'] });
      const prev = qc.getQueryData<{ reports: AdminReport[]; count: number }>(['admin', 'reports']);
      qc.setQueryData(['admin', 'reports'], (old: any) =>
        old ? { ...old, reports: old.reports.filter((r: AdminReport) => r.id !== id), count: old.count - 1 } : old,
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['admin', 'reports'], ctx.prev);
      Alert.alert(t('adminReports.actionFailed'));
    },
  });

  const reports = reportsQ.data?.reports ?? [];

  // Each destructive action asks for confirmation first (老板: 每按钮 confirm).
  const confirmAct = (item: AdminReport, action: ReportAction) => {
    const map: Record<ReportAction, { title: string; body: string; destructive: boolean }> = {
      approve: {
        title: t('adminReports.confirm.approveTitle'),
        body: t('adminReports.confirm.approveBody'),
        destructive: false,
      },
      'remove-content': {
        title: t('adminReports.confirm.removeContentTitle'),
        body: t('adminReports.confirm.removeContentBody'),
        destructive: true,
      },
      'ban-user': {
        title: t('adminReports.confirm.banUserTitle'),
        body: t('adminReports.confirm.banUserBody'),
        destructive: true,
      },
      'ban-ip': {
        title: t('adminReports.confirm.banIpTitle'),
        body: t('adminReports.confirm.banIpBody'),
        destructive: true,
      },
    };
    const c = map[action];
    Alert.alert(c.title, c.body, [
      { text: t('adminReports.confirm.cancel'), style: 'cancel' },
      {
        text: t('adminReports.confirm.ok'),
        style: c.destructive ? 'destructive' : 'default',
        onPress: () => actMut.mutate({ kind: item.kind, id: item.id, action }),
      },
    ]);
  };

  // "View content" — enlarge a photo, or jump to the vote / user it targets.
  const onView = (item: AdminReport) => {
    const c = item.content;
    if (c?.imageUrl) {
      setPreviewUrl(c.imageUrl);
      return;
    }
    if (c?.type === 'vote') {
      // Fall back to opening the reported user's moderation view if we can't
      // deep-link the vote directly.
      if (item.targetUserId) nav.navigate('AdminUserModeration', { userId: item.targetUserId });
      else Alert.alert(t('adminReports.noContent'));
      return;
    }
    if ((c?.type === 'user' || item.kind === 'user') && item.targetUserId) {
      nav.navigate('AdminUserModeration', { userId: item.targetUserId });
      return;
    }
    if (c?.type === 'message' && c.text) {
      Alert.alert(t(`adminReports.kind.${item.kind}`), c.text);
      return;
    }
    if (item.targetUserId) nav.navigate('AdminUserModeration', { userId: item.targetUserId });
    else Alert.alert(t('adminReports.noContent'));
  };

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
                <Pressable onPress={() => onView(item)} hitSlop={6}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.info }}>
                    {t('adminReports.view')}
                  </Text>
                </Pressable>
              </View>

              {/* Inline thumbnail when the report carries an image. */}
              {!!item.content?.imageUrl && (
                <Pressable onPress={() => setPreviewUrl(item.content!.imageUrl!)} style={{ marginTop: 8 }}>
                  <Image
                    source={{ uri: item.content.imageUrl }}
                    style={styles.thumb}
                    contentFit="cover"
                  />
                </Pressable>
              )}

              <Text style={{ marginTop: 8, fontSize: 14, color: theme.colors.text }}>
                {item.reason || t('adminReports.noReason')}
              </Text>

              {/* 4-action row (老板: 放行 / 删除内容 / 封禁用户 / 封禁 IP). */}
              <View style={styles.actionRow}>
                <ActBtn
                  label={`✅ ${t('adminReports.actions.approve')}`}
                  bg={theme.colors.success}
                  onPress={() => confirmAct(item, 'approve')}
                  disabled={actMut.isPending}
                />
                <ActBtn
                  label={`🗑️ ${t('adminReports.actions.removeContent')}`}
                  bg={theme.colors.warning}
                  onPress={() => confirmAct(item, 'remove-content')}
                  disabled={actMut.isPending}
                />
                <ActBtn
                  label={`🚫 ${t('adminReports.actions.banUser')}`}
                  bg={theme.colors.error}
                  onPress={() => confirmAct(item, 'ban-user')}
                  disabled={actMut.isPending || !item.targetUserId}
                />
                <ActBtn
                  label={`🚨 ${t('adminReports.actions.banIp')}`}
                  bg="#8B1A1A"
                  onPress={() => confirmAct(item, 'ban-ip')}
                  disabled={actMut.isPending || !item.targetUserId}
                />
              </View>
            </View>
          )}
        />
      )}

      {/* Full-screen image preview. */}
      <Modal visible={!!previewUrl} transparent animationType="fade" onRequestClose={() => setPreviewUrl(null)}>
        <Pressable style={styles.previewBackdrop} onPress={() => setPreviewUrl(null)}>
          {!!previewUrl && (
            <Image source={{ uri: previewUrl }} style={styles.previewImg} contentFit="contain" />
          )}
          <Pressable style={styles.previewClose} onPress={() => setPreviewUrl(null)} hitSlop={10}>
            <X size={26} color="#FFFFFF" />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function ActBtn({
  label,
  bg,
  onPress,
  disabled,
}: {
  label: string;
  bg: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actBtn,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={styles.actBtnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 16, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 14, borderWidth: 1, padding: 14 },
  kindChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  thumb: { width: '100%', height: 160, borderRadius: 10, backgroundColor: '#00000010' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  actBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  actBtnText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
  previewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  previewImg: { width: '92%', height: '80%' },
  previewClose: { position: 'absolute', top: 52, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
});
