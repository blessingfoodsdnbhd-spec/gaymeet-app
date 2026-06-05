import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';
import { TagChip } from '../../components/TagChip';
import { MobileGamesEditor } from '../../components/MobileGamesEditor';
import {
  INTEREST_TAGS,
  MIN_ONBOARDING_TAGS,
  MOBILE_GAMES_TAG_ID,
  type InterestTagId,
} from '../../data/interestTags';
import { useAuth } from '../../store/auth';
import { setInterests, patchMe } from '../../api/me';

export function TagsEditScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);

  const [selected, setSelected] = useState<Set<InterestTagId>>(
    new Set((user?.interests ?? []) as InterestTagId[]),
  );
  const [games, setGames] = useState<string[]>(user?.mobileGames ?? []);
  const [busy, setBusy] = useState(false);

  const showGames = selected.has(MOBILE_GAMES_TAG_ID as InterestTagId);

  const ready = selected.size >= MIN_ONBOARDING_TAGS;

  const toggle = (id: InterestTagId) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const onSave = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      await setInterests(Array.from(selected));
      // Persist games too — cleared when the 'mobile-games' interest is off.
      const updated = await patchMe({ mobileGames: showGames ? games : [] });
      setUser(updated);
      nav.goBack();
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.error || e?.response?.data?.message || e?.message || 'unknown';
      Alert.alert(t('profile.tagsEdit.saveFailed'), `${detail}${status ? ` (HTTP ${status})` : ''}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 10,
        }}
      >
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ marginLeft: 8, fontSize: 18, fontWeight: '600', color: theme.colors.text }}>
          {t('profile.tagsEdit.title')}
        </Text>
      </View>

      <View style={{ paddingHorizontal: 20 }}>
        <Text style={{ fontSize: 14, color: theme.colors.text2, lineHeight: 21 }}>
          {t('profile.tagsEdit.subtitle', { n: MIN_ONBOARDING_TAGS })}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {INTEREST_TAGS.map((tag) => (
            <TagChip
              key={tag.id}
              tag={tag}
              selected={selected.has(tag.id)}
              onPress={() => toggle(tag.id)}
            />
          ))}
        </View>

        {showGames && (
          <View style={{ paddingHorizontal: 4 }}>
            <MobileGamesEditor games={games} onChange={setGames} />
          </View>
        )}
      </ScrollView>

      <View style={{ padding: 20 }}>
        <Button
          label={t('profile.tagsEdit.saveWithCount', { n: selected.size })}
          disabled={!ready}
          loading={busy}
          onPress={onSave}
          fullWidth
        />
      </View>
    </SafeAreaView>
  );
}
