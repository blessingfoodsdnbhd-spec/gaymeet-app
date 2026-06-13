import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { useAuth } from '../../store/auth';
import { setPrompts } from '../../api/me';

// Prompt library (GGGG) — grouped by theme. Users pick any few to display.
// Keys map to profile.promptsEdit.suggestions.<key> in en/zh.json.
const SUGGESTED_QUESTION_KEYS = [
  // 关于我 / About me
  'recentObsession',
  'proudOf',
  'lookingForType',
  'describeMe',
  'thisWeek',
  // 找朋友 / Looking for friends
  'wantToDo',
  'stickWithHobby',
  'weekendSpot',
  'sundayRecharge',
  // 兴趣 / Interests
  'recentBook',
  'favMovie',
  'mustListen',
  'albumOnRepeat',
  'dreamTrip',
  'playingThisMonth',
  'recommendBook',
  'movieToTalk',
  'idealWeekend',
  // 价值观 / Values
  'believeIn',
  'afraidOf',
  'idealLife',
  'greenFlag',
  // 创意趣题 / Fun
  'weirdHabit',
  'secretSkill',
  'ifTimeTravel',
  'twoTruths',
  'cantLiveWithout',
  'makesMeLaugh',
  'comfortFood',
  'bucketList',
] as const;

interface Draft {
  q: string;
  a: string;
}

export function PromptsEditScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);

  const suggestedQuestions = SUGGESTED_QUESTION_KEYS.map(
    (k) => t(`profile.promptsEdit.suggestions.${k}`),
  );

  const [drafts, setDrafts] = useState<Draft[]>(
    (user?.prompts ?? []).map((p) => ({ q: p.q, a: p.a })),
  );
  const [busy, setBusy] = useState(false);

  const addDraft = (q: string) => {
    if (drafts.length >= 4) return;
    setDrafts([...drafts, { q, a: '' }]);
  };

  const updateAt = (i: number, patch: Partial<Draft>) => {
    setDrafts(drafts.map((d, j) => (i === j ? { ...d, ...patch } : d)));
  };

  const removeAt = (i: number) => {
    setDrafts(drafts.filter((_, j) => i !== j));
  };

  const onSave = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const clean = drafts
        .map((d) => ({ q: d.q.trim(), a: d.a.trim() }))
        .filter((d) => d.q && d.a);
      const updated = await setPrompts(clean);
      setUser(updated);
      nav.goBack();
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.error || e?.response?.data?.message || e?.message || 'unknown';
      Alert.alert(t('profile.promptsEdit.saveFailed'), `${detail}${status ? ` (HTTP ${status})` : ''}`);
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
          {t('profile.promptsEdit.title')}
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
          {drafts.map((d, i) => (
            <Card key={i} surface2 flat style={{ padding: 14, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, color: theme.colors.muted, marginBottom: 8 }}>
                  {d.q}
                </Text>
                <Pressable onPress={() => removeAt(i)} hitSlop={8}>
                  <Trash2 size={16} color={theme.colors.muted} strokeWidth={1.6} />
                </Pressable>
              </View>
              <TextInput
                value={d.a}
                onChangeText={(v) => updateAt(i, { a: v })}
                placeholder={t('profile.promptsEdit.answerPlaceholder')}
                placeholderTextColor={theme.colors.muted}
                multiline
                style={{
                  fontFamily: 'Fraunces',
                  fontStyle: 'italic',
                  fontSize: 15,
                  lineHeight: 23,
                  color: theme.colors.text,
                  paddingVertical: 4,
                  minHeight: 50,
                  textAlignVertical: 'top',
                }}
              />
            </Card>
          ))}

          {drafts.length < 4 && (
            <View style={{ marginTop: 8 }}>
              <Text
                style={{
                  fontSize: 12,
                  color: theme.colors.muted,
                  letterSpacing: 0.72,
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}
              >
                {t('profile.promptsEdit.askedSection')}
              </Text>
              {suggestedQuestions.filter((q) => !drafts.find((d) => d.q === q)).map((q) => (
                <Pressable
                  key={q}
                  onPress={() => addDraft(q)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingVertical: 10,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Plus size={16} color={theme.colors.primary} strokeWidth={1.8} />
                  <Text style={{ fontSize: 14, color: theme.colors.text }}>{q}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={{ padding: 20 }}>
          <Button label={t('profile.promptsEdit.save')} loading={busy} onPress={onSave} fullWidth />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
