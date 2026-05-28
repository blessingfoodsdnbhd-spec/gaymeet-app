import React, { useEffect } from 'react';
import { Modal, Pressable, View, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';

interface Props {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: number | `${number}%`;
  /**
   * Rendered as the topmost sibling INSIDE this Sheet's own Modal —
   * above the backdrop and the sheet card. Use for full-screen overlays
   * (e.g. PhotoViewer) that would otherwise need their own Modal; on
   * Android, opening a second Modal while this one is up stacks the
   * new Modal behind the existing one (RN nested-Modal limitation),
   * so we keep them in one window via this prop.
   */
  overlay?: React.ReactNode;
}

export function Sheet({ open, onClose, children, maxHeight = '85%', overlay }: Props) {
  const theme = useTheme();
  const { height: winH } = useWindowDimensions();
  const ty = useSharedValue(winH);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (open) {
      ty.value = withTiming(0, { duration: 320, easing: Easing.bezier(0.2, 0.7, 0.2, 1) });
      opacity.value = withTiming(1, { duration: 250 });
    } else {
      ty.value = withTiming(winH, { duration: 220 });
      opacity.value = withTiming(0, { duration: 180 });
    }
  }, [open, winH, ty, opacity]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));

  return (
    <Modal visible={open} transparent onRequestClose={onClose} animationType="none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(30,15,5,0.35)' }, backdropStyle]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 14,
            paddingBottom: 28,
            maxHeight,
          },
          theme.shadows.pop,
          sheetStyle,
        ]}
      >
        <View
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: theme.colors.line,
            alignSelf: 'center',
            marginBottom: 14,
          }}
        />
        {children}
      </Animated.View>
      {overlay}
    </Modal>
  );
}
