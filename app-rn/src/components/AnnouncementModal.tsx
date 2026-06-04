import React, { useEffect, useState } from 'react';
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme/ThemeProvider';

export interface AnnouncementItem {
  id: string;
  imageUrl: string;
  ctaUrl?: string | null;
  title?: string | null;
}

const COUNTDOWN_SECS = 3;

export function announcementDismissKey(id: string) {
  return `meyou:announcement:dismissed:${id}`;
}

/**
 * The visual card for a single announcement — a framed, rounded card with a
 * cover image (fills the frame, no letterboxing) and the title beneath it.
 * Reused by the modal carousel AND the admin live-preview, so the admin sees
 * exactly what users will see. Tapping the image opens `ctaUrl` when set.
 */
export function AnnouncementCard({
  imageUrl,
  title,
  ctaUrl,
  width,
}: {
  imageUrl: string;
  title?: string | null;
  ctaUrl?: string | null;
  /** Optional explicit card width (e.g. for the admin preview box). */
  width?: number;
}) {
  const theme = useTheme();
  const onCtaTap = async () => {
    if (!ctaUrl) return;
    try {
      await Linking.openURL(ctaUrl);
    } catch {
      // Bad URL or no handler — admin-controlled, so swallow silently.
    }
  };
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface },
        theme.shadows.card,
        width ? { width } : null,
      ]}
    >
      <View style={styles.clip}>
        <Pressable onPress={ctaUrl ? onCtaTap : undefined} style={styles.imageBox}>
          <ExpoImage
            source={{ uri: imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={120}
          />
        </Pressable>
        {!!title && (
          <Text
            style={[styles.cardTitle, { color: theme.colors.text }]}
            numberOfLines={2}
          >
            {title}
          </Text>
        )}
      </View>
    </View>
  );
}

/**
 * Full-screen announcement modal. Renders one or more active announcements as
 * a horizontally swipeable carousel (paged, with dots). Close paths:
 *
 *   • Top-left "今後不顯示" — permanently dismiss ALL shown ids (AsyncStorage).
 *   • Top-right "關閉(N)" — countdown 3 → 0, enabled at 0, no persist.
 *   • Backdrop tap — also closes once the countdown ends.
 *
 * Each card opens its own ctaUrl on tap.
 */
export function AnnouncementModal({
  announcements,
  onClose,
}: {
  announcements: AnnouncementItem[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { width: winW } = useWindowDimensions();
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECS);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const tick = setTimeout(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(tick);
  }, [secondsLeft]);

  if (!announcements.length) return null;
  const closeEnabled = secondsLeft <= 0;
  const multi = announcements.length > 1;

  const onDontShow = async () => {
    try {
      await AsyncStorage.multiSet(
        announcements.map((a) => [announcementDismissKey(a.id), '1']),
      );
    } catch {
      // Storage failure is non-fatal — modal simply reappears next launch.
    }
    onClose();
  };

  const closeLabel = closeEnabled
    ? t('announcement.close')
    : `${t('announcement.close')} (${secondsLeft})`;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={closeEnabled ? onClose : undefined}>
        {/* Stop backdrop taps from closing while interacting with the carousel. */}
        <Pressable style={styles.carouselWrap} onPress={() => {}}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) =>
              setPage(Math.round(e.nativeEvent.contentOffset.x / winW))
            }
          >
            {announcements.map((a) => (
              <View key={a.id} style={[styles.page, { width: winW }]}>
                <AnnouncementCard imageUrl={a.imageUrl} title={a.title} ctaUrl={a.ctaUrl} />
              </View>
            ))}
          </ScrollView>

          {multi && (
            <View style={styles.dots} pointerEvents="none">
              {announcements.map((a, i) => (
                <View
                  key={a.id}
                  style={[
                    styles.dot,
                    { backgroundColor: i === page ? '#FFFFFF' : 'rgba(255,255,255,0.4)' },
                  ]}
                />
              ))}
            </View>
          )}
        </Pressable>
      </Pressable>

      <View style={styles.topRow} pointerEvents="box-none">
        <Pressable
          onPress={onDontShow}
          hitSlop={12}
          style={({ pressed }) => [styles.btn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={styles.btnText}>{t('announcement.dontShowAgain')}</Text>
        </Pressable>

        <Pressable
          onPress={closeEnabled ? onClose : undefined}
          disabled={!closeEnabled}
          hitSlop={12}
          style={({ pressed }) => [
            styles.btn,
            { opacity: !closeEnabled ? 0.55 : pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={styles.btnText}>{closeLabel}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselWrap: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  page: { alignItems: 'center', justifyContent: 'center' },
  card: {
    width: '88%',
    maxWidth: 420,
    alignSelf: 'center',
    borderRadius: 16,
  },
  clip: { borderRadius: 16, overflow: 'hidden' },
  imageBox: { width: '100%', aspectRatio: 4 / 5 },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dots: { flexDirection: 'row', gap: 7, marginTop: 18, alignSelf: 'center' },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  topRow: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 28,
    left: 18,
    right: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  btnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
});
