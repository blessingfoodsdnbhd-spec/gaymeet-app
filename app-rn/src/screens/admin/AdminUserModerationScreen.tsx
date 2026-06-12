import React from 'react';
import {
  View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ChevronLeft, Trash2, Ban, MessageSquareOff, ImageOff, ShieldCheck, RotateCcw } from 'lucide-react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useTheme } from '../../theme/ThemeProvider';
import { useToast } from '../../components/ToastProvider';
import { EmptyState } from '../../components/EmptyState';
import { usePhotoViewer } from '../../components/usePhotoViewer';
import { resolveMediaUrl } from '../../api/verification';
import type { RootStackParamList } from '../../navigation/types';
import {
  getAdminUserModeration, getAuditLog,
  banUser, unbanUser, setChatBan, setPhotoBan,
  deleteUserPhoto, deleteUserMoment, deleteUserVoteEntry, resetDiscoverUser,
  type AdminModView,
} from '../../api/admin';

type ModRoute = RouteProp<RootStackParamList, 'AdminUserModeration'>;

/**
 * Admin moderation console for a single user (the "用户管理页"). Reached from the
 * "..." menu on UserDetailScreen (admin-only). Lets an admin ban the account
 * (permanent / chat / photo-upload), delete photos / moments / vote entries, and
 * review the audit trail. Every action confirms twice and writes an AdminAction
 * server-side. Internal tool — copy is hardcoded zh (not threaded through i18n).
 */
