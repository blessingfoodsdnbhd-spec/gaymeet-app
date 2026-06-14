import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';

import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeProvider';
import { avatarGradients } from '../../theme/tokens';
import { TagChip } from '../../components/TagChip';
import { tagById, type InterestTagId } from '../../data/interestTags';
import { useTranslation } from 'react-i18next';
import { computeAge, computeZodiac } from '../../utils/zodiac';
import { presenceFrom } from '../../utils/lastActive';
import { FollowBadge } from '../../components/FollowBadge';
import { NameWithBadge } from '../../components/NameWithBadge';
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
  const nav = useNavigation<any>();
  const [a, b] = avatarGradients[user.avatarIdx % avatarGradients.length];
  const initial = (user.nickname || user.email || '?').trim().charAt(0).toUpperCase();

  // All public photos, tap-cycled Tinder-style (left half = prev, right half =
  // next). Falls back to the single avatar. The full-card swipe (like/pass) is
  // owned by CardStack's Pan gesture; these are plain taps, so a drag cancels
  // the Pressable before onPress and the two never fight.
  const photos = useMemo(() => {
    const p = (user.photos ?? []).filter(Boolean);
    if (p.length > 0) return p;
    return user.avatarUrl ? [user.avatarUrl] : [];
  }, [user.photos, user.avatarUrl]);
  const [photoIdx, setPhotoIdx] = useState(0);
  // Guard against a stale index if the photo set ever shrinks.
  const idx = Math.min(photoIdx, Math.max(0, photos.length - 1));
  const currentUrl = photos[idx] ?? null;

  // Memoize the source object so the reference stays stable across re-renders.
  // expo-image rebuilds its decoder + replays `transition` when the source
  // *reference* changes, even if the URI string is identical. That was the
  // "photo flickers when swiping" bug — card B got new `isTop=true` props
  // after a swipe, re-rendered, and got a new `{uri}` literal that fooled
  // expo-image into reloading.
  const imageSource = useMemo(
    () => (currentUrl ? { uri: currentUrl } : null),
    [currentUrl],
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

        {/* Popularity badge — bottom-right of hero, only when they have likes */}
        {!!user.popularity && user.popularity > 0 && (
          <View style={styles.popPill}>
            <Text style={styles.popText}>🔥 {user.popularity}</Text>
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

        {/* Tap zones — left half = previous photo, right half = next. Only the
            top card cycles; non-top cards in the stack stay static. Transparent
            overlays sit above the photo; a drag cancels them so CardStack's
            swipe still drives like/pass. */}
        {isTop && photos.length > 1 && (
          <>
            <Pressable
              style={styles.tapLeft}
              onPress={() => setPhotoIdx((i) => Math.max(0, Math.min(i, photos.length - 1) - 1))}
            />
            <Pressable
              style={styles.tapRight}
              onPress={() => setPhotoIdx((i) => Math.min(photos.length - 1, i + 1))}
            />
          </>
        )}

        {/* Segmented page indicator (Tinder-style) — one bar per photo, the
            active one brightened with the brand accent. */}
        {photos.length > 1 && (
          <View style={styles.segments} pointerEvents="none">
            {photos.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.segment,
                  { backgroundColor: i === idx ? theme.colors.primary : 'rgba(255,255,255,0.5)' },
                ]}
              />
            ))}
          </View>
        )}
      </View>

      {/* Explicit opaque background: the info block must fully cover the card
          behind it in the stack. Relying on the parent `card` background alone
          left a seam where the next card's name (e.g. "Dennis Tan" under the
          top card's "Edi Teh") ghosted through on Android. `surface` is a solid
          #FFFFFF — never an rgba — so nothing behind can bleed in. */}
      <View style={[styles.info, { backgroundColor: theme.colors.surface }]}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
          {/* Tap the NAME → full profile (UserDetail). Only the top card is
              interactive; the ⭐ button is follow, not profile. A tap can't fight
              CardStack's swipe Pan — a drag cancels the Pressable before onPress. */}
          <Pressable
            onPress={isTop ? () => nav.navigate('UserDetail', { userId: user.id }) : undefined}
            disabled={!isTop}
            hitSlop={8}
          >
            <NameWithBadge
              name={user.nickname}
              official={user.isOfficial}
              verified={user.isVerified}
              premium={user.isPremium}
              textStyle={[styles.name, { color: theme.colors.text }]}
              badgeSize={16}
            />
          </Pressable>
          <FollowBadge status={user.followStatus} size={16} />
          {(() => {
            const age = computeAge(user.dob) ?? user.age;
            if (age == null) return null;
            const z = computeZodiac(user.dob);
            return (
              <Text style={{ color: theme.colors.muted, fontSize: 15 }}>
                {age}{z ? ` ${z.emoji}` : ''}
              </Text>
            );
          })()}
        </View>
        {(() => {
          const p = presenceFrom(t, user.lastActiveAt, user.isOnline);
          if (!p) return null;
          return (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -2 }}>
              {p.online && (
                <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: theme.colors.online }} />
              )}
              <Text style={{ fontSize: 12.5, color: p.online ? theme.colors.online : theme.colors.muted }}>
                {p.text}
              </Text>
            </View>
          );
        })()}
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
    // FIXED proportion of the card — never derived from the info section's
    // height. Previously `flex: 1.2` let the photo absorb whatever space was
    // left after the (variable-height) info block, so a profile with no bio
    // got a ~70%-tall photo and one with a bio + 4 tags got ~45%. Swiping
    // between them made the photo visibly jump/flash size. A fixed 62% keeps
    // every card's photo identical regardless of how much info sits below.
    height: '62%',
    flexShrink: 0,
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
  popPill: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  popText: { fontSize: 12, fontWeight: '700', color: '#fff' },
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
  // Tap-to-cycle hit zones over the photo (left = prev, right = next). Top
  // edge starts below the segment indicator so a tap there doesn't fight it.
  tapLeft: { position: 'absolute', top: 24, bottom: 0, left: 0, width: '50%' },
  tapRight: { position: 'absolute', top: 24, bottom: 0, right: 0, width: '50%' },
  // Segmented page indicator across the top of the photo.
  segments: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 4,
  },
  segment: { flex: 1, height: 3, borderRadius: 2 },
  // flex: 1 → fills the remaining ~38% below the fixed-height photo. Content
  // is top-anchored; any surplus shows as surface beneath the tags.
  info: { flex: 1, padding: 18, gap: 10 },
  name: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  bio: { fontSize: 14, lineHeight: 22 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
});
