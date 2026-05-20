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

import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { brandGradient } from '../../theme/tokens';
import { useAuth } from '../../store/auth';
import { getPricing, IAP_SKUS } from '../../api/subscription';
import { purchaseSubscription } from '../../utils/iap';

const BENEFITS = [
  '给还没 match 的人直接发消息',
  '看谁喜欢了你',
  '无限滑卡片',
  '"已读"回执',
  '加大 Boost 曝光',
];

type Plan = 'monthly' | 'annual';

export function PremiumScreen() {
  const theme = useTheme();
  const nav = useNavigation();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const [selected, setSelected] = useState<Plan>('annual');
  const [busy, setBusy] = useState(false);

  const pricingQ = useQuery({
    queryKey: ['pricing'],
    queryFn: getPricing,
    staleTime: 24 * 3600_000,
  });

  const pricing = pricingQ.data;
  const isActive = !!user && (user as any).isPremium === true;
  const expiresIso = (user as any)?.premiumExpiresAt;

  const onSubscribe = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const sku = selected === 'monthly' ? IAP_SKUS.monthly : IAP_SKUS.annual;
      const updated = await purchaseSubscription(sku);
      if (updated) {
        setUser({ ...(user as any), ...updated });
        Alert.alert('订阅成功', '欢迎成为 Premium 会员!');
        nav.goBack();
      }
    } catch (e: any) {
      const message = e?.message || '订阅失败,稍后再试';
      // user cancel — silent
      if (!/cancel/i.test(String(message))) {
        Alert.alert('订阅失败', message);
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
          <Text style={styles.heroTagline}>解锁全部功能,找到真同好</Text>
        </LinearGradient>

        {isActive && expiresIso && (
          <Card flat style={{ marginHorizontal: 20, marginTop: -16, padding: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Sparkles size={18} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontWeight: '600' }}>
                  你已是 Premium 会员
                </Text>
                <Text style={{ color: theme.colors.muted, fontSize: 12, marginTop: 2 }}>
                  到期: {new Date(expiresIso).toLocaleDateString('zh-CN')}
                </Text>
              </View>
            </View>
          </Card>
        )}

        <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
          <Text style={[styles.section, { color: theme.colors.muted }]}>专属权益</Text>
          {BENEFITS.map((b) => (
            <View key={b} style={styles.benefitRow}>
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
              <Text style={{ fontSize: 15, color: theme.colors.text, flex: 1 }}>{b}</Text>
            </View>
          ))}
        </View>

        <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
          <Text style={[styles.section, { color: theme.colors.muted }]}>选择套餐</Text>
          {pricingQ.isLoading ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            <View style={{ gap: 12 }}>
              <PlanCard
                plan="annual"
                price={pricing?.annual.price ?? 399}
                period="年"
                badge="省 2 个月"
                monthlyEquivalent={Math.round(((pricing?.annual.price ?? 399) / 12) * 10) / 10}
                selected={selected === 'annual'}
                onSelect={() => setSelected('annual')}
              />
              <PlanCard
                plan="monthly"
                price={pricing?.monthly.price ?? 39.9}
                period="月"
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
          订阅会自动续费,可在 App Store → Apple ID → 订阅 取消。续费会在到期前 24 小时扣款。
        </Text>
      </ScrollView>

      <View style={{ padding: 20 }}>
        <Button
          label={
            selected === 'annual'
              ? `年费 RM ${pricing?.annual.price ?? 399}`
              : `月费 RM ${pricing?.monthly.price ?? 39.9}`
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
          ≈ RM {monthlyEquivalent} / 月
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
