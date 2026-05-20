import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button } from '../../components/Button';
import { TagChip } from '../../components/TagChip';
import { INTEREST_TAGS, MIN_ONBOARDING_TAGS, type InterestTagId } from '../../data/interestTags';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuth } from '../../store/auth';
import { setInterests } from '../../api/me';

export function InterestTagsPickerScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const setUser = useAuth((s) => s.setUser);
  const [selected, setSelected] = useState<Set<InterestTagId>>(new Set());
  const [busy, setBusy] = useState(false);

  const ready = selected.size >= MIN_ONBOARDING_TAGS;
  const remaining = Math.max(0, MIN_ONBOARDING_TAGS - selected.size);

  const ctaLabel = useMemo(() => {
    if (ready) return t('tags.enter');
    return remaining > 0
      ? t('tags.ctaPickMore', { n: selected.size, more: remaining })
      : t('tags.ctaReady', { n: selected.size });
  }, [ready, remaining, selected.size, t]);

  const toggle = (id: InterestTagId) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const onEnter = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const user = await setInterests(Array.from(selected));
      setUser(user);
    } catch (e: any) {
      const status = e?.response?.status;
      const body = e?.response?.data;
      const detail = body?.error || body?.message || e?.message || 'unknown';
      console.warn('setInterests failed', { status, body, error: e });
      Alert.alert(
        '保存失败',
        `${detail}${status ? ` (HTTP ${status})` : ''}`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <Text
          style={{
            fontSize: 12,
            color: theme.colors.muted,
            fontWeight: '500',
            letterSpacing: 0.6,
            textTransform: 'uppercase',
          }}
        >
          {t('tags.stepLabel')}
        </Text>
      </View>

      <View style={{ paddingHorizontal: 28, paddingTop: 16 }}>
        <Text
          style={{
            fontSize: theme.typography.size.h2,
            fontWeight: theme.typography.weight.bold,
            color: theme.colors.text,
            letterSpacing: -0.4,
          }}
        >
          {t('tags.title')}
        </Text>
        <Text
          style={{
            marginTop: 8,
            fontSize: 14,
            color: theme.colors.text2,
            lineHeight: 21,
          }}
        >
          {t('tags.subtitle')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 24,
          paddingBottom: 24,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        {INTEREST_TAGS.map((tag) => (
          <TagChip
            key={tag.id}
            tag={tag}
            selected={selected.has(tag.id)}
            onPress={() => toggle(tag.id)}
          />
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
        <Button
          label={ctaLabel}
          onPress={onEnter}
          disabled={!ready}
          loading={busy}
          fullWidth
        />
      </View>
    </SafeAreaView>
  );
}
