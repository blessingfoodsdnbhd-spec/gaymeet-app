import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Platform,
  Alert,
  StyleSheet,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, ChevronLeft } from 'lucide-react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { reportUser, type ReportReason } from '../../api/safety';
import type { RootStackParamList } from '../../navigation/types';

type Rt = RouteProp<RootStackParamList, 'Report'>;

const REASONS: ReportReason[] = [
  'harassment',
  'inappropriate_photos',
  'fake_profile',
  'underage',
  'spam',
  'other',
];

export function ReportScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation();
  const route = useRoute<Rt>();
  const { userId, userName } = route.params;

  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!reason || busy) return;
    setBusy(true);
    try {
      await reportUser(userId, reason, detail.trim() || undefined);
      Alert.alert(t('report.submittedTitle'), t('report.submittedBody'), [
        { text: t('report.submittedOk'), onPress: () => nav.goBack() },
      ]);
    } catch (e: any) {
      const status = e?.response?.status;
      const d =
        e?.response?.data?.error || e?.response?.data?.message || e?.message || 'unknown';
      Alert.alert(t('report.submitFailed'), `${d}${status ? ` (HTTP ${status})` : ''}`);
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
          {t('report.title', { name: userName ?? '' })}
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
          <Text
            style={{
              fontSize: 14,
              color: theme.colors.text2,
              lineHeight: 21,
              marginBottom: 18,
            }}
          >
            {t('report.subtitle')}
          </Text>

          <Card flat style={{ paddingVertical: 4 }}>
            {REASONS.map((r, i) => {
              const active = reason === r;
              return (
                <View key={r}>
                  <Pressable
                    onPress={() => setReason(r)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 14,
                      paddingHorizontal: 14,
                      gap: 12,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text style={{ flex: 1, fontSize: 15, color: theme.colors.text }}>
                      {t(`report.reasons.${r}`)}
                    </Text>
                    {active && (
                      <Check size={18} color={theme.colors.primary} strokeWidth={2.2} />
                    )}
                  </Pressable>
                  {i < REASONS.length - 1 && (
                    <View
                      style={{
                        height: StyleSheet.hairlineWidth,
                        backgroundColor: theme.colors.line,
                        marginHorizontal: 14,
                      }}
                    />
                  )}
                </View>
              );
            })}
          </Card>

          <Text
            style={{
              fontSize: 12,
              color: theme.colors.muted,
              letterSpacing: 0.72,
              textTransform: 'uppercase',
              marginTop: 22,
              marginBottom: 8,
            }}
          >
            {t('report.noteLabel')}
          </Text>
          <TextInput
            value={detail}
            onChangeText={setDetail}
            placeholder={t('report.notePlaceholder')}
            placeholderTextColor={theme.colors.muted}
            multiline
            maxLength={400}
            style={{
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.line,
              borderRadius: theme.radius.m,
              paddingHorizontal: 14,
              paddingVertical: 12,
              minHeight: 100,
              fontSize: 14,
              color: theme.colors.text,
              textAlignVertical: 'top',
            }}
          />
        </ScrollView>

        <View style={{ padding: 20 }}>
          <Button
            label={t('report.submit')}
            onPress={onSubmit}
            disabled={!reason}
            loading={busy}
            fullWidth
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
