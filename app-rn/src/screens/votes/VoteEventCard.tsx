import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import type { VoteEventSummary } from '../../api/votes';
import { categoryEmoji, timeRemaining } from './voteHelpers';

const RATIO = 5 / 4; // 4:5 portrait — IG/Pinterest-style impact
const MIN_H = 380;
const MAX_H = 600;

/**
 * Photo-first event card (Apple 4.3(b): a creative photo feed, not swipe cards).
 * The cover photo IS the card — full-bleed, with the title/countdown/stats and
 * category·status chips overlaid on it. Multi-cover events get a swipeable
 * carousel with dots.
 */
export function VoteEventCard({
  event,
  onPress,
  width,
}: {
  event: VoteEventSummary;
  onPress: () => void;
  /** Override card width (e.g. a narrower Discover strip). Defaults to full screen. */
  width?: number;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { width: screenW } = useWindowDimensions();
  const cardW = width ?? screenW;
  const cardH = Math.min(MAX_H, Math.max(MIN_H, Math.round(cardW * RATIO)));

  const photos = event.coverPhotos?.length ? event.coverPhotos : [];
  const [page, setPage] = React.useState(0);

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

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ width: cardW, height: cardH, opacity: pressed ? 0.94 : 1 }]}>
      {/* Photo(s) */}
      {photos.length > 1 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / cardW))}
          style={StyleSheet.absoluteFill}
        >
          {photos.map((url, i) => (
            <ExpoImage
              key={i}
              source={{ uri: url }}
              style={{ width: cardW, height: cardH }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={150}
            />
          ))}
        </ScrollView>
      ) : photos.length === 1 ? (
        <ExpoImage
          source={{ uri: photos[0] }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
          placeholder={theme.colors.surface2}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.surface2 }]} />
      )}

      {/* Category + status chip — top-left */}
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

      {/* Vote + entry counts — top-right */}
      <View style={styles.topRight}>
        <View style={styles.chip}>
          <Users size={12} color="#FFFFFF" strokeWidth={2.2} />
          <Text style={styles.chipText}>{event.entryCount}</Text>
          <Heart size={12} color="#FFFFFF" strokeWidth={2.2} fill="#FFFFFF" style={{ marginLeft: 6 }} />
          <Text style={styles.chipText}>{event.voteCount}</Text>
        </View>
      </View>

      {/* Carousel dots */}
      {photos.length > 1 && (
        <View style={styles.dots}>
          {photos.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, { backgroundColor: i === page ? '#FFFFFF' : 'rgba(255,255,255,0.45)', width: i === page ? 16 : 6 }]}
            />
          ))}
        </View>
      )}

      {/* Title + countdown — bottom overlay on gradient */}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.78)']} style={styles.bottomGradient}>
        <Text numberOfLines={2} style={styles.title}>
          {event.title}
        </Text>
        <Text style={styles.countdown}>⏳ {countdown}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topLeft: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', gap: 6, flexWrap: 'wrap', maxWidth: '70%' },
  topRight: { position: 'absolute', top: 12, right: 12 },
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
  dots: { position: 'absolute', bottom: 86, alignSelf: 'center', flexDirection: 'row', gap: 5 },
  dot: { height: 6, borderRadius: 3 },
  bottomGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 40, paddingBottom: 16 },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  countdown: { color: 'rgba(255,255,255,0.92)', fontSize: 13, fontWeight: '700', marginTop: 6 },
});
