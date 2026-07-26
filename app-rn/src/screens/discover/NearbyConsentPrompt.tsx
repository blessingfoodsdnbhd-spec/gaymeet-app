import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { MapPin, EyeOff, Settings2 } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { showToast } from '../../utils/toastBridge';
import { setPrivacy } from '../../api/me';
import { useAuth } from '../../store/auth';

/** Per-device record that the prompt has been answered. Namespaced by user id
 *  so a second account on the same phone still gets asked. */
const seenKey = (userId: string) => `nearby.consent.seen.${userId}`;

/**
 * Apple Guideline 5.1.2(i) — one-time Nearby disclosure.
 *
 * Shown once, the first time a user opens the 附近 tab. It states plainly that
 * they will appear in other people's Nearby list, and offers a real decline:
 * "关闭" flips `nearbyEnabled` off server-side (PATCH /api/me/privacy), which
 * removes them from everyone's grid immediately.
 *
 * This deliberately replaces the vc138 per-session check-in bar. That flow
 * demanded a manual "签到" every 30 minutes and defaulted to invisible, which
 * made the feature unusable — and because no shipped client ever wrote the
 * check-in fields, the matching server filter emptied 附近 for the entire live
 * user base. Consent is recorded once and is durable; visibility stays
 * revocable at any time from Settings › Privacy › "在附近功能中显示我".
 */
export function NearbyConsentPrompt() {
  const theme = useTheme();
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const userId = user?.id ?? null;

  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    AsyncStorage.getItem(seenKey(userId))
      .then((v) => {
        // Already answered on this device, or already opted out elsewhere —
        // either way there's nothing to disclose.
        if (cancelled || v === '1') return;
        setOpen(true);
      })
      .catch(() => {
        // A storage read failure must not block the tab. Staying silent risks
        // never showing the disclosure; showing it again is merely repetitive.
        if (!cancelled) setOpen(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const remember = React.useCallback(async () => {
    if (!userId) return;
    await AsyncStorage.setItem(seenKey(userId), '1').catch(() => {});
  }, [userId]);

  const accept = async () => {
    setOpen(false);
    void remember();
  };

  const decline = async () => {
    setBusy(true);
    try {
      const updated = await setPrivacy({ nearbyVisible: false });
      setUser(updated);
      void remember();
      setOpen(false);
      showToast(t('nearby.consent.optedOut'), 'info');
    } catch {
      // Leave the sheet up so the choice isn't silently lost — the user asked
      // to be hidden and we must not pretend that succeeded.
      showToast(t('nearby.consent.failed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={accept}>
      <View style={styles.wrap}>
        <View style={[styles.glyph, { backgroundColor: theme.colors.primarySoft }]}>
          <MapPin size={theme.iconSize.xl} color={theme.colors.primary} strokeWidth={2} />
        </View>

        <Text style={[styles.title, { color: theme.colors.text }]}>
          {t('nearby.consent.title')}
        </Text>
        <Text style={[styles.body, { color: theme.colors.text2 }]}>
          {t('nearby.consent.body')}
        </Text>

        <View style={styles.bullets}>
          <Bullet
            icon={<MapPin size={16} color={theme.colors.success} strokeWidth={2} />}
            text={t('nearby.consent.bulletApprox')}
          />
          <Bullet
            icon={<Settings2 size={16} color={theme.colors.success} strokeWidth={2} />}
            text={t('nearby.consent.bulletSettings')}
          />
          <Bullet
            icon={<EyeOff size={16} color={theme.colors.success} strokeWidth={2} />}
            text={t('nearby.consent.bulletBlock')}
          />
        </View>

        <Button label={t('nearby.consent.accept')} onPress={accept} disabled={busy} />
        <Button
          label={t('nearby.consent.decline')}
          variant="ghost"
          onPress={decline}
          loading={busy}
          style={{ marginTop: 8 }}
        />
      </View>
    </Sheet>
  );
}

function Bullet({ icon, text }: { icon: React.ReactNode; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.bulletRow}>
      {icon}
      <Text style={[styles.bulletText, { color: theme.colors.text2 }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  glyph: {
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  bullets: { marginTop: 20, marginBottom: 24, gap: 12 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bulletText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
