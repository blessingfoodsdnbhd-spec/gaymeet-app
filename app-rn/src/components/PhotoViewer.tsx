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
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { X } from 'lucide-react-native';

interface Props {
  open: boolean;
  photos: string[];
  initialIndex?: number;
  onClose: () => void;
}

const MAX_SCALE = 8;
const DISMISS_THRESHOLD = 120;

/**
 * One zoomable page. Pinch to zoom (up to 8×), pan when zoomed, double-tap to
 * toggle 1×/2×, single-tap to close, and swipe-down to dismiss when not zoomed.
 * Reports its zoom state up so the pager can disable horizontal paging while
 * a photo is zoomed (otherwise panning a zoomed image would change pages).
 */
function ZoomablePage({
  uri,
  width,
  height,
  onClose,
  onZoomChange,
}: {
  uri: string;
  width: number;
  height: number;
  onClose: () => void;
  onZoomChange: (zoomed: boolean) => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const [zoomed, setZoomed] = React.useState(false);

  const reportZoom = (z: boolean) => {
    setZoomed(z);
    onZoomChange(z);
  };
  const resetZoom = () => {
    'worklet';
    scale.value = withTiming(1);
    savedScale.value = 1;
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    savedTx.value = 0;
    savedTy.value = 0;
    runOnJS(reportZoom)(false);
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 1), MAX_SCALE);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1) resetZoom();
      else runOnJS(reportZoom)(true);
    });

  // Free pan while zoomed.
  const movePan = React.useMemo(
    () =>
      Gesture.Pan()
        .enabled(zoomed)
        .onChange((e) => {
          tx.value += e.changeX;
          ty.value += e.changeY;
        })
        .onEnd(() => {
          savedTx.value = tx.value;
          savedTy.value = ty.value;
        }),
    [zoomed],
  );

  // Swipe-down to dismiss while NOT zoomed. activeOffsetY + failOffsetX so the
  // horizontal pager still owns left/right swipes between photos.
  const dismissPan = React.useMemo(
    () =>
      Gesture.Pan()
        .enabled(!zoomed)
        .activeOffsetY([-14, 14])
        .failOffsetX([-18, 18])
        .onChange((e) => {
          ty.value = e.translationY;
        })
        .onEnd((e) => {
          if (e.translationY > DISMISS_THRESHOLD) runOnJS(onClose)();
          else ty.value = withTiming(0);
        }),
    [zoomed],
  );

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        resetZoom();
      } else {
        scale.value = withTiming(2);
        savedScale.value = 2;
        runOnJS(reportZoom)(true);
      }
    });

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      runOnJS(onClose)();
    });

  const gesture = Gesture.Race(
    Gesture.Simultaneous(pinch, movePan, dismissPan),
    Gesture.Exclusive(doubleTap, singleTap),
  );

  const aStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[{ width, height }, aStyle]}>
          <ExpoImage
            source={{ uri }}
            // recyclingKey ties the decoded bitmap to THIS url. Without it,
            // when the horizontal FlatList recycles a page cell for a new
            // photo set (e.g. opening a different user's viewer), expo-image
            // keeps showing the previous occupant's image — the "same photos
            // for different users" bug.
            recyclingKey={uri}
            style={{ width, height }}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

/**
 * Full-screen, swipeable photo viewer with pinch-zoom. Renders as an
 * absolute-fill View (NOT a Modal) so it can sit inside a parent Modal — e.g.
 * the AboutUserSheet's Sheet — without Android's nested-Modal stacking bug.
 *
 * It wraps its own GestureHandlerRootView because RN Modals create a separate
 * native view tree that the app-root GestureHandlerRootView doesn't reach — so
 * without this, gestures would be dead when the viewer is shown inside a Modal.
 */
export function PhotoViewer({ open, photos, initialIndex = 0, onClose }: Props) {
  const { width, height } = Dimensions.get('window');
  const flatRef = React.useRef<FlatList<string>>(null);
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex);
  const [zoomed, setZoomed] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setCurrentIndex(initialIndex);
    setZoomed(false);
    const id = setTimeout(() => {
      try {
        flatRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      } catch {
        // scrollToIndex can throw before render — initialScrollIndex covers cold.
      }
    }, 30);
    return () => clearTimeout(id);
  }, [open, initialIndex]);

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
    <GestureHandlerRootView style={[StyleSheet.absoluteFill, styles.root]}>
      <StatusBar hidden />
      <FlatList
        // Remount the list when the photo SET changes (different user/persona)
        // so virtualized pages never carry over from the previous viewer.
        key={photos[0] ?? 'pv-empty'}
        ref={flatRef}
        data={photos}
        horizontal
        pagingEnabled
        scrollEnabled={!zoomed}
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        onMomentumScrollEnd={onMomentumEnd}
        keyExtractor={(item, idx) => `${idx}-${item}`}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        renderItem={({ item }) => (
          <ZoomablePage
            uri={item}
            width={width}
            height={height}
            onClose={onClose}
            onZoomChange={setZoomed}
          />
        )}
      />

      <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
        <X size={24} color="#FFFFFF" strokeWidth={2} />
      </Pressable>

      {photos.length > 1 && !zoomed && (
        <View style={styles.indicator}>
          <Text style={styles.indicatorText}>
            {currentIndex + 1} / {photos.length}
          </Text>
        </View>
      )}
    </GestureHandlerRootView>
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
