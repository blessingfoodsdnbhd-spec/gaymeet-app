import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';
import { TagChip } from '../../components/TagChip';
import {
  INTEREST_TAGS,
  MIN_ONBOARDING_TAGS,
  type InterestTagId,
} from '../../data/interestTags';
import { useAuth } from '../../store/auth';
import { setInterests } from '../../api/me';

export function TagsEditScreen() {
  const theme = useTheme();
  const nav = useNavigation();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);

  const [selected, setSelected] = useState<Set<InterestTagId>>(
    new Set((user?.interests ?? []) as InterestTagId[]),
  );
  const [busy, setBusy] = useState(false);

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
      const updated = await setInterests(Array.from(selected));
      setUser(updated);
      nav.goBack();
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.error || e?.response?.data?.message || e?.message || 'unknown';
      Alert.alert('保存失败', `${detail}${status ? ` (HTTP ${status})` : ''}`);
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
          兴趣
        </Text>
      </View>

      <View style={{ paddingHorizontal: 20 }}>
        <Text style={{ fontSize: 14, color: theme.colors.text2, lineHeight: 21 }}>
          至少选 {MIN_ONBOARDING_TAGS} 个,你会被推荐给同好。
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
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

      <View style={{ padding: 20 }}>
        <Button
          label={`保存 · ${selected.size} 个`}
          disabled={!ready}
          loading={busy}
          onPress={onSave}
          fullWidth
        />
      </View>
    </SafeAreaView>
  );
}
