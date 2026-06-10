import React from 'react';
import { View, Text, Pressable, ScrollView, FlatList, StyleSheet, Alert, useWindowDimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, Users, Info } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuth } from '../../store/auth';
import { castVote, retractVote, saveVoteProgress, type VoteEventSummary, type FeedVoteEntry } from '../../api/votes';
import { categoryEmoji, timeRemaining } from './voteHelpers';
import { RankMedal } from '../../components/RankMedal';

const RATIO = 5 / 4; // 4:5 portrait — IG/Pinterest-style impact
const MIN_H = 380;
const MAX_H = 600;

/**
 * Photo-first event card (Apple 4.3(b): a creative photo feed, not swipe cards).
 *
 * When the feed attaches ranked `entries`, the card is a **horizontal paged
 * carousel** of those entries with inline ❤️ voting — page 0 is the #1-ranked
 * entry (the dynamic cover) with the title/countdown overlay, then 🥈🥇🥉 and
 * new/resume entries. Tapping a photo does NOT navigate (primary flow stays in
 * the feed); a small (i) opens the detail. Legacy events with no attached
 * entries fall back to the original cover-photo rendering.
 */
export function VoteEventCard({
  event,
  onPress,
  width,
}: {
  event: VoteEventSummary;
  /** Opens the detail screen — wired to the (i) affordance, not photo taps. */
  onPress: () => void;
  /** Override card width (e.g. a narrower Discover strip). Defaults to full screen. */
  width?: number;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { width: screenW } = useWindowDimensions();
  const myId = useAuth((s) => s.user?.id);
  const cardW = width ?? screenW;
  const cardH = Math.min(MAX_H, Math.max(MIN_H, Math.round(cardW * RATIO)));

  // Local mirror of the attached entries so votes feel instant; resynced
  // whenever the feed refetches (new array reference from react-query).
  const [entries, setEntries] = React.useState<FeedVoteEntry[]>(event.entries ?? []);
  React.useEffect(() => setEntries(event.entries ?? []), [event.entries]);

  const [page, setPage] = React.useState(0);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const progressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => {
    if (progressTimer.current) clearTimeout(progressTimer.current);
  }, []);

  const tr = timeRemaining(event.endAt);
  const countdown = tr.ended
    ? t('votes.ended')
    : tr.d > 0
      ? t('votes.countdown.days', { d: tr.d, h: tr.h })
      : t('votes.countdown.hm', { h: tr.h, m: tr.m });

  const statusColor: Record<string, string> = {
    active: theme.colors.online,
    pending: theme.colors.muted,
    ended: theme.colors.text2,
  };

  const onVote = async (entry: FeedVoteEntry) => {
    if (event.status !== 'active' || busyId) return;
    if (entry.submitter.id === myId) return; // can't vote your own entry
    const toggleOff = entry.votedByMe && event.rules.mode === 'one';
    setBusyId(entry.entryId);
    // Optimistic toggle.
    setEntries((prev) =>
      prev.map((x) =>
        x.entryId === entry.entryId
          ? { ...x, votedByMe: !toggleOff, voteCount: x.voteCount + (toggleOff ? -1 : 1) }
          : x,
      ),
    );
    try {
      if (toggleOff) await retractVote(event.id, entry.entryId);
      else await castVote(event.id, entry.entryId);
    } catch (e: any) {
      setEntries((prev) => prev.map((x) => (x.entryId === entry.entryId ? entry : x))); // revert
      const code = e?.response?.status;
      Alert.alert(code === 429 ? t('votes.voteLimitReached') : t('votes.actionFailed'), e?.response?.data?.error ?? '');
    } finally {
      setBusyId(null);
    }
  };

  const onMomentumEnd = (offsetX: number) => {
    const idx = Math.max(0, Math.min(Math.round(offsetX / cardW), entries.length - 1));
    setPage(idx);
    const entry = entries[idx];
    if (!entry) return;
    if (progressTimer.current) clearTimeout(progressTimer.current);
    progressTimer.current = setTimeout(() => {
      saveVoteProgress(event.id, entry.entryId, idx).catch(() => {});
    }, 200);
  };

  const unseen = event.myProgress?.unseenCount ?? 0;

  // ── Legacy fallback: no attached entries → original cover-photo card. ────────
  if (entries.length === 0) {
    const photos = event.coverPhotos?.length ? event.coverPhotos : [];
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [{ width: cardW, height: cardH, opacity: pressed ? 0.94 : 1 }]}>
        {photos.length > 0 ? (
          <ExpoImage source={{ uri: photos[0] }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={150} placeholder={theme.colors.surface2} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.surface2 }]} />
        )}
        <View style={styles.topLeft}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>
              {categoryEmoji(event.category)} {t(`votes.category.${event.category}`)}
            </Text>
          </View>
          <View style={styles.chip}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColor[event.status] }} />
            <Text style={styles.chipText}>{t(`votes.status.${event.status}`)}</Text>
          </View>
        </View>
        <View style={styles.topRight}>
          <View style={styles.chip}>
            <Users size={12} color="#FFFFFF" strokeWidth={2.2} />
            <Text style={styles.chipText}>{event.entryCount}</Text>
            <Heart size={12} color="#FFFFFF" strokeWidth={2.2} fill="#FFFFFF" style={{ marginLeft: 6 }} />
            <Text style={styles.chipText}>{event.voteCount}</Text>
          </View>
        </View>
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.78)']} style={styles.bottomGradient}>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={2} style={styles.title}>{event.title}</Text>
            {!!event.description && <Text numberOfLines={2} style={styles.description}>{event.description}</Text>}
            <Text style={styles.countdown}>⏳ {countdown}</Text>
          </View>
        </LinearGradient>
      </Pressable>
    );
  }

  // ── Carousel: one page per ranked entry, inline voting. ─────────────────────
  const renderItem = ({ item, index }: { item: FeedVoteEntry; index: number }) => {
    const mine = item.submitter.id === myId;
    const canVote = event.status === 'active' && !mine;
    return (
      <View style={{ width: cardW, height: cardH }}>
        <ExpoImage source={{ uri: item.photoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={150} placeholder={theme.colors.surface2} />

        {/* Medal for podium ranks — every page */}
        {item.rank <= 3 && (
          <View style={styles.medal}>
            <RankMedal rank={item.rank} size={30} />
          </View>
        )}

        {/* Page 0 only: category·status chips + title/countdown overlay */}
        {index === 0 && (
          <View style={[styles.topLeft, { top: 48 }]}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>
                {categoryEmoji(event.category)} {t(`votes.category.${event.category}`)}
              </Text>
            </View>
            <View style={styles.chip}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColor[event.status] }} />
              <Text style={styles.chipText}>{t(`votes.status.${event.status}`)}</Text>
            </View>
          </View>
        )}

        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.bottomGradient}>
          <View style={{ flex: 1, marginRight: 12 }}>
            {index === 0 ? (
              <>
                <Text numberOfLines={2} style={styles.title}>{event.title}</Text>
                {!!event.description && <Text numberOfLines={2} style={styles.description}>{event.description}</Text>}
                <Text style={styles.countdown}>⏳ {countdown}</Text>
              </>
            ) : (
              <Text numberOfLines={1} style={styles.submitter}>{item.submitter.displayName}</Text>
            )}
          </View>

          {/* Inline vote button — bottom-right on every page */}
          <Pressable
            onPress={() => onVote(item)}
            disabled={!canVote || busyId === item.entryId}
            hitSlop={8}
            style={[
              styles.voteBtn,
              {
                backgroundColor: item.votedByMe ? theme.colors.primary : 'rgba(0,0,0,0.42)',
                borderColor: item.votedByMe ? theme.colors.primary : 'rgba(255,255,255,0.5)',
                opacity: canVote ? 1 : 0.55,
              },
            ]}
          >
            <Heart size={16} color="#FFFFFF" strokeWidth={2.2} fill={item.votedByMe ? '#FFFFFF' : 'transparent'} />
            <Text style={styles.voteCount}>{item.voteCount}</Text>
          </Pressable>
        </LinearGradient>
      </View>
    );
  };

  return (
    <View style={{ width: cardW, height: cardH }}>
      <FlatList
        data={entries}
        keyExtractor={(e) => e.entryId}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, index) => ({ length: cardW, offset: cardW * index, index })}
        onMomentumScrollEnd={(e) => onMomentumEnd(e.nativeEvent.contentOffset.x)}
      />

      {/* Fixed overlays (don't scroll with pages) */}
      <View style={styles.topRightRow} pointerEvents="box-none">
        {unseen > 0 && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>{t('votes.newEntriesBadge', { count: unseen })}</Text>
          </View>
        )}
        <Pressable onPress={onPress} hitSlop={8} style={styles.infoBtn} accessibilityLabel={t('votes.infoLabel')}>
          <Info size={16} color="#FFFFFF" strokeWidth={2.2} />
        </Pressable>
      </View>

      {entries.length > 1 && (
        <View style={styles.dots} pointerEvents="none">
          {entries.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, { backgroundColor: i === page ? '#FFFFFF' : 'rgba(255,255,255,0.45)', width: i === page ? 16 : 6 }]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topLeft: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', gap: 6, flexWrap: 'wrap', maxWidth: '70%' },
  topRight: { position: 'absolute', top: 12, right: 12 },
  topRightRow: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  medal: { position: 'absolute', top: 10, left: 10, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  chipText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  newBadge: { backgroundColor: '#E25CAE', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  newBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  infoBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  dots: { position: 'absolute', top: 14, alignSelf: 'center', flexDirection: 'row', gap: 5 },
  dot: { height: 6, borderRadius: 3 },
  bottomGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 40, paddingBottom: 16, flexDirection: 'row', alignItems: 'flex-end' },
  title: { color: '#FFFFFF', fontSize: 23, fontWeight: '900', letterSpacing: -0.3 },
  description: { color: 'rgba(255,255,255,0.86)', fontSize: 14, fontWeight: '400', marginTop: 4, lineHeight: 19 },
  countdown: { color: 'rgba(255,255,255,0.92)', fontSize: 13, fontWeight: '700', marginTop: 6 },
  submitter: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  voteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  voteCount: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
