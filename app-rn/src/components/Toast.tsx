import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';

interface Props {
  message: string | null;
  onHide: () => void;
}

export function Toast({ message, onHide }: Props) {
  const theme = useTheme();
  const opacity = useSharedValue(0);
  const ty = useSharedValue(8);

  useEffect(() => {
    if (!message) return;
    opacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(1800, withTiming(0, { duration: 200 }, (done) => done && runOnJS(onHide)())),
    );
    ty.value = withTiming(0, { duration: 200 });
  }, [message, opacity, ty, onHide]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));

  if (!message) return null;

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          backgroundColor: 'rgba(40,20,10,0.92)',
          borderRadius: theme.radius.m,
        },
        style,
      ]}
      pointerEvents="none"
    >
      <Text style={{ color: '#FFFFFF', fontSize: 13 }}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 110,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
});
