import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../theme/ThemeProvider';
import { SettingsShell } from './settings/SettingsShell';
import { useAuth } from '../../store/auth';
import {
  APP_ICON_ASSETS,
  getSelectedAppIcon,
  isAppIconSwapSupported,
  setAppIcon,
  type AppIconId,
} from '../../lib/appIcon';

const STREAK_NEEDED = 30;
const REFERRALS_NEEDED = 3;

const ALTERNATES: Exclude<AppIconId, 'default'>[] = ['pink', 'purple', 'blue', 'sunset', 'night'];

export function AppIconScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);

  const streak = user?.streak?.current ?? 0;
  const isPremium = !!(user as any)?.isPremium;
  const referrals = user?.referralCount ?? 0;
  const unlocked = streak >= STREAK_NEEDED || isPremium || referrals >= REFERRALS_NEEDED;

  const [selected, setSelected] = useState<AppIconId>('default');
  useEffect(() => {
    getSelectedAppIcon().then(setSelected);
  }, []);

  const choose = async (id: AppIconId) => {
    if (id !== 'default' && !unlocked) return;
    setSelected(id);
    const applied = await setAppIcon(id);
    if (!applied && id !== 'default') {
      // Selection persisted but native swap not available in this build yet.
      Alert.alert(t('appIcon.savedTitle'), t('appIcon.savedPendingBuild'));
    }
  };

  return (
    <SettingsShell title={t('appIcon.title')}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {!unlocked && (
          <View style={[styles.lockCard, { backgroundColor: theme.colors.surface2, borderRadius: theme.radius.l }]}>
            <Text style={[styles.lockTitle, { color: theme.colors.text }]}>{t('appIcon.lockedTitle')}</Text>
            <Text style={[styles.lockLine, { color: theme.colors.text2 }]}>
              {t('appIcon.unlockStreak', { n: STREAK_NEEDED, cur: streak })}
            </Text>
            <Text style={[styles.lockLine, { color: theme.colors.text2 }]}>
              {t('appIcon.unlockReferral', { n: REFERRALS_NEEDED, cur: referrals })}
            </Text>
            <Text style={[styles.lockLine, { color: theme.colors.text2 }]}>{t('appIcon.unlockPremium')}</Text>
          </View>
        )}

        <View style={styles.grid}>
          {/* Default */}
          <IconTile
            label={t('appIcon.classic')}
            source={null}
            locked={false}
            active={selected === 'default'}
            onPress={() => choose('default')}
          />
          {ALTERNATES.map((id) => (
            <IconTile
              key={id}
              label={t(`appIcon.names.${id}`)}
              source={APP_ICON_ASSETS[id]}
              locked={!unlocked}
              active={selected === id}
              onPress={() => choose(id)}
            />
          ))}
        </View>

        {!isAppIconSwapSupported() && (
          <Text style={[styles.note, { color: theme.colors.muted }]}>{t('appIcon.buildNote')}</Text>
        )}
      </ScrollView>
    </SettingsShell>
  );
}

function IconTile({
  label,
  source,
  locked,
  active,
  onPress,
}: {
  label: string;
  source: number | null;
  locked: boolean;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      style={({ pressed }) => [styles.tile, { opacity: pressed && !locked ? 0.8 : 1 }]}
    >
      <View
        style={[
          styles.iconWrap,
          {
            borderColor: active ? theme.colors.primary : theme.colors.line,
            borderWidth: active ? 2.5 : 1,
            backgroundColor: theme.colors.surface2,
          },
        ]}
      >
        {source ? (
          <Image source={source} style={styles.iconImg} />
        ) : (
          <Image source={require('../../assets/logo.png')} style={styles.iconImg} />
        )}
        {locked && (
          <View style={styles.lockOverlay}>
            <Lock size={22} color="#fff" strokeWidth={2} />
          </View>
        )}
        {active && (
          <View style={[styles.activeBadge, { backgroundColor: theme.colors.primary }]}>
            <Check size={14} color="#fff" strokeWidth={3} />
          </View>
        )}
      </View>
      <Text style={[styles.tileLabel, { color: theme.colors.text2 }]}>{label}</Text>
    </Pressable>
  );
}

const TILE = 96;
const styles = StyleSheet.create({
  lockCard: { padding: 16, marginBottom: 16, gap: 6 },
  lockTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  lockLine: { fontSize: 13, lineHeight: 19 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 18 },
  tile: { width: TILE, alignItems: 'center' },
  iconWrap: {
    width: TILE,
    height: TILE,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconImg: { width: '100%', height: '100%' },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: { fontSize: 12, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  note: { fontSize: 11.5, lineHeight: 16, marginTop: 20, paddingHorizontal: 4 },
});
