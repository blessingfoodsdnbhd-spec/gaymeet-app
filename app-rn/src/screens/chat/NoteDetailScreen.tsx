import React from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Trash2, Ban, StickyNote } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';
import { replyNote, deleteNote, blockNoteSender } from '../../api/notes';
import { shortTime } from '../../utils/time';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const BODY_MAX = 200;

/**
 * 小纸条 detail — the recipient reads an anonymous note and may reply once,
 * delete it, or block the (hidden) sender. Sender identity is never shown.
 */
export function NoteDetailScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'NoteDetail'>>();
  const qc = useQueryClient();
  const note = route.params.note;

  const [replyBody, setReplyBody] = React.useState(note.replyBody ?? null);
  const [draft, setDraft] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['notes', 'inbox'] });
    qc.invalidateQueries({ queryKey: ['notes', 'unread'] });
  };

  const onReply = async () => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const res = await replyNote(note._id, body);
      setReplyBody(res.replyBody);
      setDraft('');
      invalidate();
    } catch (e: any) {
      Alert.alert(t('notes.replyFailed'), e?.response?.data?.error ?? '');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = () => {
    Alert.alert(t('notes.deleteConfirmTitle'), t('notes.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('notes.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteNote(note._id);
            invalidate();
            nav.goBack();
          } catch (e: any) {
            Alert.alert(t('notes.actionFailed'), e?.response?.data?.error ?? '');
          }
        },
      },
    ]);
  };

  const onBlock = () => {
    Alert.alert(t('notes.blockConfirmTitle'), t('notes.blockConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('notes.block'),
        style: 'destructive',
        onPress: async () => {
          try {
            await blockNoteSender(note._id);
            invalidate();
            nav.goBack();
          } catch (e: any) {
            Alert.alert(t('notes.actionFailed'), e?.response?.data?.error ?? '');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ marginLeft: 8, flex: 1, fontSize: 16, fontWeight: '600', color: theme.colors.text }}>
          {t('notes.detailTitle')}
        </Text>
        <Pressable onPress={onBlock} hitSlop={8} style={{ marginRight: 16 }}>
          <Ban size={20} color={theme.colors.muted} />
        </Pressable>
        <Pressable onPress={onDelete} hitSlop={8}>
          <Trash2 size={20} color={theme.colors.muted} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          {/* The anonymous note */}
          <View style={[styles.bubble, { backgroundColor: theme.colors.primarySoft }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <StickyNote size={16} color={theme.colors.primary} strokeWidth={2} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.primary }}>
                {t('notes.anonymousSender')}
              </Text>
            </View>
            <Text style={{ fontSize: 16, lineHeight: 23, color: theme.colors.text }}>{note.body}</Text>
            <Text style={{ fontSize: 11, color: theme.colors.muted, marginTop: 10 }}>
              {shortTime(note.createdAt)}
            </Text>
          </View>

          {/* My reply, if sent */}
          {replyBody ? (
            <View style={[styles.bubble, styles.replyBubble, { backgroundColor: theme.colors.surface2 }]}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.muted, marginBottom: 6 }}>
                {t('notes.yourReply')}
              </Text>
              <Text style={{ fontSize: 16, lineHeight: 23, color: theme.colors.text }}>{replyBody}</Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Reply composer — only when not yet replied (one reply max). */}
        {replyBody ? (
          <View style={[styles.repliedBar, { borderTopColor: theme.colors.line }]}>
            <Text style={{ fontSize: 13, color: theme.colors.muted, textAlign: 'center' }}>
              {t('notes.alreadyReplied')}
            </Text>
          </View>
        ) : (
          <View style={[styles.composer, { borderTopColor: theme.colors.line }]}>
            <TextInput
              value={draft}
              onChangeText={(v) => setDraft(v.slice(0, BODY_MAX))}
              placeholder={t('notes.replyPlaceholder')}
              placeholderTextColor={theme.colors.muted}
              multiline
              maxLength={BODY_MAX}
              style={[styles.input, { color: theme.colors.text, backgroundColor: theme.colors.surface2 }]}
            />
            <Button
              label={t('notes.sendReply')}
              onPress={onReply}
              disabled={!draft.trim() || busy}
            />
          </View>
        )}
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
  bubble: { borderRadius: 18, padding: 16 },
  replyBubble: { marginTop: 14, alignSelf: 'flex-end', maxWidth: '88%' },
  composer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth, gap: 10 },
  repliedBar: { padding: 18, borderTopWidth: StyleSheet.hairlineWidth },
  input: {
    minHeight: 64,
    maxHeight: 140,
    borderRadius: 14,
    padding: 12,
    fontSize: 15,
    textAlignVertical: 'top',
  },
});
