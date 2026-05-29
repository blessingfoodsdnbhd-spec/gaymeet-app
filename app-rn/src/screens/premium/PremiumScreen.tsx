import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, ChevronLeft, Crown, Sparkles } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { brandGradient } from '../../theme/tokens';
import { useAuth } from '../../store/auth';
import { getPricing, IAP_SKUS } from '../../api/subscription';
import { purchaseSubscription, restoreSubscriptions } from '../../utils/iap';
import { PRIVACY_URL, TERMS_URL, openLegal } from '../../utils/legalUrls';

const BENEFIT_KEYS = [
  'directIntro',
  'seeLikes',
  'unlimitedSwipes',
  'readReceipts',
  'biggerBoost',
] as const;

type Plan = 'monthly' | 'annual';

export function PremiumScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const nav = useNavigation();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const [selected, setSelected] = useState<Plan>('annual');
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const pricingQ = useQuery({
    queryKey: ['pricing'],
    queryFn: getPricing,
    // Always re-fetch when opening the screen — pricing can change
    // server-side and a stale value risks the in-app price not matching
    // App Store Connect, which Apple reviewers flag.
    staleTime: 60_000,
    refetchOnMount: 'always',
  });

  const pricing = pricingQ.data;
  const isActive = !!user && (user as any).isPremium === true;
  const expiresIso = (user as any)?.premiumExpiresAt;

  // Restore previously-purchased subscription. Apple guideline 3.1.1
  // requires this button on every IAP-using screen — review rejects
  // builds without it; Play has the same expectation in policy. Calls
  // the native restore flow, then replays the returned receipt /
  // purchaseToken through the matching verify backend path
  // (verify-apple-receipt on iOS, verify-google-purchase on Android),
  // so the server re-grants premium.
  const onRestore = async () => {
    if (restoring || busy) return;
    setRestoring(true);
    try {
      const restored = await restoreSubscriptions();
      if (restored) {
        setUser({ ...(user as any), ...restored });
        Alert.alert(
          t('premium.restoreSuccessTitle'),
          t('premium.restoreSuccessBody'),
        );
      } else {
        Alert.alert(
          t('premium.restoreNothingTitle'),
          t('premium.restoreNothingBody'),
        );
      }
    } catch (e: any) {
      Alert.alert(
        t('premium.restoreFailedTitle'),
        e?.message ?? '',
      );
    } finally {
      setRestoring(false);
    }
  };

  const onSubscribe = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const sku = selected === 'monthly' ? IAP_SKUS.monthly : IAP_SKUS.annual;
      const updated = await purchaseSubscription(sku);
      if (updated) {
        setUser({ ...(user as any), ...updated });
        Alert.alert(t('premium.subscribeSuccessTitle'), t('premium.subscribeSuccessBody'));
        nav.goBack();
      }
    } catch (e: any) {
      const message = e?.message || t('premium.subscribeFailedBody');
      // user cancel — silent
      if (!/cancel/i.test(String(message))) {
        Alert.alert(t('premium.subscribeFailedTitle'), message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <LinearGradient
          colors={[...brandGradient.colors] as [string, string, ...string[]]}
          locations={[...brandGradient.locations] as [number, number, ...number[]]}
          start={brandGradient.start}
          end={brandGradient.end}
          style={styles.heroCard}
        >
          <Crown size={36} color="#FFFFFF" strokeWidth={1.6} />
          <Text style={styles.heroTitle}>Meyou Premium</Text>
          <Text style={styles.heroTagline}>{t('premium.heroTagline')}</Text>
        </LinearGradient>

        {isActive && expiresIso && (
          <Card flat style={{ marginHorizontal: 20, marginTop: -16, padding: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Sparkles size={18} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontWeight: '600' }}>
                  {t('premium.active')}
                </Text>
                <Text style={{ color: theme.colors.muted, fontSize: 12, marginTop: 2 }}>
                  {t('premium.expiresAt', {
                    date: new Date(expiresIso).toLocaleDateString(
                      i18n.language.startsWith('zh') ? 'zh-CN' : 'en-US',
                    ),
                  })}
                </Text>
              </View>
            </View>
          </Card>
        )}

        <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
          <Text style={[styles.section, { color: theme.colors.muted }]}>{t('premium.benefitsSection')}</Text>
          {BENEFIT_KEYS.map((k) => (
            <View key={k} style={styles.benefitRow}>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: theme.colors.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Check size={14} color={theme.colors.primaryDeep} strokeWidth={2.4} />
              </View>
              <Text style={{ fontSize: 15, color: theme.colors.text, flex: 1 }}>
                {t(`premium.benefits.${k}`)}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
          <Text style={[styles.section, { color: theme.colors.muted }]}>{t('premium.plansSection')}</Text>
          {pricingQ.isLoading ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            <View style={{ gap: 12 }}>
              <PlanCard
                plan="annual"
                price={pricing?.annual.price ?? 399.9}
                period={t('premium.perYear')}
                badge={t('premium.saveTwoMonths')}
                monthlyEquivalent={Math.round(((pricing?.annual.price ?? 399.9) / 12) * 10) / 10}
                selected={selected === 'annual'}
                onSelect={() => setSelected('annual')}
              />
              <PlanCard
                plan="monthly"
                price={pricing?.monthly.price ?? 39.9}
                period={t('premium.perMonth')}
                selected={selected === 'monthly'}
                onSelect={() => setSelected('monthly')}
              />
            </View>
          )}
        </View>

        <Text
          style={{
            color: theme.colors.muted,
            fontSize: 11,
            textAlign: 'center',
            marginTop: 18,
            marginHorizontal: 28,
            lineHeight: 16,
          }}
        >
          {t('premium.disclaimer')}
        </Text>

        {/* Legal links — Apple guideline 3.1.2(c) requires the
            subscription screen to expose functional Terms of Use and
            Privacy Policy links. Both URLs are served from the
            backend's /privacy and /terms routes (see backend-express
            public/{privacy,terms}.html). */}
        <View style={styles.legalRow}>
          <Pressable
            onPress={() => openLegal(TERMS_URL)}
            hitSlop={10}
            style={{ padding: 6 }}
          >
            <Text
              style={{
                color: theme.colors.primaryDeep,
                fontSize: 12,
                fontWeight: '500',
                textDecorationLine: 'underline',
              }}
            >
              {t('premium.termsOfUse')}
            </Text>
          </Pressable>
          <Text style={{ color: theme.colors.muted, fontSize: 12 }}>·</Text>
          <Pressable
            onPress={() => openLegal(PRIVACY_URL)}
            hitSlop={10}
            style={{ padding: 6 }}
          >
            <Text
              style={{
                color: theme.colors.primaryDeep,
                fontSize: 12,
                fontWeight: '500',
                textDecorationLine: 'underline',
              }}
            >
              {t('premium.privacyPolicy')}
            </Text>
          </Pressable>
        </View>

        {/* Restore Purchases — Apple guideline 3.1.1. Subtle link
            under the disclaimer; primary CTA stays the subscribe
            button below. */}
        <Pressable
          onPress={onRestore}
          disabled={restoring || busy}
          hitSlop={10}
          style={{ alignSelf: 'center', marginTop: 8, padding: 6 }}
        >
          <Text
            style={{
              color: theme.colors.primaryDeep,
              fontSize: 13,
              fontWeight: '500',
              opacity: restoring || busy ? 0.5 : 1,
            }}
          >
            {restoring ? '…' : t('premium.restore')}
          </Text>
        </Pressable>
      </ScrollView>

      <View style={{ padding: 20 }}>
        <Button
          label={
            selected === 'annual'
              ? t('premium.ctaAnnual', { price: pricing?.annual.price ?? 399.9 })
              : t('premium.ctaMonthly', { price: pricing?.monthly.price ?? 39.9 })
          }
          onPress={onSubscribe}
          loading={busy}
          fullWidth
        />
      </View>
    </SafeAreaView>
  );
}

function PlanCard({
  plan,
  price,
  period,
  badge,
  monthlyEquivalent,
  selected,
  onSelect,
}: {
  plan: Plan;
  price: number;
  period: string;
  badge?: string;
  monthlyEquivalent?: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onSelect}
      style={({ pressed }) => ({
        borderRadius: theme.radius.xl,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? theme.colors.primary : theme.colors.line,
        backgroundColor: theme.colors.surface,
        padding: 18,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: theme.colors.text }}>
          RM {price}
        </Text>
        <Text style={{ color: theme.colors.muted, fontSize: 14 }}>/ {period}</Text>
        {badge && (
          <View
            style={{
              marginLeft: 'auto',
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 999,
              backgroundColor: theme.colors.primarySoft,
            }}
          >
            <Text style={{ color: theme.colors.primaryDeep, fontSize: 11, fontWeight: '600' }}>
              {badge}
            </Text>
          </View>
        )}
      </View>
      {monthlyEquivalent && (
        <Text style={{ color: theme.colors.muted, fontSize: 12, marginTop: 6 }}>
          {t('premium.monthlyEquivalent', { n: monthlyEquivalent })}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 10,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  heroCard: {
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 22,
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 12,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  heroTagline: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
  },
  section: {
    fontSize: 12,
    letterSpacing: 0.72,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
  },
});
