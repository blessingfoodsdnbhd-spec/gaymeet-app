import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { useAuth } from '../../store/auth';
import { setPrompts } from '../../api/me';

const SUGGESTED_QUESTIONS = [
  '本周想找人一起',
  '近期最循环的一张专辑',
  '理想的周末早晨',
  '上周最想跟人聊的电影',
  '本月在玩',
  '想被推荐一本',
];

interface Draft {
  q: string;
  a: string;
}

export function PromptsEditScreen() {
  const theme = useTheme();
  const nav = useNavigation();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);

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
          答题
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
                placeholder="写下你的答案…"
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
                想被问的问题
              </Text>
              {SUGGESTED_QUESTIONS.filter((q) => !drafts.find((d) => d.q === q)).map((q) => (
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
          <Button label="保存" loading={busy} onPress={onSave} fullWidth />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
