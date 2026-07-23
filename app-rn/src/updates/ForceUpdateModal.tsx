import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeProvider';
import { brandGradient } from '../theme/tokens';
import { Button } from '../components/Button';

export type GateMode = 'force' | 'soft';

interface Props {
  visible: boolean;
  mode: GateMode;
  storeUrl: string;
  /** newest store version, shown in the copy */
  latestVersion?: string;
  /** optional admin-authored override message */
  message?: string;
  /** soft mode only — "稍后" dismiss */
  onDismiss?: () => void;
}

/**
 * Force / soft upgrade dialog. Pink-glass, bilingual (copy comes from i18n
 * `update.*`). In `force` mode it cannot be dismissed (no scrim tap, no
 * "later" button, back button swallowed) — the only way out is the store.
 */
export function ForceUpdateModal({
  visible,
  mode,
  storeUrl,
  latestVersion,
  message,
  onDismiss,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const isForce = mode === 'force';

  const openStore = () => {
    const url =
      storeUrl ||
      (Platform.OS === 'ios'
        ? 'https://apps.apple.com/app/id0000000000'
        : 'https://play.google.com/store/apps/details?id=com.meetupnearby.app');
    Linking.openURL(url).catch(() => {});
  };

  const s = styles(theme);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // Android hardware back: swallow in force mode, dismiss in soft mode.
      onRequestClose={isForce ? () => {} : onDismiss}
    >
      <Pressable
        style={s.scrim}
        onPress={isForce ? undefined : onDismiss}
      >
        {/* Stop propagation so taps on the card don't dismiss. */}
        <Pressable style={s.card} onPress={() => {}}>
          <LinearGradient
            colors={[...brandGradient.colors] as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.emojiWrap}
          >
            <Text style={s.emoji}>{isForce ? '🚀' : '✨'}</Text>
          </LinearGradient>

          <Text style={s.title}>
            {isForce ? t('update.forceTitle') : t('update.softTitle')}
          </Text>

          <Text style={s.body}>
            {message?.trim()
              ? message
              : isForce
                ? t('update.forceBody')
                : t('update.softBody')}
          </Text>

          {latestVersion ? (
            <Text style={s.version}>
              {t('update.latestLabel', { version: latestVersion })}
            </Text>
          ) : null}

          <View style={s.actions}>
            <Button label={t('update.cta')} onPress={openStore} fullWidth />
            {!isForce ? (
              <Pressable onPress={onDismiss} style={s.later} hitSlop={8}>
                <Text style={s.laterText}>{t('update.later')}</Text>
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    scrim: {
      flex: 1,
      backgroundColor: 'rgba(31,30,41,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.xl,
    },
    card: {
      width: '100%',
      maxWidth: 380,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.xxl,
      paddingHorizontal: theme.spacing.xxl,
      paddingTop: theme.spacing.xxl,
      paddingBottom: theme.spacing.xl,
      alignItems: 'center',
      ...theme.shadows.pop,
    },
    emojiWrap: {
      width: 72,
      height: 72,
      borderRadius: theme.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.l,
    },
    emoji: { fontSize: 34 },
    title: {
      fontSize: theme.typography.size.h3,
      fontWeight: theme.typography.weight.bold,
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: theme.spacing.s,
    },
    body: {
      fontSize: theme.typography.size.body,
      color: theme.colors.text2,
      textAlign: 'center',
      lineHeight: 22,
    },
    version: {
      fontSize: theme.typography.size.caption,
      color: theme.colors.muted,
      textAlign: 'center',
      marginTop: theme.spacing.m,
    },
    actions: {
      width: '100%',
      marginTop: theme.spacing.xl,
      gap: theme.spacing.s,
    },
    later: { alignSelf: 'center', paddingVertical: theme.spacing.s },
    laterText: {
      fontSize: theme.typography.size.bodySm,
      color: theme.colors.muted,
      fontWeight: theme.typography.weight.medium,
    },
  });
