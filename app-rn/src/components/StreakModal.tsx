import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';
import type { StreakStatus } from '../api/streak';

// Coin reward per milestone — mirrors backend coinReward() tiers so the chips
// show the correct prize. (1=base daily, 3/7/30 = bonuses.)
const MILESTONE_COINS: Record<number, number> = { 1: 5, 3: 15, 7: 50, 30: 200 };

/**
 * Daily login-streak check-in celebration. A centered fade card (NOT a slide
 * Modal — those mis-position under Android 15 edge-to-edge). Shown once per UTC
 * day by StreakBootstrap. The streak + coins are already granted server-side;
 * this just celebrates and surfaces the reward.
 */
export function StreakModal({ status, onClose }: { status: StreakStatus; onClose: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();

  const current = status.current || 0;
  const milestones = status.milestones?.length ? status.milestones : [1, 3, 7, 30];

  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.xxl }]}
          onPress={() => {}}
        >
          <Text style={styles.flame}>🔥</Text>
          <Text style={[styles.title, { color: theme.colors.text }]}>{t('streak.title')}</Text>

          <Text style={[styles.bigNum, { color: theme.colors.primary }]}>{current}</Text>
          <Text style={[styles.dayLabel, { color: theme.colors.text2 }]}>
            {t('streak.dayCount', { n: current })}
          </Text>

          {/* Milestone progress chips */}
          <View style={styles.chips}>
            {milestones.map((m) => {
              const hit = current >= m;
              return (
                <View
                  key={m}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: hit ? theme.colors.primarySoft : theme.colors.surface2,
                      borderColor: hit ? theme.colors.primary : theme.colors.line,
                    },
                  ]}
                >
                  <Text style={[styles.chipDay, { color: hit ? theme.colors.primaryDeep : theme.colors.muted }]}>
                    {t('streak.dayShort', { n: m })}
                  </Text>
                  <Text style={[styles.chipCoin, { color: hit ? theme.colors.primaryDeep : theme.colors.muted }]}>
                    +{MILESTONE_COINS[m] ?? 5}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Today's reward */}
          <View style={[styles.rewardRow, { backgroundColor: theme.colors.primarySoft, borderRadius: theme.radius.l }]}>
            <Text style={[styles.rewardText, { color: theme.colors.primaryDeep }]}>
              {t('streak.todayReward', { n: status.todayReward })}
            </Text>
          </View>

          <Text style={[styles.balance, { color: theme.colors.muted }]}>
            {t('streak.balance', { n: status.coins })}
          </Text>

          <Button label={t('streak.claim')} onPress={onClose} fullWidth style={{ marginTop: theme.spacing.l }} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  flame: { fontSize: 52, marginBottom: 4 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  bigNum: { fontSize: 56, fontWeight: '800', lineHeight: 62 },
  dayLabel: { fontSize: 14, marginBottom: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 18 },
  chip: {
    minWidth: 60,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  chipDay: { fontSize: 12, fontWeight: '700' },
  chipCoin: { fontSize: 13, fontWeight: '800', marginTop: 2 },
  rewardRow: { paddingVertical: 12, paddingHorizontal: 18, alignSelf: 'stretch', alignItems: 'center' },
  rewardText: { fontSize: 16, fontWeight: '800' },
  balance: { fontSize: 13, marginTop: 12 },
});
