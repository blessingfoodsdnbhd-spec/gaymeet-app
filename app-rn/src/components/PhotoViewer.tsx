import React from 'react';
import {
  BackHandler,
  Dimensions,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { X } from 'lucide-react-native';

interface Props {
  open: boolean;
  photos: string[];
  initialIndex?: number;
  onClose: () => void;
}

/**
 * Full-screen, swipeable photo viewer. Renders as an absolute-fill View
 * (NOT a Modal) so it can be placed inside a parent Modal — e.g. the
 * AboutUserSheet's Sheet — without hitting Android's nested-Modal
 * stacking bug (a second Modal opened while the first is up renders
 * behind it, invisibly).
 *
 * The parent should mount this via the Sheet's `overlay` prop so it
 * lands as a Modal-root sibling, above the backdrop and the sheet card.
 * Hardware back is intercepted via BackHandler when open so back closes
 * the viewer first instead of dismissing the parent Modal.
 */
export function PhotoViewer({ open, photos, initialIndex = 0, onClose }: Props) {
  const { width, height } = Dimensions.get('window');
  const flatRef = React.useRef<FlatList<string>>(null);
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex);

  React.useEffect(() => {
    if (!open) return;
    setCurrentIndex(initialIndex);
    const id = setTimeout(() => {
      try {
        flatRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      } catch {
        // scrollToIndex can throw if data hasn't rendered — initialScrollIndex
        // on FlatList handles the cold case anyway.
      }
    }, 30);
    return () => clearTimeout(id);
  }, [open, initialIndex]);

  // Intercept Android hardware back so it closes the viewer first
  // instead of falling through to the parent Modal's onRequestClose
  // (which would dismiss the whole sheet).
  React.useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [open, onClose]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrentIndex(Math.min(Math.max(idx, 0), photos.length - 1));
  };

  if (!open) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]}>
      <StatusBar hidden />
      <FlatList
        ref={flatRef}
        data={photos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        onMomentumScrollEnd={onMomentumEnd}
        keyExtractor={(item, idx) => `${idx}-${item}`}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        renderItem={({ item }) => (
          <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
            <ExpoImage
              source={{ uri: item }}
              style={{ width, height }}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          </View>
        )}
      />

      <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
        <X size={24} color="#FFFFFF" strokeWidth={2} />
      </Pressable>

      {photos.length > 1 && (
        <View style={styles.indicator}>
          <Text style={styles.indicatorText}>
            {currentIndex + 1} / {photos.length}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#000' },
  closeBtn: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  indicatorText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
});
