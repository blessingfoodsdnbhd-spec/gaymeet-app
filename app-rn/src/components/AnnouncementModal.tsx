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
 * The visual card for a single announcement — a full-bleed 2:3 poster image
 * (cover, rounded). No title/chrome: the image IS the announcement. Reused by
 * the modal carousel AND the admin live-preview. Tapping opens `ctaUrl` if set.
 */
export function AnnouncementCard({
  imageUrl,
  ctaUrl,
  width,
}: {
  imageUrl: string;
  ctaUrl?: string | null;
  /** Optional explicit card width (e.g. for the admin preview box). */
  width?: number;
}) {
  const onCtaTap = async () => {
    if (!ctaUrl) return;
    try {
      await Linking.openURL(ctaUrl);
    } catch {
      // Bad URL or no handler — admin-controlled, so swallow silently.
    }
  };
  return (
    <Pressable
      onPress={ctaUrl ? onCtaTap : undefined}
      style={[styles.card, width ? { width } : null]}
    >
      <ExpoImage
        source={{ uri: imageUrl }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={120}
      />
    </Pressable>
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
      // Store the dismiss TIMESTAMP (not a permanent '1' flag). The bootstrap
      // re-shows the announcement once 24h have passed — matching "今天不显示"
      // (hide for the day, not forever). The old '1' flag dismissed it forever
      // — that was the "按了今天不显示后就再也不出来" bug.
      const now = String(Date.now());
      await AsyncStorage.multiSet(
        announcements.map((a) => [announcementDismissKey(a.id), now]),
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
    <Modal visible animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable
          style={[StyleSheet.absoluteFillObject, styles.backdrop]}
          onPress={closeEnabled ? onClose : undefined}
        >
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
                  <AnnouncementCard imageUrl={a.imageUrl} ctaUrl={a.ctaUrl} />
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

        <View style={styles.topRow}>
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselWrap: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  page: { alignItems: 'center', justifyContent: 'center' },
  card: {
    width: '92%',
    maxWidth: 460,
    aspectRatio: 2 / 3,
    alignSelf: 'center',
    borderRadius: 18,
    overflow: 'hidden',
  },
  dots: { flexDirection: 'row', gap: 6, marginTop: 14, alignSelf: 'center' },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  topRow: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 56,
    left: 18,
    right: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 1000,
    elevation: 1000,
  },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    zIndex: 1001,
    elevation: 1001,
  },
  btnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
});