export function AdminUserModerationScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const nav = useNavigation<any>();
  const { params } = useRoute<ModRoute>();
  const userId = params.userId;
  const qc = useQueryClient();
  const photoViewer = usePhotoViewer();
  const toast = useToast();

  const q = useQuery({
    queryKey: ['admin', 'moderation', userId],
    queryFn: () => getAdminUserModeration(userId),
  });
  const audit = useQuery({
    queryKey: ['admin', 'audit', userId],
    queryFn: () => getAuditLog(userId, 30),
  });

  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'moderation', userId] });
    qc.invalidateQueries({ queryKey: ['admin', 'audit', userId] });
  };

  const mut = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: refetchAll,
    onError: (e: any) => Alert.alert('操作失败', e?.response?.data?.error || String(e?.message || e)),
  });
  const run = (fn: () => Promise<unknown>) => mut.mutate(fn);

  // iOS gets a free-text reason prompt; Android falls back to a plain confirm.
  const confirm = (
    title: string,
    message: string,
    confirmLabel: string,
    onConfirm: (reason?: string) => void,
    destructive = true,
  ) => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        title, message,
        [
          { text: '取消', style: 'cancel' },
          { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: (r) => onConfirm(r || undefined) },
        ],
        'plain-text',
      );
    } else {
      Alert.alert(title, message, [
        { text: '取消', style: 'cancel' },
        { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => onConfirm(undefined) },
      ]);
    }
  };

  // Reset this user's passed/skipped Discover swipes. Surfaces the removed
  // count via toast (the generic `run` mutation discards the result).
  const onResetDiscover = (nickname: string) => {
    confirm(
      '重置 Discover 历史',
      `确定清掉 ${nickname} 跳过/划走的记录？被 ta 跳过的用户会重新出现在卡堆里（不影响已有的 Like 和匹配）。`,
      '重置',
      async () => {
        try {
          const removed = await resetDiscoverUser(userId);
          toast.success(`已重置 ${removed} 条记录`);
        } catch (e: any) {
          toast.error(e?.response?.data?.error || '重置失败');
        }
      },
      false,
    );
  };

  const view: AdminModView | undefined = q.data;
  const u = view?.user;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: c.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={theme.iconSize.l} color={c.text} />
        </Pressable>
        <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
          用户管理{u ? ` · ${u.nickname}` : ''}
        </Text>
      </View>

      {q.isLoading ? (
        <View style={styles.center}><ActivityIndicator color={c.primary} /></View>
      ) : !u ? (
        <EmptyState emoji="🚫" title="加载失败" subtitle="无法加载该用户" />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 48 }}>
          {/* ── Status + ban toggles ─────────────────────────────────────── */}
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
              {u.isBanned && <Badge c={c} bg={c.error} label="已封号" />}
              {u.chatBanned && <Badge c={c} bg={c.warning} label="禁止聊天" />}
              {u.photoUploadBanned && <Badge c={c} bg={c.warning} label="禁止上传" />}
              {!u.isBanned && !u.chatBanned && !u.photoUploadBanned && (
                <Badge c={c} bg={c.success} label="状态正常" />
              )}
            </View>
            {!!u.banReason && <Text style={{ fontSize: 12, color: c.text2 }}>封禁原因：{u.banReason}</Text>}

            <ActionRow
              c={c} icon={<MessageSquareOff size={18} color={u.chatBanned ? c.success : c.warning} />}
              label={u.chatBanned ? '恢复聊天发送' : '封禁聊天发送'}
              onPress={() => {
                const banning = !u.chatBanned;
                confirm(
                  banning ? '封禁聊天发送' : '恢复聊天发送',
                  banning ? `确定禁止 ${u.nickname} 发送消息？（仍可查看消息）` : `恢复 ${u.nickname} 的发送权限？`,
                  banning ? '封禁' : '恢复',
                  (reason) => run(() => setChatBan(userId, banning, reason)),
                  banning,
                );
              }}
            />
            <ActionRow
              c={c} icon={<ImageOff size={18} color={u.photoUploadBanned ? c.success : c.warning} />}
              label={u.photoUploadBanned ? '恢复照片上传' : '封禁照片上传'}
              onPress={() => {
                const banning = !u.photoUploadBanned;
                confirm(
                  banning ? '封禁照片上传' : '恢复照片上传',
                  banning ? `确定禁止 ${u.nickname} 上传照片？` : `恢复 ${u.nickname} 的上传权限？`,
                  banning ? '封禁' : '恢复',
                  (reason) => run(() => setPhotoBan(userId, banning, reason)),
                  banning,
                );
              }}
            />
            <ActionRow
              c={c} icon={<Ban size={18} color={c.error} />}
              label={u.isBanned ? '解除永久封号' : '永久封号'}
              danger={!u.isBanned}
              onPress={() => {
                if (u.isBanned) {
                  confirm('解除封号', `确定恢复 ${u.nickname} 的账号？`, '解除', () => run(() => unbanUser(userId)), false);
                } else {
                  confirm(
                    '永久封号',
                    `确定永久封禁 ${u.nickname}？该用户将无法登录，所有数据冻结。此操作可由管理员撤销。`,
                    '永久封号',
                    (reason) => run(() => banUser(userId, reason)),
                  );
                }
              }}
            />
            <ActionRow
              c={c} icon={<RotateCcw size={18} color={c.primary} />}
              label="重置该用户 Discover 历史"
              onPress={() => onResetDiscover(u.nickname)}
            />
          </View>

          {/* ── Photos ───────────────────────────────────────────────────── */}
          <Section title={`公开照片 (${u.photos.length})`} c={c}>
            {u.photos.length === 0 ? <Muted c={c} text="无公开照片" /> : (
              <View style={styles.grid}>
                {u.photos.map((p, i) => (
                  <PhotoCell
                    key={p} url={p} c={c}
                    onView={() => { const r = resolveMediaUrl(p); if (r) photoViewer.open([r], 0); }}
                    onDelete={() => confirm(
                      '删除照片', i === 0 ? '这是头像照片，删除后将使用下一张作为头像。确定删除？' : '确定删除该公开照片？',
                      '删除', (reason) => run(() => deleteUserPhoto(userId, p, i === 0 ? 'avatar' : 'public')),
                    )}
                  />
                ))}
              </View>
            )}
          </Section>

          <Section title={`私密照片 (${u.privatePhotos.length})`} c={c}>
            {u.privatePhotos.length === 0 ? <Muted c={c} text="无私密照片" /> : (
              <View style={styles.grid}>
                {u.privatePhotos.map((p) => (
                  <PhotoCell
                    key={p} url={p} c={c}
                    onView={() => { const r = resolveMediaUrl(p); if (r) photoViewer.open([r], 0); }}
                    onDelete={() => confirm('删除私密照片', '确定删除该私密照片？', '删除', () => run(() => deleteUserPhoto(userId, p, 'private')))}
                  />
                ))}
              </View>
            )}
          </Section>

          {/* ── Moments ──────────────────────────────────────────────────── */}
          <Section title={`动态 (${view!.moments.length})`} c={c}>
            {view!.moments.length === 0 ? <Muted c={c} text="无动态" /> : view!.moments.map((m) => (
              <View key={m.id} style={[styles.row, { borderColor: c.line }]}>
                {m.images[0] ? (
                  <Image source={{ uri: resolveMediaUrl(m.images[0]) || undefined }} style={styles.thumb} contentFit="cover" />
                ) : <View style={[styles.thumb, { backgroundColor: c.surface2 }]} />}
                <Text style={{ flex: 1, fontSize: 13, color: c.text }} numberOfLines={2}>{m.content || '（无文字）'}</Text>
                <DeleteBtn c={c} onPress={() => confirm('删除动态', '确定删除该动态？', '删除', () => run(() => deleteUserMoment(m.id)))} />
              </View>
            ))}
          </Section>

          {/* ── Vote entries ─────────────────────────────────────────────── */}
          <Section title={`投票参赛 (${view!.voteEntries.length})`} c={c}>
            {view!.voteEntries.length === 0 ? <Muted c={c} text="无投票参赛" /> : view!.voteEntries.map((e) => (
              <View key={e.id} style={[styles.row, { borderColor: c.line }]}>
                {e.photoUrl ? (
                  <Image source={{ uri: resolveMediaUrl(e.photoUrl) || undefined }} style={styles.thumb} contentFit="cover" />
                ) : <View style={[styles.thumb, { backgroundColor: c.surface2 }]} />}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, color: c.text }} numberOfLines={1}>{e.eventTitle}</Text>
                  <Text style={{ fontSize: 11, color: c.muted }}>{e.voteCount} 票</Text>
                </View>
                <DeleteBtn c={c} onPress={() => confirm('删除投票参赛', `确定删除该参赛项及其 ${e.voteCount} 票？`, '删除', () => run(() => deleteUserVoteEntry(e.id)))} />
              </View>
            ))}
          </Section>

          {/* ── Audit log ────────────────────────────────────────────────── */}
          <Section title="操作记录" c={c}>
            {audit.isLoading ? <Muted c={c} text="加载中…" /> :
              (audit.data?.actions.length ?? 0) === 0 ? <Muted c={c} text="暂无操作记录" /> :
              audit.data!.actions.map((a) => (
                <View key={a.id} style={{ flexDirection: 'row', gap: 8, paddingVertical: 6, alignItems: 'flex-start' }}>
                  <ShieldCheck size={14} color={c.muted} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: c.text }}>
                      <Text style={{ fontWeight: '700' }}>{a.admin}</Text> · {a.action}{a.reason ? ` · ${a.reason}` : ''}
                    </Text>
                    <Text style={{ fontSize: 10, color: c.muted }}>{new Date(a.createdAt).toLocaleString()}</Text>
                  </View>
                </View>
              ))}
          </Section>
        </ScrollView>
      )}
      {photoViewer.node}
    </SafeAreaView>
  );
}

