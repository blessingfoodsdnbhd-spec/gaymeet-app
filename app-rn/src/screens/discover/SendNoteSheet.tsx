import React from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import { NameWithBadge } from '../../components/NameWithBadge';
import { Button } from '../../components/Button';
import { getNotesQuota, sendNote } from '../../api/notes';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const BODY_MAX = 200;

interface Recipient {
  id: string;
  nickname: string;
  avatarUrl?: string | null;
  isOfficial?: boolean;
  isVerified?: boolean;
  isPremium?: boolean;
}

/**
 * 小纸条 composer — an anonymous note to one user. Rendered as an absolute
 * overlay (NOT its own Modal) so it can live inside AboutUserSheet's Modal
 * window without the Android nested-Modal stacking bug. Returns null closed.
 */
export function SendNoteSheet({
  open,
  recipient,
  onClose,
}: {
  open: boolean;
  recipient: Recipient | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const qc = useQueryClient();
  const [body, setBody] = React.useState('');
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (open) setBody('');
  }, [open, recipient?.id]);

  const quotaQ = useQuery({
    queryKey: ['notes', 'quota'],
    queryFn: getNotesQuota,
    enabled: open,
    staleTime: 10_000,
  });
  const remaining = quotaQ.data?.remaining ?? null;
  const limit = quotaQ.data?.limit ?? null;

  if (!open || !recipient) return null;

  const trimmed = body.trim();
  const canSend = trimmed.length > 0 && !sending && remaining !== 0;

  const onSend = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      await sendNote(recipient.id, trimmed);
      qc.invalidateQueries({ queryKey: ['notes', 'quota'] });
      qc.invalidateQueries({ queryKey: ['notes', 'sent'] });
      onClose();
      Alert.alert(t('notes.sentTitle'), t('notes.sentBody'));
    } catch (e: any) {
      const data = e?.response?.data;
      if (e?.response?.status === 429 && data?.code === 'NOTE_QUOTA') {
        qc.invalidateQueries({ queryKey: ['notes', 'quota'] });
        if (!data.isPremium) {
          Alert.alert(t('notes.quotaTitle'), t('notes.quotaUpsell'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('notes.upgrade'), onPress: () => { onClose(); nav.navigate('Premium'); } },
          ]);
        } else {
          Alert.alert(t('notes.quotaTitle'), t('notes.quotaReachedPremium', { n: data.limit }));
        }
      } else {
        Alert.alert(t('notes.sendFailed'), data?.error ?? '');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.kav}
        pointerEvents="box-none"
      >
        <View style={[styles.card, { backgroundColor: theme.colors.surface }, theme.shadows.pop]}>
          {/* Header — recipient is visible to the SENDER (only the inbox is anonymous). */}
          <View style={styles.headerRow}>
            <Avatar name={recipient.nickname || '?'} uri={recipient.avatarUrl} size={40} />
            <View style={{ flex: 1 }}>
              <NameWithBadge
                name={recipient.nickname}
                official={recipient.isOfficial}
                verified={recipient.isVerified}
                premium={recipient.isPremium}
                textStyle={{ fontSize: 15, fontWeight: '700', color: theme.colors.text }}
                numberOfLines={1}
                badgeSize={14}
              />
              <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 1 }}>
                📝 {t('notes.anonymousHint')}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={22} color={theme.colors.muted} />
            </Pressable>
          </View>

          <TextInput
            value={body}
            onChangeText={(v) => setBody(v.slice(0, BODY_MAX))}
            placeholder={t('notes.composePlaceholder')}
            placeholderTextColor={theme.colors.muted}
            multiline
            autoFocus
            maxLength={BODY_MAX}
            style={[styles.input, { color: theme.colors.text, backgroundColor: theme.colors.surface2 }]}
          />

          <View style={styles.metaRow}>
            <Text style={{ fontSize: 12, color: theme.colors.muted }}>
              {remaining != null && limit != null
                ? t('notes.remaining', { n: remaining, total: limit })
                : ' '}
            </Text>
            <Text style={{ fontSize: 12, color: theme.colors.muted }}>
              {trimmed.length}/{BODY_MAX}
            </Text>
          </View>

          {remaining === 0 ? (
            <Text style={{ fontSize: 12, color: theme.colors.primary, marginBottom: 8 }}>
              {t('notes.quotaReachedInline')}
            </Text>
          ) : null}

          <Button
            label={sending ? '' : t('notes.send')}
            onPress={onSend}
            disabled={!canSend}
          />
          {sending ? (
            <ActivityIndicator
              color="#FFFFFF"
              style={{ position: 'absolute', bottom: 40, alignSelf: 'center' }}
            />
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(30,15,5,0.45)' },
  kav: { flex: 1, justifyContent: 'flex-end' },
  card: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  input: {
    minHeight: 96,
    maxHeight: 160,
    borderRadius: 14,
    padding: 12,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 10,
  },
});
