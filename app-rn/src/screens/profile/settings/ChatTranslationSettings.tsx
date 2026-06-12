import React from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../../theme/ThemeProvider';
import { SettingsShell, SettingsCard, Divider, ToggleRow } from './SettingsShell';
import { useTranslatePrefs, type TranslateTarget } from '../../../store/translatePrefs';

const TARGETS: { id: TranslateTarget; label: string; subtitle?: string }[] = [
  { id: 'auto', label: '' /* localized below */ },
  { id: 'zh', label: '中文', subtitle: 'Chinese' },
  { id: 'en', label: 'English', subtitle: '英文' },
  { id: 'ko', label: '한국어', subtitle: 'Korean' },
  { id: 'ja', label: '日本語', subtitle: 'Japanese' },
];

/**
 * 聊天翻译 / Chat Translation — toggle auto-translate in the world lobby and
 * country rooms and pick the language to translate into.
 */
export function ChatTranslationSettings() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { enabled, target, setEnabled, setTarget } = useTranslatePrefs();

  return (
    <SettingsShell title={t('chatTranslation.title')}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, gap: 16 }}>
        <SettingsCard flat style={{ paddingVertical: 4 }}>
          <ToggleRow
            label={t('chatTranslation.enable')}
            value={enabled}
            onValueChange={setEnabled}
            hint={t('chatTranslation.enableHint')}
          />
        </SettingsCard>

        {enabled && (
          <SettingsCard flat style={{ paddingVertical: 4 }}>
            <Text
              style={{
                paddingHorizontal: 14,
                paddingTop: 10,
                paddingBottom: 4,
                fontSize: 12,
                fontWeight: '700',
                letterSpacing: 0.4,
                color: theme.colors.muted,
              }}
            >
              {t('chatTranslation.translateTo')}
            </Text>
            {TARGETS.map((opt, i) => {
              const active = target === opt.id;
              const label = opt.id === 'auto' ? t('chatTranslation.auto') : opt.label;
              const subtitle = opt.id === 'auto' ? t('chatTranslation.autoHint') : opt.subtitle;
              return (
                <View key={opt.id}>
                  <Pressable
                    onPress={() => setTarget(opt.id)}
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
                      <Text style={{ fontSize: 15, color: theme.colors.text }}>{label}</Text>
                      {!!subtitle && (
                        <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>{subtitle}</Text>
                      )}
                    </View>
                    {active && <Check size={18} color={theme.colors.primary} strokeWidth={2} />}
                  </Pressable>
                  {i < TARGETS.length - 1 && <Divider />}
                </View>
              );
            })}
          </SettingsCard>
        )}
      </ScrollView>
    </SettingsShell>
  );
}
