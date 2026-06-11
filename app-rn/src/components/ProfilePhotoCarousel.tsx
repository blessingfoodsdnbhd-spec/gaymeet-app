import React from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';

import { useTheme } from '../theme/ThemeProvider';

type Props = {
  /** Ordered photo urls. Empty → renders `empty` centered in the frame. */
  photos: string[];
  /** Frame width — a full page is one `width` so paging snaps one photo at a time. */
  width: number;
  /** Frame height. Pick from an aspect ratio (e.g. `width * 1.25` for 4:5). */
  height: number;
  /** Tap a photo → open the fullscreen zoom viewer. */
  onPressPhoto?: (photos: string[], index: number) => void;
  /** Centered content when there are no photos (avatar fallback / add-photo hint). */
  empty?: React.ReactNode;
  /** Absolutely-positioned controls layered on top of the carousel. */
  overlay?: React.ReactNode;
  /** Container override — e.g. negative horizontal margin for a full-bleed break-out. */
  style?: StyleProp<ViewStyle>;
};

/**
 * Full-width, page-snapped photo carousel used on profile screens — the
 * immersive Tinder/Hinge-style gallery. Each photo fills one `width`, paging
 * advances exactly one photo, and a dots indicator tracks position. Shared by
 * UserDetailScreen (stranger / self-preview) and ProfileScreen (我 tab) so the
 * two stay visually identical.
 */
export function ProfilePhotoCarousel({
  photos,
  width,
  height,
  onPressPhoto,
  empty,
  overlay,
  style,
}: Props) {
  const theme = useTheme();
  const [page, setPage] = React.useState(0);

  return (
    <View
      style={[
        { width, height, backgroundColor: theme.colors.surface2, overflow: 'hidden' },
        style,
      ]}
    >
      {photos.length > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) =>
            setPage(Math.round(e.nativeEvent.contentOffset.x / width))
          }
        >
          {photos.map((url, idx) => (
            <Pressable
              key={`pc-${idx}-${url}`}
              onPress={onPressPhoto ? () => onPressPhoto(photos, idx) : undefined}
              style={{ width, height }}
            >
              <ExpoImage
                source={{ uri: url }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                cachePolicy="memory-disk"
                // VVVVV/MMMM — full-res decode. The same gallery url is also
                // rendered small elsewhere (discover/nearby grids); without this
                // the large carousel reuses that grid-sized decode → blurry 格子.
                allowDownscaling={false}
                priority="high"
              />
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          {empty}
        </View>
      )}

      {photos.length > 1 && (
        <View style={styles.dots} pointerEvents="none">
          {photos.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === page ? '#FFFFFF' : 'rgba(255,255,255,0.5)' },
              ]}
            />
          ))}
        </View>
      )}

      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
