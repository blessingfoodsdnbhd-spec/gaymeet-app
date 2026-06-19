import React from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../theme/ThemeProvider';
import { getChatRoom, updateChatRoom } from '../api/worldChat';
import { showToast } from '../utils/toastBridge';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'ChangeRoomPassword'>;

const PW_MIN = 4;
const PW_MAX = 40;

/**
 * v3.1.10 — full-screen room password manager (creator only). Replaces the old
 * roster-sheet "房间设置" password flow. For a private room it changes the
 * password; for a public room it SETS one (turning the room private). The
 * backend PATCH /rooms/:id authorizes by creator identity (sameId), so there is
 * no server-side old-password check — we ask for new + confirm only.
 *
 * Android intentionally gets NO KeyboardAvoidingView `behavior` (the v3.1.7 KAV
 * trap: behavior="padding" on Android double-counts the edge-to-edge inset);
 * iOS uses "padding".
 */
export function ChangeRoomPasswordScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const qc = useQueryClient();
  const { roomId, roomTitle } = useRoute<Rt>().params;

  const roomQ = useQuery({
    queryKey: ['worldChat', 'room', roomId],
    queryFn: () => getChatRoom(roomId),
    staleTime: 30_000,
    select: (d) => d.room,
  });
  const room = roomQ.data;
  const wasPrivate = !!room?.isPrivate;

  const [pw, setPw] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canSubmit = pw.trim().length >= PW_MIN && confirm.trim().length > 0 && !saving;

  const onSubmit = async () => {
    setError(null);
    if (pw.trim().length < PW_MIN) {
      setError(t('changePassword.tooShort', { n: PW_MIN }));
      return;
    }
    if (pw.trim() !== confirm.trim()) {
      setError(t('changePassword.mismatch'));
      return;
    }
    setSaving(true);
    try {
      // isPrivate:true makes a public room private as it gets its first password;
      // for an already-private room it's a no-op alongside the new password.
      await updateChatRoom(roomId, { isPrivate: true, password: pw.trim() });
      qc.invalidateQueries({ queryKey: ['worldChat', 'room', roomId] });
      qc.invalidateQueries({ queryKey: ['worldChat', 'rooms'] });
      showToast(t('changePassword.done'), 'success');
      nav.goBack();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? t('changePassword.failed'));
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
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={styles.iconBtn}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.text }}>
          {wasPrivate ? t('changePassword.title') : t('changePassword.titleSet')}
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: theme.spacing.xl, gap: 18 }} keyboardShouldPersistTaps="handled">
          <Text style={{ fontSize: 13, color: theme.colors.text2, lineHeight: 19 }}>
            {wasPrivate
              ? t('changePassword.hint', { name: roomTitle ?? room?.title ?? '' })
              : t('changePassword.hintSet', { name: roomTitle ?? room?.title ?? '' })}
          </Text>

          <View style={{ gap: 8 }}>
            <Text style={[styles.label, { color: theme.colors.text }]}>{t('changePassword.newPw')}</Text>
            <TextInput
              value={pw}
              onChangeText={(x) => setPw(x.slice(0, PW_MAX))}
              placeholder={t('changePassword.newPwPh')}
              placeholderTextColor={theme.colors.muted}
              autoCapitalize="none"
              secureTextEntry
              style={input}
            />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={[styles.label, { color: theme.colors.text }]}>{t('changePassword.confirmPw')}</Text>
            <TextInput
              value={confirm}
              onChangeText={(x) => setConfirm(x.slice(0, PW_MAX))}
              placeholder={t('changePassword.confirmPwPh')}
              placeholderTextColor={theme.colors.muted}
              autoCapitalize="none"
              secureTextEntry
              style={input}
            />
          </View>

          {!!error && <Text style={{ fontSize: 13, color: theme.colors.error }}>{error}</Text>}

          <Pressable
            onPress={onSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.submit,
              { backgroundColor: canSubmit ? theme.colors.primary : theme.colors.line, opacity: pressed && canSubmit ? 0.85 : 1 },
            ]}
            accessibilityRole="button"
          >
            <Text style={{ color: canSubmit ? '#FFFFFF' : theme.colors.muted, fontWeight: '800', fontSize: 15 }}>
              {saving ? t('changePassword.saving') : t('changePassword.save')}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '700' },
  submit: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
});