// ── small presentational helpers ───────────────────────────────────────────
function Badge({ c, bg, label }: { c: any; bg: string; label: string }) {
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 }}>
      <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}
function ActionRow({ c, icon, label, onPress, danger }: { c: any; icon: React.ReactNode; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionRow, { borderTopColor: c.line, opacity: pressed ? 0.6 : 1 }]}>
      {icon}
      <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: danger ? c.error : c.text }}>{label}</Text>
    </Pressable>
  );
}
function Section({ title, c, children }: { title: string; c: any; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: c.text2 }}>{title}</Text>
      {children}
    </View>
  );
}
function Muted({ c, text }: { c: any; text: string }) {
  return <Text style={{ fontSize: 12, color: c.muted }}>{text}</Text>;
}
function PhotoCell({ url, c, onView, onDelete }: { url: string; c: any; onView: () => void; onDelete: () => void }) {
  return (
    <View style={{ width: 84, height: 84 }}>
      <Pressable onPress={onView} style={{ width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: c.surface2 }}>
        <Image source={{ uri: resolveMediaUrl(url) || undefined }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      </Pressable>
      <Pressable onPress={onDelete} hitSlop={6} style={[styles.photoDelete, { backgroundColor: c.error }]}>
        <Trash2 size={13} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}
function DeleteBtn({ c, onPress }: { c: any; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={[styles.delBtn, { backgroundColor: c.surface2 }]}>
      <Trash2 size={16} color={c.error} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 16, fontWeight: '600', flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: 44, height: 44, borderRadius: 8 },
  photoDelete: { position: 'absolute', top: -6, right: -6, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  delBtn: { width: 34, height: 34, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
