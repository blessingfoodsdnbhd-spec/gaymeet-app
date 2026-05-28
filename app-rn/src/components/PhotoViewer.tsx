import React from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
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
 * Full-screen, swipeable photo viewer rendered as a transparent Modal
 * over the current screen. Drives off a paged horizontal FlatList — no
 * pinch-zoom in v1 (would need a gesture-handler dep), but swipe + page
 * indicator + X close are all there. On Android the hardware back key
 * routes to onRequestClose, so back closes the viewer before propagating
 * to any parent Modal (e.g. the AboutUserSheet that owns this).
 */
export function PhotoViewer({ open, photos, initialIndex = 0, onClose }: Props) {
  const { width, height } = Dimensions.get('window');
  const flatRef = React.useRef<FlatList<string>>(null);
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex);

  React.useEffect(() => {
    if (!open) return;
    setCurrentIndex(initialIndex);
    // Defer to next tick so FlatList has measured before we scroll.
    const id = setTimeout(() => {
      try {
        flatRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      } catch {
        // scrollToIndex can throw if data not yet rendered — ignore;
        // initialScrollIndex on FlatList handles the cold case anyway.
      }
    }, 30);
    return () => clearTimeout(id);
  }, [open, initialIndex]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrentIndex(Math.min(Math.max(idx, 0), photos.length - 1));
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar hidden />
      <View style={styles.root}>
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
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
