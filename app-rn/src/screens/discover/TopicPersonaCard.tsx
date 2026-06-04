import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import type { TopicPersonaListItem } from '../../api/topics';
import { computeAge, computeZodiac } from '../../utils/zodiac';

interface Props {
  item: TopicPersonaListItem;
  width: number;
  height?: number;
  onPress: () => void;
}

/**
 * Topic-tab grid tile. Visual structure mirrors NearbyGrid.Tile so the
 * topic tab feels like an extension of Nearby rather than a separate
 * grid system — same square-with-gradient-overlay look, same compact
 * caption (nickname + optional age line below).
 *
 * The "ME" badge in the top-right is the one detail that doesn't
 * appear in Nearby — it's specific to topic personas where the user's
 * own row is pinned to the top of the first page so they can confirm
 * their upload landed.
 */
export function TopicPersonaCard({ item, width, height, onPress }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  // Square by default (matching NearbyGrid). Caller may override.
  const tileH = height ?? width;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width,
        height: tileH,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={[styles.tileBg, { backgroundColor: theme.colors.surface2 }]}>
        {item.photo0 ? (
          <ExpoImage
            source={{ uri: item.photo0 }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={120}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: theme.colors.surface2 },
            ]}
          />
        )}

        {/* ME badge — only on the requester's own persona, pinned by
            the backend to the top of the first page. */}
        {item.isSelf && (
          <View
            style={[
              styles.selfBadge,
              { backgroundColor: theme.colors.primary },
            ]}
          >
            <Text style={styles.selfBadgeText}>{t('topics.youBadge')}</Text>
          </View>
        )}

        {/* Bottom gradient + caption — colors / sizing match
            NearbyGrid.Tile so the two tabs read as a single design. */}
        <LinearGradient
          colors={['rgba(20,10,5,0)', 'rgba(20,10,5,0.65)']}
          style={styles.tileOverlay}
        >
          <Text style={styles.tileName} numberOfLines={1}>
            {item.nickname}
          </Text>
          {(() => {
            const a = computeAge(item.dob) ?? item.age;
            if (a == null) return null;
            const z = computeZodiac(item.dob);
            return <Text style={styles.tileSub}>· {a}{z ? ` ${z.emoji}` : ''}</Text>;
          })()}
        </LinearGradient>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tileBg: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  tileOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    paddingBottom: 7,
    paddingTop: 22,
  },
  tileName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  tileSub: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  selfBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  selfBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
