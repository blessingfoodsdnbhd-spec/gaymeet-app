import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { ChevronLeft, Heart, ExternalLink, Flag, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import {
  getVoteEvent,
  castVote,
  retractVote,
  withdrawVoteEntry,
  reportVoteEvent,
  reportVoteEntry,
  type VoteEntry,
} from '../../api/votes';
import { categoryEmoji, medalFor, timeRemaining } from './voteHelpers';
import { shortTime } from '../../utils/time';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'VoteDetail'>;

export function VoteDetailScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const eventId = route.params.eventId;
  const [page, setPage] = React.useState(0);
  const [busyVote, setBusyVote] = React.useState<string | null>(null);

  const q = useQuery({
    queryKey: ['votes', 'detail', eventId],
    queryFn: () => getVoteEvent(eventId),
    staleTime: 10_000,
  });
  const detail = q.data;
  const ev = detail?.event;

  const refresh = () => qc.invalidateQueries({ queryKey: ['votes', 'detail', eventId] });

  const onVote = async (entry: VoteEntry) => {
    if (!ev || ev.status !== 'active' || busyVote) return;
    setBusyVote(entry.id);
    try {
      if (entry.votedByMe && ev.rules.mode === 'one') await retractVote(eventId, entry.id);
      else await castVote(eventId, entry.id);
      refresh();
    } catch (e: any) {
      const code = e?.response?.status;
      if (code === 429) Alert.alert(t('votes.voteLimitReached'));
      else Alert.alert(t('votes.actionFailed'), e?.response?.data?.error ?? '');
    } finally {
      setBusyVote(null);
    }
  };

  const onReportEvent = () =>
    Alert.alert(t('votes.report'), t('votes.reportConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('votes.report'),
        style: 'destructive',
        onPress: async () => {
          try {
            await reportVoteEvent(eventId);
            Alert.alert(t('votes.reportSent'));
          } catch {
            Alert.alert(t('votes.actionFailed'));
          }
        },
      },
    ]);

  const onReportEntry = (entry: VoteEntry) =>
    Alert.alert(t('votes.reportEntry'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('votes.report'),
        style: 'destructive',
        onPress: async () => {
          try {
            await reportVoteEntry(eventId, entry.id);
            Alert.alert(t('votes.reportSent'));
          } catch {
            Alert.alert(t('votes.actionFailed'));
          }
        },
      },
    ]);

  const onWithdraw = () =>
    Alert.alert(t('votes.withdrawConfirmTitle'), t('votes.withdrawConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('votes.withdraw'),
        style: 'destructive',
        onPress: async () => {
          try {
            await withdrawVoteEntry(eventId);
            refresh();
          } catch {
            Alert.alert(t('votes.actionFailed'));
          }
        },
      },
    ]);

  if (q.isLoading || !ev) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
        <View style={styles.center}>
          {q.isError ? <Text style={{ color: theme.colors.muted }}>{t('votes.loadFailed')}</Text> : <ActivityIndicator color={theme.colors.primary} />}
        </View>
      </SafeAreaView>
    );
  }

  const tr = timeRemaining(ev.endAt);
  const entries = detail?.entries ?? [];
  const canEnter = ev.status === 'active' && !detail?.isCreator && !detail?.myEntryId;
  const topByRank = (ev.topEntries ?? [])
    .map((te) => ({ rank: te.rank, entry: entries.find((e) => e.id === te.entryId) }))
    .filter((x) => x.entry);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text numberOfLines={1} style={{ flex: 1, marginHorizontal: 8, fontSize: 16, fontWeight: '600', color: theme.colors.text }}>
          {ev.title}
        </Text>
        <Pressable onPress={onReportEvent} hitSlop={8}>
          <Flag size={19} color={theme.colors.muted} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
        {/* Cover carousel */}
        <View style={{ width, height: Math.round(width * 0.62), backgroundColor: theme.colors.surface2 }}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          >
            {ev.coverPhotos.map((url, i) => (
              <ExpoImage key={i} source={{ uri: url }} style={{ width, height: Math.round(width * 0.62) }} contentFit="cover" cachePolicy="memory-disk" />
            ))}
          </ScrollView>
          {ev.coverPhotos.length > 1 && (
            <View style={styles.dots}>
              {ev.coverPhotos.map((_, i) => (
                <View key={i} style={[styles.dot, { backgroundColor: i === page ? '#FFF' : 'rgba(255,255,255,0.5)' }]} />
              ))}
            </View>
          )}
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          {/* Status + countdown */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[styles.pill, { backgroundColor: theme.colors.primarySoft }]}>
              <Text style={{ color: theme.colors.primaryDeep, fontSize: 12, fontWeight: '700' }}>
                {categoryEmoji(ev.category)} {t(`votes.category.${ev.category}`)}
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: ev.status === 'active' ? theme.colors.online : theme.colors.muted, fontWeight: '600' }}>
              {ev.status === 'ended'
                ? t('votes.ended')
                : ev.status === 'pending'
                  ? t('votes.startsAt', { date: shortTime(ev.startAt) })
                  : tr.d > 0
                    ? t('votes.countdown.days', { d: tr.d, h: tr.h })
                    : t('votes.countdown.hm', { h: tr.h, m: tr.m })}
            </Text>
          </View>

          {/* Multi-round progress */}
          {ev.type === 'multiRound' && ev.status === 'active' && ev.rounds[ev.currentRoundIndex] && (
            <View style={{ marginTop: 10, padding: 11, borderRadius: 12, backgroundColor: theme.colors.surface2 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.text }}>
                {t('votes.roundProgress', { current: ev.currentRoundIndex + 1, total: ev.rounds.length })}
              </Text>
              {(() => {
                const rtr = timeRemaining(ev.rounds[ev.currentRoundIndex].endAt);
                return (
                  <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>
                    {rtr.ended
                      ? t('votes.roundEnding')
                      : rtr.d > 0
                        ? t('votes.countdown.days', { d: rtr.d, h: rtr.h })
                        : t('votes.countdown.hm', { h: rtr.h, m: rtr.m })}
                  </Text>
                );
              })()}
            </View>
          )}
          {ev.type === 'multiRound' && ev.status === 'ended' && (
            <Text style={{ fontSize: 12.5, color: theme.colors.muted, marginTop: 8 }}>
              {t('votes.tournamentRounds', { n: ev.rounds.length })}
            </Text>
          )}

          <Text style={{ fontSize: 22, fontWeight: '800', color: theme.colors.text, marginTop: 12 }}>{ev.title}</Text>

          {/* Creator */}
          {ev.creator && (
            <Pressable
              onPress={() => nav.navigate('UserDetail', { userId: ev.creator!.id })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}
            >
              <Avatar name={ev.creator.displayName} uri={ev.creator.avatarUrl} size={28} />
              <Text style={{ fontSize: 13, color: theme.colors.text2 }}>{t('votes.byCreator', { name: ev.creator.displayName })}</Text>
            </Pressable>
          )}

          {!!ev.description && (
            <Text style={{ fontSize: 15, lineHeight: 22, color: theme.colors.text2, marginTop: 14 }}>{ev.description}</Text>
          )}

          <Text style={{ fontSize: 12.5, color: theme.colors.muted, marginTop: 12 }}>
            {t('votes.ruleLabel')}: {t(`votes.rule.${ev.rules.mode}`)}
          </Text>

          {!!ev.externalLink && (
            <Pressable
              onPress={() => Linking.openURL(ev.externalLink!).catch(() => {})}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}
            >
              <ExternalLink size={16} color={theme.colors.primary} />
              <Text style={{ fontSize: 14, color: theme.colors.primary, textDecorationLine: 'underline' }} numberOfLines={1}>
                {ev.externalLink}
              </Text>
            </Pressable>
          )}

          {/* Reference photos */}
          {ev.referencePhotos.length > 0 && (
            <View style={{ marginTop: 16 }}>
              <Text style={[styles.section, { color: theme.colors.muted }]}>{t('votes.referencePhotos')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {ev.referencePhotos.map((url, i) => (
                  <ExpoImage key={i} source={{ uri: url }} style={{ width: 88, height: 88, borderRadius: 10 }} contentFit="cover" />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Podium when ended */}
          {ev.status === 'ended' && topByRank.length > 0 && (
            <View style={{ marginTop: 22 }}>
              <Text style={[styles.section, { color: theme.colors.muted }]}>{t('votes.results')}</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {topByRank.map(({ rank, entry }) => (
                  <Pressable
                    key={entry!.id}
                    onPress={() => nav.navigate('UserDetail', { userId: entry!.submitter.id })}
                    style={{ flex: 1, alignItems: 'center' }}
                  >
                    <ExpoImage source={{ uri: entry!.photoUrl }} style={{ width: '100%', aspectRatio: 1, borderRadius: 12 }} contentFit="cover" />
                    <Text style={{ fontSize: 22, marginTop: 4 }}>{medalFor(rank)}</Text>
                    <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '600', color: theme.colors.text }}>{entry!.submitter.displayName}</Text>
                    <Text style={{ fontSize: 11, color: theme.colors.muted }}>{t('votes.voteCount', { n: entry!.voteCount })}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Entries */}
          <View style={{ marginTop: 22, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Users size={15} color={theme.colors.muted} />
            <Text style={[styles.section, { color: theme.colors.muted, marginBottom: 0 }]}>
              {t('votes.entriesCount', { n: ev.entryCount })}
            </Text>
          </View>

          {entries.length === 0 ? (
            <Text style={{ color: theme.colors.muted, fontSize: 13, marginTop: 10 }}>{t('votes.noEntries')}</Text>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
              {entries.map((entry) => {
                const mine = detail?.myEntryId === entry.id;
                const eliminated = entry.status === 'eliminated';
                return (
                  <View key={entry.id} style={{ width: '47%', opacity: eliminated ? 0.55 : 1 }}>
                    <Pressable onLongPress={() => !mine && onReportEntry(entry)} delayLongPress={350}>
                      <ExpoImage source={{ uri: entry.photoUrl }} style={{ width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: theme.colors.surface2 }} contentFit="cover" />
                      {eliminated && (
                        <View style={{ position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                          <Text style={{ color: '#FFF', fontSize: 10.5, fontWeight: '700' }}>
                            {entry.eliminatedAtRoundIndex != null
                              ? t('votes.eliminatedAt', { n: entry.eliminatedAtRoundIndex + 1 })
                              : t('votes.eliminated')}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                      <Avatar name={entry.submitter.displayName} uri={entry.submitter.avatarUrl} size={20} />
                      <Text numberOfLines={1} style={{ flex: 1, fontSize: 12.5, color: theme.colors.text }}>{entry.submitter.displayName}</Text>
                    </View>
                    {!!entry.caption && (
                      <Text numberOfLines={2} style={{ fontSize: 12, color: theme.colors.muted, marginTop: 3 }}>{entry.caption}</Text>
                    )}
                    <Pressable
                      onPress={() => onVote(entry)}
                      disabled={ev.status !== 'active' || mine || eliminated || busyVote === entry.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        marginTop: 8,
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor: entry.votedByMe ? theme.colors.primary : theme.colors.surface,
                        borderWidth: 1,
                        borderColor: entry.votedByMe ? theme.colors.primary : theme.colors.line,
                        opacity: ev.status !== 'active' || mine || eliminated ? 0.5 : 1,
                      }}
                    >
                      <Heart
                        size={15}
                        color={entry.votedByMe ? '#FFFFFF' : theme.colors.primary}
                        fill={entry.votedByMe ? '#FFFFFF' : 'transparent'}
                        strokeWidth={2}
                      />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: entry.votedByMe ? '#FFFFFF' : theme.colors.text }}>
                        {entry.voteCount}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer action */}
      {(canEnter || detail?.myEntryId) && (
        <View style={[styles.footer, { borderTopColor: theme.colors.line }]}>
          {canEnter ? (
            <Button label={t('votes.enter')} onPress={() => nav.navigate('SubmitEntry', { eventId })} fullWidth />
          ) : detail?.myEntryId && ev.status === 'active' ? (
            <Pressable onPress={onWithdraw} style={{ alignSelf: 'center', padding: 8 }}>
              <Text style={{ color: theme.colors.primary, fontSize: 14, fontWeight: '600' }}>{t('votes.withdraw')}</Text>
            </Pressable>
          ) : null}
        </View>
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
  section: { fontSize: 12, letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 10 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  dots: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
});
