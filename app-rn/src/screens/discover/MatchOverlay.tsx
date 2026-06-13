import React, { useEffect } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Heart } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { brandGradient } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import { tagById } from '../../data/interestTags';
import type { User } from '../../api/me';
import type { DiscoverCardUser } from '../../api/discover';

interface Props {
  open: boolean;
  matchedUser: DiscoverCardUser | null;
  me: User | null;
  onMessage: () => void;
  onLater: () => void;
}

export function MatchOverlay({ open, matchedUser, me, onMessage, onLater }: Props) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const opacity = useSharedValue(0);
  const popScale = useSharedValue(0.9);

  useEffect(() => {
    if (open) {
      opacity.value = withTiming(1, { duration: 250 });
      popScale.value = withDelay(
        100,
        withSequence(
          withTiming(1.04, { duration: 220, easing: Easing.bezier(0.2, 0.7, 0.2, 1) }),
          withTiming(1, { duration: 140 }),
        ),
      );
    } else {
      opacity.value = 0;
      popScale.value = 0.9;
    }
  }, [open, opacity, popScale]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: popScale.value }] }));

  if (!matchedUser) return null;

  const isZh = i18n.language?.startsWith('zh');
  const sharedZh = (matchedUser.sharedTags ?? [])
    .map((id) => {
      const tag = tagById(id);
      return tag ? (isZh ? tag.zh : tag.en) : undefined;
    })
    .filter(Boolean)
    .join(' · ');

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onLater} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, fadeStyle]}>
        <LinearGradient
          colors={[...brandGradient.colors] as [string, string, ...string[]]}
          locations={[...brandGradient.locations] as [number, number, ...number[]]}
          start={brandGradient.start}
          end={brandGradient.end}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.center}>
          <Animated.View style={[{ alignItems: 'center' }, popStyle]}>
            <Text style={styles.title}>{t('match.title')}</Text>
            <Text style={styles.subtitle}>{t('match.subtitle')}</Text>
          </Animated.View>

          <View style={styles.avatarRow}>
            <Avatar
              name={me?.nickname}
              uri={me?.avatarUrl}
              avatarIdx={0}
              size={96}
              shape="circle"
            />
            <View style={styles.heartCircle}>
              <Heart size={24} color="#FFFFFF" fill="#FFFFFF" />
            </View>
            <Avatar
              name={matchedUser.nickname}
              uri={matchedUser.avatarUrl}
              avatarIdx={matchedUser.avatarIdx}
              size={96}
              shape="circle"
            />
          </View>

          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <Text style={styles.bothLove}>
              {t('match.bothLove', { name: matchedUser.nickname })}
            </Text>
            {/* Only render the shared-tags line when there's actually
                something to show. With an empty sharedTags array the old
                code rendered "  有同样的兴趣" — looked like a blank fill-
                in. If the matched user happens to have zero overlap,
                better to suppress the line entirely than render
                a misleading template. */}
            {sharedZh ? (
              <Text style={styles.sharedRow}>{sharedZh} {t('match.sharedSuffix')}</Text>
            ) : null}
          </View>

          <Pressable onPress={onMessage} style={styles.primary}>
            <Text style={[styles.primaryText, { color: theme.colors.primaryDeep }]}>
              {t('match.sendCta')}
            </Text>
          </Pressable>
          <Pressable onPress={onLater}>
            <Text style={styles.later}>{t('match.later')}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  title: {
    fontFamily: 'Fraunces',
    fontSize: 54,
    fontWeight: '500',
    fontStyle: 'italic',
    letterSpacing: -1,
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 6,
    letterSpacing: 1.4,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginTop: 40,
    marginBottom: 36,
  },
  heartCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bothLove: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  sharedRow: { color: 'rgba(255,255,255,0.92)', fontSize: 14, marginTop: 6 },
  primary: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontSize: 16, fontWeight: '600' },
  later: { color: 'rgba(255,255,255,0.9)', marginTop: 14, fontSize: 14 },
});
