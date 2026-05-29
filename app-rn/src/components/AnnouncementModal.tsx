import React, { useEffect, useState } from 'react';
import {
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Props {
  id: string;
  imageUrl: string;
  ctaUrl?: string | null;
  onClose: () => void;
}

const COUNTDOWN_SECS = 3;

export function announcementDismissKey(id: string) {
  return `meyou:announcement:dismissed:${id}`;
}

/**
 * Full-screen admin-managed announcement modal. Shows once per app session
 * (the bootstrap component decides) and offers two close paths:
 *
 *   • Top-left "今後不顯示" — permanent dismiss for this id; AsyncStorage
 *     key meyou:announcement:dismissed:<id> = '1'
 *   • Top-right "關閉(N)" — countdown from 3 → 0, enabled at 0, no persist
 *     (will show again on next cold start)
 *
 * Background tap is also a close path, but only after countdown ends.
 *
 * Image tap (if ctaUrl set) → Linking.openURL. The URL is admin-controlled
 * so we trust it; openURL itself will refuse unknown schemes safely.
 */
export function AnnouncementModal({ id, imageUrl, ctaUrl, onClose }: Props) {
  const { t } = useTranslation();
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECS);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const tick = setTimeout(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearTimeout(tick);
  }, [secondsLeft]);

  const closeEnabled = secondsLeft <= 0;

  const onDontShow = async () => {
    try {
      await AsyncStorage.setItem(announcementDismissKey(id), '1');
    } catch {
      // Storage write failure is non-fatal — worst case the modal
      // re-appears next launch.
    }
    onClose();
  };

  const onCtaTap = async () => {
    if (!ctaUrl) return;
    try {
      await Linking.openURL(ctaUrl);
    } catch {
      // Bad URL or no handler — silently ignore. Admin-controlled, so
      // we don't surface an error to the end user.
    }
  };

  const onBackdropTap = () => {
    if (closeEnabled) onClose();
  };

  const closeLabel = closeEnabled
    ? t('announcement.close')
    : `${t('announcement.close')} (${secondsLeft})`;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      {/* Backdrop — taps close iff countdown finished. We use a Pressable
          so the entire dim area is hit-testable, but the image inside
          stops propagation by being its own Pressable. */}
      <Pressable style={styles.backdrop} onPress={onBackdropTap}>
        <View style={styles.imageWrap} pointerEvents="box-none">
          <Pressable onPress={ctaUrl ? onCtaTap : undefined} style={styles.imagePressable}>
            <Image
              source={{ uri: imageUrl }}
              style={styles.image}
              resizeMode="contain"
            />
          </Pressable>
        </View>
      </Pressable>

      {/* Top-row buttons sit ABOVE the backdrop so taps on them never
          fall through to the dismiss-after-countdown handler. */}
      <View style={styles.topRow} pointerEvents="box-none">
        <Pressable
          onPress={onDontShow}
          hitSlop={12}
          style={({ pressed }) => [
            styles.btn,
            { opacity: pressed ? 0.7 : 1 },
          ]}
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
  imageWrap: {
    width: '88%',
    aspectRatio: 1,
    maxWidth: 420,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePressable: {
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
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
  btnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
