import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { brandGradient } from '../../theme/tokens';

/** Logical design size; captured at 3× → 1080×1080 PNG (square = FB/IG feed). */
export const CARD_SIZE = 360;
const TITLE_MAX = 64;

export interface VoteShareCardProps {
  eventId: string;
  title: string;
  coverUrl?: string | null;
  /** Pre-translated, e.g. "🎨 Art". */
  categoryLabel: string;
  /** Pre-translated countdown / status, e.g. "2d 4h left". */
  countdownText: string;
  /** Pre-translated stats, e.g. "5 entries · 42 votes". */
  statsText: string;
}

/**
 * Off-screen branded card for sharing a vote/contest as an image. The PARENT
 * renders this inside a `ref` View positioned off-screen and captures it with
 * react-native-view-shot. RN's <Image> (not expo-image) is used for the cover
 * because view-shot captures it reliably across platforms.
 */
export function VoteShareCard({ eventId, title, coverUrl, categoryLabel, countdownText, statsText }: VoteShareCardProps) {
  const { t } = useTranslation();
  const heading = title.length > TITLE_MAX ? `${title.slice(0, TITLE_MAX - 1)}…` : title;

  return (
    <View style={styles.card}>
      {/* Brand gradient accent bar */}
      <LinearGradient
        colors={[...brandGradient.colors] as [string, string, ...string[]]}
        locations={[...brandGradient.locations] as [number, number, ...number[]]}
        start={brandGradient.start}
        end={brandGradient.end}
        style={styles.accentBar}
      />

      {/* Wordmark header */}
      <View style={styles.headerRow}>
        <Text style={styles.wordmark}>Meyou</Text>
        <Text style={styles.wordmarkZh}>密友</Text>
      </View>

      {/* Cover — main visual with title overlaid */}
      <View style={styles.coverWrap}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.cover} resizeMode="cover" />
        ) : (
          <View style={[styles.cover, styles.coverFallback]} />
        )}
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.72)']} style={styles.coverScrim} />
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{categoryLabel}</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {heading}
        </Text>
      </View>

      {/* Info */}
      <View style={styles.inner}>
        <View style={styles.metaRow}>
          <Text style={styles.countdown}>{countdownText}</Text>
          <Text style={styles.stats}>{statsText}</Text>
        </View>
        <View style={styles.footerRow}>
          <Text style={styles.url}>meyou.uk/v/{eventId}</Text>
          <Text style={styles.tagline}>{t('votes.share.tagline')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  accentBar: { height: 7, width: '100%' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 9,
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 12,
  },
  wordmark: { fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 28, color: '#E25CAE' },
  wordmarkZh: { fontSize: 13, letterSpacing: 4, color: '#9A8DA6', fontWeight: '500' },
  coverWrap: { width: '100%', height: 176, backgroundColor: '#F0EAF2', justifyContent: 'flex-end' },
  cover: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  coverFallback: { backgroundColor: '#EADFF0' },
  coverScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '70%' },
  categoryBadge: {
    position: 'absolute',
    top: 12,
    left: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  categoryText: { fontSize: 12, color: '#C44B98', fontWeight: '700' },
  title: {
    fontFamily: 'Fraunces-Medium',
    fontStyle: 'italic',
    fontSize: 26,
    lineHeight: 31,
    color: '#FFFFFF',
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  inner: { flex: 1, paddingHorizontal: 22, justifyContent: 'space-between', paddingVertical: 16 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  countdown: { fontSize: 14, color: '#6E5C7A', fontWeight: '600' },
  stats: { fontSize: 14, color: '#2A1E33', fontWeight: '700' },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  url: { fontSize: 13, fontWeight: '700', color: '#E25CAE' },
  tagline: { fontSize: 12.5, color: '#9A8DA6', fontWeight: '600' },
});
