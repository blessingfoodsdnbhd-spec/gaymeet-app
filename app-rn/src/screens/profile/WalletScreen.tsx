import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../theme/ThemeProvider';
import { SettingsShell, SettingsCard } from './settings/SettingsShell';
import { useAuth } from '../../store/auth';
import { getCoinBalance, getCoinPackages, purchaseCoins, type CoinPackage } from '../../api/coins';

// Recharge (coin purchase) is hidden for now — flip this one flag to bring the
// whole 充值 section back. The balance hero + "how to earn" card stay visible.
const RECHARGE_ENABLED = false;

// Earn sources surfaced in the "how to earn" card. Amounts mirror the backend
// COIN_REWARDS / streak coinReward tiers. Invite is intentionally NOT here — it
// has its own dedicated 邀请朋友 screen (邀请码 + both-sides 30-day Premium), so a
// second wallet entry would duplicate it.
const EARN_ROWS: { key: string; coins: string }[] = [
  { key: 'checkin', coins: '+5~200' },
  { key: 'profile', coins: '+50' },
  { key: 'vote', coins: '+5' },
];

export function WalletScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);

  const [balance, setBalance] = useState<number>(user?.coins ?? 0);
  const [packages, setPackages] = useState<CoinPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([getCoinBalance(), getCoinPackages()])
      .then(([b, pks]) => {
        if (!alive) return;
        setBalance(b.balance);
        setPackages(pks);
        if (user) setUser({ ...(user as any), coins: b.balance });
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onBuy = async (pkg: CoinPackage) => {
    if (buying) return;
    setBuying(pkg.id);
    try {
      const res = await purchaseCoins(pkg.id);
      setBalance(res.newBalance);
      if (user) setUser({ ...(user as any), coins: res.newBalance });
      Alert.alert(t('wallet.purchaseSuccess', { n: res.purchased }));
    } catch (e: any) {
      Alert.alert(t('wallet.purchaseFailed'), e?.response?.data?.error || e?.message || '');
    } finally {
      setBuying(null);
    }
  };

  return (
    <SettingsShell title={t('wallet.title')}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Balance hero */}
        <View
          style={[
            styles.hero,
            { backgroundColor: theme.colors.primarySoft, borderRadius: theme.radius.xl },
          ]}
        >
          <Text style={styles.coinEmoji}>🪙</Text>
          <Text style={[styles.balance, { color: theme.colors.primaryDeep }]}>{balance}</Text>
          <Text style={[styles.balanceLabel, { color: theme.colors.primaryDeep }]}>
            {t('wallet.balanceLabel')}
          </Text>
        </View>

        {/* Recharge packs — hidden behind RECHARGE_ENABLED (coin purchase paused). */}
        {RECHARGE_ENABLED && (
          <>
            <Text style={[styles.section, { color: theme.colors.muted }]}>{t('wallet.rechargeSection')}</Text>
            {loading ? (
              <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 24 }} />
            ) : (
              <SettingsCard flat style={{ paddingVertical: 4 }}>
                {packages.map((p, i) => (
                  <Pressable
                    key={p.id}
                    onPress={() => onBuy(p)}
                    disabled={!!buying}
                    style={({ pressed }) => [
                      styles.packRow,
                      { borderTopColor: theme.colors.line, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={styles.packEmoji}>🪙</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text }}>
                        {p.coins + p.bonus} {t('wallet.coins')}
                        {p.bonus > 0 ? `  (+${p.bonus})` : ''}
                      </Text>
                      {(p.popular || p.bestValue) && (
                        <Text style={{ fontSize: 12, color: theme.colors.primaryDeep, fontWeight: '600', marginTop: 2 }}>
                          {p.bestValue ? t('wallet.bestValue') : t('wallet.popular')}
                        </Text>
                      )}
                    </View>
                    {buying === p.id ? (
                      <ActivityIndicator color={theme.colors.primary} />
                    ) : (
                      <View style={[styles.priceTag, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.pill }]}>
                        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>
                          {p.currency} {p.price.toFixed(2)}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                ))}
              </SettingsCard>
            )}
            <Text style={[styles.mockNote, { color: theme.colors.muted }]}>{t('wallet.mockNote')}</Text>
          </>
        )}

        {/* How to earn */}
        <Text style={[styles.section, { color: theme.colors.muted }]}>{t('wallet.earnSection')}</Text>
        <SettingsCard flat style={{ paddingVertical: 4 }}>
          {EARN_ROWS.map((row, i) => (
            <View
              key={row.key}
              style={[
                styles.earnRow,
                { borderTopColor: theme.colors.line, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth },
              ]}
            >
              <Text style={{ flex: 1, fontSize: 15, color: theme.colors.text }}>
                {t(`wallet.earn.${row.key}`)}
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '800', color: theme.colors.success }}>{row.coins}</Text>
            </View>
          ))}
        </SettingsCard>
      </ScrollView>
    </SettingsShell>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: 28, marginBottom: 8 },
  coinEmoji: { fontSize: 40 },
  balance: { fontSize: 48, fontWeight: '800', lineHeight: 54, marginTop: 4 },
  balanceLabel: { fontSize: 13, fontWeight: '600' },
  section: {
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontWeight: '700',
    paddingHorizontal: 4,
    paddingTop: 18,
    paddingBottom: 8,
  },
  packRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, gap: 12 },
  packEmoji: { fontSize: 24 },
  priceTag: { paddingHorizontal: 14, paddingVertical: 7 },
  earnRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13 },
  mockNote: { fontSize: 11.5, paddingHorizontal: 4, paddingTop: 8, lineHeight: 16 },
});
