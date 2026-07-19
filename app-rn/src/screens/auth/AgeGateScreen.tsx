import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '../../components/Button';
import { DateField, formatYMD } from '../../components/DateField';
import { useTheme } from '../../theme/ThemeProvider';
import { patchMe } from '../../api/me';
import { useAuth } from '../../store/auth';

/**
 * 18+ age gate — the single place a missing DOB gets collected.
 *
 * Rendered as a TOP-LEVEL, state-driven screen by RootNavigator (same pattern
 * as InterestGate) whenever the signed-in user has `isAgeVerified !== true`.
 * That one condition covers every way an account can reach the app without a
 * verified birthdate:
 *   • legacy accounts created before the gate existed (`dob === null`)
 *   • first-time Apple/Google sign-ins (no birthdate in the identity token,
 *     and the native sheet runs before we can ask)
 *   • OTP sign-ups, where login and signup are the same endpoint
 *
 * Non-skippable by design: there is no back gesture and no dismiss. The only
 * way out other than supplying an adult DOB is signing out — an escape hatch,
 * not a bypass, so nobody is permanently stranded on this screen.
 *
 * The picker is hard-bounded at today−18y so an underage date can't be chosen;
 * PATCH /users/me re-validates server-side and 400s on `UNDERAGE` regardless.
 */
const MIN_AGE = 18;

export function AgeGateScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const setUser = useAuth((s) => s.setUser);
  const signOut = useAuth((s) => s.signOut);

  const [dob, setDob] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const now = new Date();
  const dobMax = new Date(now.getFullYear() - MIN_AGE, now.getMonth(), now.getDate());
  const dobMin = new Date(now.getFullYear() - 100, now.getMonth(), now.getDate());
  const dobDefault = new Date(now.getFullYear() - 25, now.getMonth(), now.getDate());

  const submit = async () => {
    if (!dob || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const updated = await patchMe({ dob: formatYMD(dob) });
      // Server echoes the saved user with isAgeVerified recomputed — writing it
      // back flips RootNavigator's gate and drops us into the app.
      setUser(updated);
    } catch (e: any) {
      const detail = e?.response?.data?.error || e?.response?.data?.message;
      setErr(detail || t('auth.genericError'));
    } finally {
      setBusy(false);
    }
  };

  const confirmSignOut = () => {
    Alert.alert(t('auth.ageGate.signOutTitle'), t('auth.ageGate.signOutBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('auth.ageGate.signOut'), style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 28, paddingTop: 48, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: theme.radius.xl,
            backgroundColor: theme.colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ShieldCheck size={theme.iconSize.xl} color={theme.colors.primary} strokeWidth={1.8} />
        </View>

        <Text
          style={{
            marginTop: theme.spacing.xl,
            fontSize: theme.typography.size.h2,
            fontWeight: theme.typography.weight.bold,
            color: theme.colors.text,
            letterSpacing: theme.typography.letterSpacing.tight,
          }}
        >
          {t('auth.ageGate.title')}
        </Text>
        <Text
          style={{
            marginTop: theme.spacing.s,
            fontSize: theme.typography.size.bodySm,
            color: theme.colors.text2,
            lineHeight: 21,
          }}
        >
          {t('auth.ageGate.subtitle')}
        </Text>

        <View style={{ marginTop: theme.spacing.xxl }}>
          <DateField
            label={t('auth.dob.label')}
            placeholder={t('auth.dob.placeholder')}
            value={dob}
            onChange={(d) => {
              setDob(d);
              if (err) setErr(null);
            }}
            minDate={dobMin}
            maxDate={dobMax}
            defaultDate={dobDefault}
          />
          <Text
            style={{
              marginTop: theme.spacing.xs,
              fontSize: theme.typography.size.captionSm,
              color: theme.colors.muted,
            }}
          >
            {t('auth.dob.hint')}
          </Text>
        </View>

        {err && (
          <Text
            style={{
              color: theme.colors.error,
              fontSize: theme.typography.size.caption,
              marginTop: theme.spacing.m,
            }}
          >
            {err}
          </Text>
        )}

        <View style={{ marginTop: theme.spacing.xxl }}>
          <Button
            label={t('auth.ageGate.cta')}
            onPress={submit}
            disabled={!dob}
            loading={busy}
            fullWidth
          />
        </View>

        <Pressable onPress={confirmSignOut} style={{ alignSelf: 'center', marginTop: theme.spacing.xxl }}>
          <Text
            style={{
              color: theme.colors.muted,
              fontSize: theme.typography.size.bodySm,
              fontWeight: theme.typography.weight.medium,
            }}
          >
            {t('auth.ageGate.signOut')}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
