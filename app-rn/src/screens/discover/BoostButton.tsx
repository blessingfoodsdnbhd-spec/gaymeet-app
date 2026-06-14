import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import { Zap } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { useAuth } from '../../store/auth';
import { RadarPulse } from '../../components/RadarPulse';
import { activateBoost } from '../../api/boost';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Mirrors backend COIN_REWARDS.boostCost. Premium users boost free.
const BOOST_COST = 50;

/**
 * Boost button — lives in the DiscoverScreen TopBar.
 *
 *  Idle (not boosted):
 *   - free user → tap → Premium paywall
 *   - premium → tap → confirm Alert → POST /users/boost → enter Active state
 *
 *  Active (server returned isBoosted + boostExpiresAt within 30-min window):
 *   - pill morph: ⚡ + mm:ss countdown updated every 1s from local clock
 *   - tap → no-op Alert ("already active")
 *   - when countdown hits 0 → flip back to Idle (clears local user fields)
 *
 * The auth store hydrates isBoosted / boostExpiresAt on getMe() — so a
 * user who already activated boost in a previous app session sees the
 * countdown resume automatically.
 */
export function BoostButton() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const isPremium = !!(user as any)?.isPremium;

  const expiresIso = (user as any)?.boostExpiresAt as string | null | undefined;
  const expiresAt = expiresIso ? new Date(expiresIso).getTime() : 0;
  const [now, setNow] = useState(() => Date.now());
  const remainingMs = expiresAt - now;
  const isActive = !!(user as any)?.isBoosted && remainingMs > 0;

  // 1-Hz tick only while active — otherwise we'd run forever for nothing.
  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isActive]);

  // When the local clock crosses boostExpiresAt, clear the local fields so
  // the badge collapses back to the idle button without a refetch.
  useEffect(() => {
    if (!user) return;
    const stillBoosted = (user as any).isBoosted;
    if (stillBoosted && expiresAt > 0 && now >= expiresAt) {
      setUser({ ...(user as any), isBoosted: false, boostExpiresAt: null });
    }
  }, [now, expiresAt, user, setUser]);

  const onActivate = useCallback(async () => {
    try {
      const res = await activateBoost();
      // Hydrate local user so the badge appears instantly (+ new balance if paid).
      if (user) {
        setUser({
          ...(user as any),
          isBoosted: true,
          boostExpiresAt: res.boostExpiresAt,
          ...(res.balance != null ? { coins: res.balance } : {}),
        });
      }
      Alert.alert(t('boost.activated'));
    } catch (e: any) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.error || e?.message || '';
      // Backend uses "Boost already active" as exact text.
      if (/already active/i.test(detail)) {
        Alert.alert(t('boost.alreadyActive'));
      } else if (status === 402 || /insufficient/i.test(detail)) {
        Alert.alert(t('boost.insufficientTitle'), t('boost.insufficientBody', { cost: BOOST_COST }), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('boost.getCoins'), onPress: () => nav.navigate('Wallet') },
        ]);
      } else {
        Alert.alert(t('boost.activateFailed'), detail);
      }
    }
  }, [user, setUser, t, nav]);

  const onPress = () => {
    if (isActive) {
      Alert.alert(t('boost.alreadyActive'));
      return;
    }
    if (isPremium) {
      // Premium boosts free.
      Alert.alert(t('boost.confirmTitle'), t('boost.confirmBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('boost.confirmCta'), onPress: onActivate },
      ]);
      return;
    }
    // Free users pay coins.
    Alert.alert(t('boost.confirmTitle'), t('boost.coinConfirmBody', { cost: BOOST_COST }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('boost.confirmCta'), onPress: onActivate },
    ]);
  };

  if (isActive) {
    const mm = Math.floor(remainingMs / 60_000);
    const ss = Math.floor((remainingMs % 60_000) / 1000);
    const time = `${mm}:${String(ss).padStart(2, '0')}`;
    return (
      // Subtle radar pulse around the pill = "you're being amplified" cue while
      // Boost is live (Option A). Rings sit behind the pill, pointer-events none.
      <View style={styles.activeWrap}>
        <RadarPulse
          size={44}
          color="#F4B400"
          rings={2}
          stagger={900}
          duration={2200}
          maxScale={2.2}
          baseOpacity={0.4}
        />
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            styles.activePill,
            { backgroundColor: '#FFEDB3', borderColor: '#F4B400' },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Zap size={14} color="#7A5400" strokeWidth={2.4} fill="#F4B400" />
          <Text style={[styles.activeText, { color: '#7A5400' }]}>{time}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.idleBtn,
        { backgroundColor: theme.colors.surface2 },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Zap size={18} color={theme.colors.text} strokeWidth={1.8} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  activeWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  idleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  activeText: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
