import React from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';
import { createTopicRoom, getTopicRoomQuota } from '../../api/plaza';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const TITLE_MAX = 30;
const DESC_MAX = 100;
const DEFAULT_EMOJI = '💬';

/**
 * 创建话题房间 — open a UGC topic room. It joins the pool 热门 ranks from (always
 * below the official rooms) and auto-deletes after 7 days with no activity. Free
 * users get 1/day (5 total), Premium 3/day (30 total). Voice category is locked
 * until Phase 4.
 */
export function CreateTopicRoomScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();

  const [title, setTitle] = React.useState('');
  const [emoji, setEmoji] = React.useState(DEFAULT_EMOJI);
  const [description, setDescription] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const quotaQ = useQuery({ queryKey: ['plaza', 'topicQuota'], queryFn: getTopicRoomQuota, staleTime: 10_000 });
  const quota = quotaQ.data;
  const dailyLeft = quota ? Math.max(0, quota.daily.limit - quota.daily.used) : null;
  const lifetimeFull = quota ? quota.lifetime.used >= quota.lifetime.limit : false;
  const quotaExhausted = quota ? dailyLeft === 0 || lifetimeFull : false;

  const canSubmit = title.trim().length > 0 && !quotaExhausted;

  const onSubmit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      const room = await createTopicRoom({
        title: title.trim(),
        emoji: emoji.trim() || DEFAULT_EMOJI,
        description: description.trim() || undefined,
      });
      nav.replace('WorldChatRoom', { roomId: room.id, title: room.title });
    } catch (e: any) {
      const code = e?.response?.data?.code;
      const msg =
        code === 'DAILY_QUOTA' || code === 'LIFETIME_QUOTA'
          ? t('plaza.create.quotaReached')
          : e?.response?.data?.error ?? t('worldChat.actionFailed');
      Alert.alert(t('plaza.create.failed'), msg);
      quotaQ.refetch();
    } finally {
      setSaving(false);
    }
  };

  const input = {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.line,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.text,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={{ marginRight: 10 }}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.text }}>{t('plaza.create.title')}</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }} keyboardShouldPersistTaps="handled">
          {/* Quota line */}
          {quota && (
            <View>
              <Text style={{ fontSize: 12.5, color: quotaExhausted ? theme.colors.error : theme.colors.muted }}>
                {t('plaza.create.quotaRemaining', { remaining: dailyLeft, total: quota.daily.limit })}
                {quota.isPremium ? ' · Premium' : ''}
              </Text>
              {!quota.isPremium && (
                <Text style={{ fontSize: 12, color: theme.colors.primary, marginTop: 3 }}>
                  {t('plaza.create.quotaUpgrade')}
                </Text>
              )}
            </View>
          )}

          {/* Emoji + title on one row */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ gap: 8 }}>
              <Text style={[styles.label, { color: theme.colors.text }]}>{t('plaza.create.emojiField')}</Text>
              <TextInput
                value={emoji}
                onChangeText={(x) => setEmoji(x.slice(0, 4))}
                placeholder={DEFAULT_EMOJI}
                placeholderTextColor={theme.colors.muted}
                style={[input, { width: 64, textAlign: 'center', fontSize: 22 }]}
              />
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={[styles.label, { color: theme.colors.text }]}>{t('plaza.create.titleField')}</Text>
              <TextInput
                value={title}
                onChangeText={(x) => setTitle(x.slice(0, TITLE_MAX))}
                placeholder={t('plaza.create.titlePh')}
                placeholderTextColor={theme.colors.muted}
                style={input}
              />
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={[styles.label, { color: theme.colors.text }]}>{t('plaza.create.descField')}</Text>
            <TextInput
              value={description}
              onChangeText={(x) => setDescription(x.slice(0, DESC_MAX))}
              placeholder={t('plaza.create.descPh')}
              placeholderTextColor={theme.colors.muted}
              multiline
              style={[input, { minHeight: 72, textAlignVertical: 'top' }]}
            />
          </View>

          {/* Category selector — only 'topic' is available; voice is locked. */}
          <View style={{ gap: 8 }}>
            <Text style={[styles.label, { color: theme.colors.text }]}>{t('plaza.create.categoryField')}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={[styles.cat, { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary }]}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: theme.colors.primaryDeep }}>
                  💬 {t('plaza.create.catTopic')}
                </Text>
              </View>
              <View style={[styles.cat, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.line }]}>
                <Lock size={13} color={theme.colors.muted} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.muted }}>
                  {t('plaza.create.voiceLocked')}
                </Text>
              </View>
            </View>
          </View>

          <Button
            label={t('plaza.create.submit')}
            onPress={onSubmit}
            loading={saving}
            disabled={!canSubmit}
            fullWidth
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 13, fontWeight: '700' },
  cat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
});
