import React, { useEffect } from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Avatar } from '../../components/Avatar';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuth } from '../../store/auth';

const RING_SIZE = 220;
const PULSE_MS = 2400;
const STAGGER_MS = 800;

/** One expanding ripple ring: scales 1→2.4 while fading 0.5→0, on a loop. */
function Ring({ delay, color }: { delay: number; color: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: PULSE_MS, easing: Easing.out(Easing.ease) }), -1, false),
    );
    return () => cancelAnimation(p);
  }, [delay, p]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + p.value * 1.4 }],
    opacity: 0.5 * (1 - p.value),
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        { borderColor: color },
        style,
      ]}
    />
  );
}

/**
 * Full-screen "searching for new friends" radar overlay. Shows the user's own
 * avatar centered with three staggered expanding rings pulsing around it.
 * Purely presentational — the parent runs the search and dismisses it.
 */
export function SearchingOverlay({ open }: { open: boolean }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const me = useAuth((s) => s.user);

  return (
    <Modal visible={open} transparent animationType="fade" statusBarTranslucent>
      <View style={[styles.backdrop, { backgroundColor: theme.colors.bg }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {t('discover.searching.title')}
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
          {t('discover.searching.subtitle')}
        </Text>

        <View style={styles.radar}>
          {open && (
            <>
              <Ring delay={0} color={theme.colors.primary} />
              <Ring delay={STAGGER_MS} color={theme.colors.primary} />
              <Ring delay={STAGGER_MS * 2} color={theme.colors.primary} />
            </>
          )}
          <View style={styles.avatarWrap}>
            <Avatar
              name={me?.nickname ?? '?'}
              uri={me?.avatarUrl}
              avatarIdx={0}
              size={96}
              shape="circle"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 14, marginBottom: 48 },
  radar: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
  },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
});
