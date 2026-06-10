import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import {
  BarChart3,
  Bell,
  BadgeCheck,
  ChevronRight,
  Crown,
  Globe,
  Lock,
  Megaphone,
  ShieldCheck,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { useTheme } from '../../../theme/ThemeProvider';
import { fetchIsAdmin } from '../../../api/admin';
import { SettingsShell, SettingsCard, Divider } from './SettingsShell';

type AnyNav = NativeStackNavigationProp<any>;

/**
 * Umbrella 设置 screen (PR RRRRR). Hosts the low-frequency config rows moved out
 * of the 我 tab (隐私 / 通知 / 语言 / 账户与安全 / 我的数据) plus admin tools,
 * reached via the ⚙️ gear at top-right of ProfileScreen. The profile tab keeps
 * only its everyday actions (Premium / gift / verification).
 */
export function SettingsScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const nav = useNavigation<AnyNav>();

  const isAdminQ = useQuery({
    queryKey: ['me', 'isAdmin'],
    queryFn: fetchIsAdmin,
  });
  const isAdmin = isAdminQ.data === true;

  return (
    <SettingsShell title={t('profile.settingsTitle')}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <SettingsCard flat style={{ paddingVertical: 4 }}>
          <SettingsRow
            icon={<Lock size={18} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
            label={t('profile.rows.privacy')}
            onPress={() => nav.navigate('PrivacySettings')}
          />
          <Divider />
          <SettingsRow
            icon={<Bell size={18} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
            label={t('profile.rows.notifications')}
            onPress={() => nav.navigate('NotificationSettings')}
          />
          <Divider />
          <SettingsRow
            icon={<Globe size={18} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
            label={t('profile.rows.language')}
            detail={i18n.language.startsWith('zh') ? t('profile.rows.languageValueZh') : t('profile.rows.languageValueEn')}
            onPress={() => nav.navigate('LanguageSettings')}
          />
          <Divider />
          <SettingsRow
            icon={<ShieldCheck size={18} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
            label={t('profile.rows.account')}
            onPress={() => nav.navigate('AccountSettings')}
          />
          <Divider />
          <SettingsRow
            icon={<BarChart3 size={18} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
            label={t('profile.rows.myData')}
            onPress={() => nav.navigate('MyAnalytics')}
          />
          {isAdmin && (
            <>
              <Divider />
              <SettingsRow
                icon={<BadgeCheck size={18} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
                label={t('profile.rows.adminVerifications')}
                onPress={() => nav.navigate('AdminVerifications')}
              />
              <Divider />
              <SettingsRow
                icon={<Megaphone size={18} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
                label={t('profile.rows.announcementAdmin')}
                onPress={() => nav.navigate('AnnouncementAdmin')}
              />
              <Divider />
              <SettingsRow
                icon={<ShieldCheck size={18} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
                label={t('profile.rows.adminReports')}
                onPress={() => nav.navigate('AdminReports')}
              />
              <Divider />
              <SettingsRow
                icon={<Crown size={18} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
                label={t('profile.rows.adminStats')}
                onPress={() => nav.navigate('AdminStats')}
              />
            </>
          )}
        </SettingsCard>
      </ScrollView>
    </SettingsShell>
  );
}

function SettingsRow({ icon, label, detail, onPress }: { icon: React.ReactNode; label: string; detail?: string; onPress?: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, gap: 12, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </View>
      <Text style={{ flex: 1, fontSize: 15, color: theme.colors.text }}>{label}</Text>
      {detail && <Text style={{ fontSize: 13, color: theme.colors.muted }}>{detail}</Text>}
      <ChevronRight size={16} color={theme.colors.muted} strokeWidth={1.6} />
    </Pressable>
  );
}
