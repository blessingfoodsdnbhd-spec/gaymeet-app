import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, ChevronLeft } from 'lucide-react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';

import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import {
  REPORT_REASON_LABELS,
  reportUser,
  type ReportReason,
} from '../../api/safety';
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
      Alert.alert('已收到', '我们会尽快审核。该用户已被自动屏蔽。', [
        { text: '好', onPress: () => nav.goBack() },
      ]);
    } catch {
      Alert.alert('提交失败', '稍后再试。');
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
          举报 {userName ?? ''}
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
            为什么要举报这个人?提交后我们会进行人工审核,并自动屏蔽该用户。
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
                      {REPORT_REASON_LABELS[r]}
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
            补充说明 (可选)
          </Text>
          <TextInput
            value={detail}
            onChangeText={setDetail}
            placeholder="发生了什么…"
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
            label="提交举报"
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
