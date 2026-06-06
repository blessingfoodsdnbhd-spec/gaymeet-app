import React from 'react';
import { View, Text, Pressable, ScrollView, useWindowDimensions, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';
import { brandGradient } from '../../theme/tokens';
import { useOnboarding } from '../../store/onboarding';

const SLIDES = [
  { key: '1', emoji: '🏆' },
  { key: '2', emoji: '🌍' },
  { key: '3', emoji: '📍' },
  { key: '4', emoji: '🎙' },
  { key: '5', emoji: '💜' },
];

/**
 * First-run intro shown to genuinely new accounts before the main app. Five
 * swipeable slides introducing the community pillars (contests, world plaza,
 * nearby, voice intro) and a welcome CTA. Finishing marks onboarded + lands the
 * user on the Profile tab so the completion card prompts them to fill it in.
 */
export function OnboardingFlow() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const complete = useOnboarding((s) => s.complete);
  const scrollRef = React.useRef<ScrollView>(null);
  const [page, setPage] = React.useState(0);
  const last = SLIDES.length - 1;

  const goTo = (p: number) => {
    scrollRef.current?.scrollTo({ x: p * width, animated: true });
    setPage(p);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      {/* Skip */}
      <View style={styles.topBar}>
        <Pressable onPress={complete} hitSlop={10}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.muted }}>{t('onboarding.skip')}</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s) => (
          <View key={s.key} style={{ width, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 }}>
            <LinearGradient
              colors={[...brandGradient.colors] as [string, string, ...string[]]}
              locations={[...brandGradient.locations] as [number, number, ...number[]]}
              start={brandGradient.start}
              end={brandGradient.end}
              style={styles.hero}
            >
              <Text style={{ fontSize: 64 }}>{s.emoji}</Text>
            </LinearGradient>
            <Text style={[styles.title, { color: theme.colors.text }]}>{t(`onboarding.${s.key}.title`)}</Text>
            <Text style={[styles.subtitle, { color: theme.colors.muted }]}>{t(`onboarding.${s.key}.subtitle`)}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Dots */}
      <View style={styles.dots}>
        {SLIDES.map((s, i) => (
          <View
            key={s.key}
            style={[
              styles.dot,
              {
                width: i === page ? 22 : 7,
                backgroundColor: i === page ? theme.colors.primary : theme.colors.line,
              },
            ]}
          />
        ))}
      </View>

      {/* CTA */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 12 }}>
        {page < last ? (
          <Button label={t('onboarding.next')} onPress={() => goTo(page + 1)} fullWidth />
        ) : (
          <Button label={t('onboarding.done')} onPress={complete} fullWidth />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 22, paddingTop: 8, height: 36 },
  hero: { width: 150, height: 150, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 36 },
  title: { fontSize: 24, fontWeight: '900', textAlign: 'center' },
  subtitle: { fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 14 },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, paddingVertical: 18 },
  dot: { height: 7, borderRadius: 4 },
});
