import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Heart, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import type { VoteEventSummary } from '../../api/votes';
import { categoryEmoji, timeRemaining } from './voteHelpers';

/** Status pill colour + label. */
function StatusBadge({ status }: { status: VoteEventSummary['status'] }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const map: Record<string, string> = {
    active: theme.colors.online,
    pending: theme.colors.muted,
    ended: theme.colors.text2,
  };
  return (
    <View style={[styles.badge, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: map[status] }} />
      <Text style={{ color: '#FFFFFF', fontSize: 10.5, fontWeight: '700' }}>
        {t(`votes.status.${status}`)}
      </Text>
    </View>
  );
}

export function VoteEventCard({
  event,
  onPress,
  width,
}: {
  event: VoteEventSummary;
  onPress: () => void;
  width?: number;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const cover = event.coverPhotos[0];
  const tr = timeRemaining(event.endAt);
  const countdown = tr.ended
    ? t('votes.ended')
    : tr.d > 0
      ? t('votes.countdown.days', { d: tr.d, h: tr.h })
      : t('votes.countdown.hm', { h: tr.h, m: tr.m });

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          width,
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.line,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.coverWrap}>
        {cover ? (
          <ExpoImage source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="memory-disk" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.surface2 }]} />
        )}
        <View style={styles.badgeRow}>
          <StatusBadge status={event.status} />
        </View>
        <View style={styles.countdownPill}>
          <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>⏳ {countdown}</Text>
        </View>
      </View>
      <View style={{ padding: 11 }}>
        <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: '700', color: theme.colors.text }}>
          {categoryEmoji(event.category)} {event.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 7 }}>
          <View style={styles.stat}>
            <Users size={13} color={theme.colors.muted} strokeWidth={2} />
            <Text style={{ fontSize: 12.5, color: theme.colors.muted, fontWeight: '600' }}>{event.entryCount}</Text>
          </View>
          <View style={styles.stat}>
            <Heart size={13} color={theme.colors.primary} strokeWidth={2} />
            <Text style={{ fontSize: 12.5, color: theme.colors.muted, fontWeight: '600' }}>{event.voteCount}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  coverWrap: { width: '100%', aspectRatio: 16 / 10, backgroundColor: '#eee' },
  badgeRow: { position: 'absolute', top: 8, left: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  countdownPill: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
