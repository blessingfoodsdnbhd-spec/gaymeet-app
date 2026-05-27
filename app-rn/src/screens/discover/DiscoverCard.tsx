import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';

import { useTheme } from '../../theme/ThemeProvider';
import { avatarGradients } from '../../theme/tokens';
import { TagChip } from '../../components/TagChip';
import { tagById, type InterestTagId } from '../../data/interestTags';
import { useTranslation } from 'react-i18next';
import type { DiscoverCardUser } from '../../api/discover';

interface Props {
  user: DiscoverCardUser;
  dragX?: SharedValue<number>;
  isTop?: boolean;
}

const STAMP_DISTANCE = 120;

function DiscoverCardInner({ user, dragX, isTop }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [a, b] = avatarGradients[user.avatarIdx % avatarGradients.length];
  const initial = (user.nickname || user.email || '?').trim().charAt(0).toUpperCase();

  // Memoize the source object so the reference stays stable across re-renders.
  // expo-image rebuilds its decoder + replays `transition` when the source
  // *reference* changes, even if the URI string is identical. That was the
  // "photo flickers when swiping" bug — card B got new `isTop=true` props
  // after a swipe, re-rendered, and got a new `{uri}` literal that fooled
  // expo-image into reloading.
  const imageSource = useMemo(
    () => (user.avatarUrl ? { uri: user.avatarUrl } : null),
    [user.avatarUrl],
  );

  const likeStampStyle = useAnimatedStyle(() => {
    if (!dragX || !isTop) return { opacity: 0 };
    return {
      opacity: interpolate(dragX.value, [0, STAMP_DISTANCE], [0, 1], Extrapolation.CLAMP),
    };
  });

  const nopeStampStyle = useAnimatedStyle(() => {
    if (!dragX || !isTop) return { opacity: 0 };
    return {
      opacity: interpolate(dragX.value, [-STAMP_DISTANCE, 0], [1, 0], Extrapolation.CLAMP),
    };
  });

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.line,
        },
        theme.shadows.card,
      ]}
    >
      <View style={styles.hero}>
        {imageSource ? (
          <Image
            source={imageSource}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            // memory-disk: cache decoded bitmap in RAM + persist. Reappearing
            // cards (after stack shift) blit from memory instead of decoding
            // from disk, which would briefly flash an empty hero.
            cachePolicy="memory-disk"
            // transition: 0 → no fade. Cards in the stack are already
            // pre-rendered (we mount top 3), so by the time a card becomes
            // top its image is already on the GPU. Re-running a 150ms fade
            // on every re-render was the visible flicker.
            transition={0}
          />
        ) : (
          <LinearGradient
            colors={[a, b]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          >
            <Text style={styles.heroInitial}>{initial}</Text>
          </LinearGradient>
        )}

        {/* Shared interest pill — top-left */}
        <View style={styles.sharedPill}>
          <View style={[styles.sharedDot, { backgroundColor: theme.colors.primary }]} />
          <Text style={[styles.sharedText, { color: theme.colors.primaryDeep }]}>
            {t('discover.sharedInterests', { n: (user.sharedTags ?? []).length })}
          </Text>
        </View>

        {/* Distance pill — top-right */}
        {user.distance && (
          <View style={styles.distancePill}>
            <Text style={[styles.distanceText, { color: theme.colors.text2 }]}>
              {user.distance}
            </Text>
          </View>
        )}

        {/* LIKE / NOPE stamps */}
        <Animated.View
          style={[
            styles.stamp,
            styles.stampLike,
            { borderColor: theme.colors.like, top: 42, left: 20 },
            likeStampStyle,
          ]}
          pointerEvents="none"
        >
          <Text style={[styles.stampText, { color: theme.colors.like }]}>LIKE</Text>
        </Animated.View>
        <Animated.View
          style={[
            styles.stamp,
            styles.stampNope,
            { borderColor: theme.colors.nope, top: 42, right: 20 },
            nopeStampStyle,
          ]}
          pointerEvents="none"
        >
          <Text style={[styles.stampText, { color: theme.colors.nope }]}>NOPE</Text>
        </Animated.View>
      </View>

      <View style={styles.info}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
          <Text style={[styles.name, { color: theme.colors.text }]}>{user.nickname}</Text>
          {user.age && (
            <Text style={{ color: theme.colors.muted, fontSize: 15 }}>
              {user.age}
            </Text>
          )}
        </View>
        {user.bio && (
          <Text style={[styles.bio, { color: theme.colors.text2 }]} numberOfLines={3}>
            {user.bio}
          </Text>
        )}
        <View style={styles.tagsRow}>
          {((user.interests ?? []) as InterestTagId[])
            .slice(0, 4)
            .map((id) => {
              const tag = tagById(id);
              if (!tag) return null;
              const shared = (user.sharedTags ?? []).includes(id);
              return <TagChip key={id} tag={tag} shared={shared} />;
            })
            .filter(Boolean)}
        </View>
      </View>
    </View>
  );
}

// React.memo: parent CardStack re-renders on every gesture frame (driven by
// shared values + animated style). We want each DiscoverCard to render at
// most once per *card-shape* change (new user, top↔non-top toggle). The
// shared-value `dragX` ref stays stable so it's safe in the comparator.
export const DiscoverCard = React.memo(DiscoverCardInner, (prev, next) => {
  return (
    prev.user.id === next.user.id &&
    prev.user.avatarUrl === next.user.avatarUrl &&
    prev.isTop === next.isTop &&
    prev.dragX === next.dragX
  );
});

const styles = StyleSheet.create({
  card: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
  },
  hero: {
    flex: 1.2,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  heroInitial: {
    fontFamily: 'Fraunces',
    fontStyle: 'italic',
    fontSize: 120,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: -4,
  },
  sharedPill: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  sharedDot: { width: 6, height: 6, borderRadius: 3 },
  sharedText: { fontSize: 12, fontWeight: '600' },
  distancePill: {
    position: 'absolute',
    top: 14,
    right: 14,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  distanceText: { fontSize: 12, fontWeight: '500' },
  stamp: {
    position: 'absolute',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 3,
  },
  stampLike: { transform: [{ rotate: '-12deg' }] },
  stampNope: { transform: [{ rotate: '12deg' }] },
  stampText: { fontSize: 22, fontWeight: '800', letterSpacing: 1.5 },
  info: { padding: 18, gap: 10 },
  name: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  bio: { fontSize: 14, lineHeight: 22 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
});
