import React from 'react';
import { Text, View, Pressable } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../../theme/ThemeProvider';
import { SettingsShell, SettingsCard, Divider } from './SettingsShell';

const OPTIONS: { id: 'zh' | 'en'; label: string; subtitle: string }[] = [
  { id: 'zh', label: '中文', subtitle: 'Chinese' },
  { id: 'en', label: 'English', subtitle: '英文' },
];

export function LanguageSettings() {
  const theme = useTheme();
  const { i18n } = useTranslation();
  const current = i18n.language.startsWith('zh') ? 'zh' : 'en';

  return (
    <SettingsShell title={i18n.language.startsWith('zh') ? '语言' : 'Language'}>
      <SettingsCard flat style={{ paddingVertical: 4 }}>
        {OPTIONS.map((opt, i) => {
          const active = current === opt.id;
          return (
            <View key={opt.id}>
              <Pressable
                onPress={() => i18n.changeLanguage(opt.id)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 14,
                  paddingHorizontal: 14,
                  gap: 12,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, color: theme.colors.text }}>
                    {opt.label}
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>
                    {opt.subtitle}
                  </Text>
                </View>
                {active && <Check size={18} color={theme.colors.primary} strokeWidth={2} />}
              </Pressable>
              {i < OPTIONS.length - 1 && <Divider />}
            </View>
          );
        })}
      </SettingsCard>
    </SettingsShell>
  );
}
