import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import {
  approveUnlock,
  getIncomingUnlocks,
  rejectUnlock,
  type IncomingUnlock,
} from '../../api/topicUnlocks';
import { on as wsOn, type WsTopicUnlock } from '../../api/ws';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Inbox of pending unlock requests addressed to me. Approve/Reject
 * actions are inline. WS subscriptions to topic-unlock:* invalidate
 * the list so new incoming requests (and far-end state changes) keep
 * the screen fresh.
 */
export function UnlockRequestsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const queryClient = useQueryClient();

  const q = useQuery({
    queryKey: ['topic-unlocks', 'incoming'],
    queryFn: getIncomingUnlocks,
    staleTime: 30_000,
  });

  useEffect(() => {
    let unsubs: Array<() => void> = [];
    let cancelled = false;
    (async () => {
      const events: Array<keyof Pick<{
        'topic-unlock:requested': WsTopicUnlock;
        'topic-unlock:approved': WsTopicUnlock;
        'topic-unlock:rejected': WsTopicUnlock;
        'topic-unlock:revoked': WsTopicUnlock;
      }, 'topic-unlock:requested' | 'topic-unlock:approved' | 'topic-unlock:rejected' | 'topic-unlock:revoked'>> = [
        'topic-unlock:requested',
        'topic-unlock:approved',
        'topic-unlock:rejected',
        'topic-unlock:revoked',
      ];
      for (const ev of events) {
        const u = await wsOn(ev, () => {
          if (cancelled) return;
          queryClient.invalidateQueries({ queryKey: ['topic-unlocks'] });
        });
        if (cancelled) {
          u();
          return;
        }
        unsubs.push(u);
      }
    })();
    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [queryClient]);

  const approveMut = useMutation({
    mutationFn: approveUnlock,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['topic-unlocks'] }),
    onError: (e: any) =>
      Alert.alert(
        t('topics.approveFailed'),
        e?.response?.data?.error || e?.message || '',
      ),
  });

  const rejectMut = useMutation({
    mutationFn: rejectUnlock,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['topic-unlocks'] }),
    onError: (e: any) =>
      Alert.alert(
        t('topics.rejectFailed'),
        e?.response?.data?.error || e?.message || '',
      ),
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          {t('topics.inboxTitle')}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      {q.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (q.data ?? []).length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ color: theme.colors.muted, fontSize: 14, textAlign: 'center' }}>
            {t('topics.inboxEmpty')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={q.data}
          keyExtractor={(it) => it.id}
          refreshControl={
            <RefreshControl
              refreshing={q.isRefetching}
              onRefresh={() => q.refetch()}
              tintColor={theme.colors.primary}
            />
          }
          renderItem={({ item }) => (
            <Row
              row={item}
              onApprove={() => approveMut.mutate(item.id)}
              onReject={() => rejectMut.mutate(item.id)}
              busy={approveMut.isPending || rejectMut.isPending}
            />
          )}
          ItemSeparatorComponent={() => (
            <View
              style={{
                height: StyleSheet.hairlineWidth,
                backgroundColor: theme.colors.line,
                marginLeft: 70,
              }}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function Row({
  row,
  onApprove,
  onReject,
  busy,
}: {
  row: IncomingUnlock;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const viewer = row.viewer;
  return (
    <View style={styles.row}>
      <Avatar
        name={viewer?.nickname || '?'}
        uri={viewer?.avatarUrl ?? null}
        size={44}
        shape="circle"
      />
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 15 }}>
          {viewer?.nickname || t('topics.unknownUser')}
          {viewer?.age != null ? ` · ${viewer.age}` : ''}
        </Text>
        <Text style={{ color: theme.colors.muted, fontSize: 12, marginTop: 3 }}>
          {t('topics.wantsToSeeOtherTopics')}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Pressable
          onPress={onReject}
          disabled={busy}
          style={({ pressed }) => [
            styles.smallBtn,
            {
              backgroundColor: theme.colors.surface2,
              opacity: pressed || busy ? 0.7 : 1,
            },
          ]}
        >
          <Text style={{ color: theme.colors.text2, fontSize: 13, fontWeight: '600' }}>
            {t('topics.reject')}
          </Text>
        </Pressable>
        <Pressable
          onPress={onApprove}
          disabled={busy}
          style={({ pressed }) => [
            styles.smallBtn,
            {
              backgroundColor: theme.colors.primary,
              opacity: pressed || busy ? 0.85 : 1,
            },
          ]}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>
            {t('topics.approve')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
});
