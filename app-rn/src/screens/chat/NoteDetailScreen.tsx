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
import { ChevronLeft, Trash2, Ban, StickyNote, Share2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { replyNote, deleteNote, blockNoteSender } from '../../api/notes';
import { shortTime } from '../../utils/time';
import { shareNoteCard } from '../../utils/shareNoteCard';
import { NoteShareCard, CARD_SIZE } from './NoteShareCard';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const BODY_MAX = 200;

/**
 * 小纸条 detail.
 * - Inbox mode (`note`): the recipient reads an ANONYMOUS note and may reply
 *   once (revealing their name — see the disclaimer), delete it, block the
 *   hidden sender, or share it as a branded image card.
 * - Outbox mode (`sent`): the sender re-reads their own note; if the recipient
 *   replied, the replier's name + avatar are shown (consent-to-identify).
 */
export function NoteDetailScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'NoteDetail'>>();
  const qc = useQueryClient();

  const { note, sent } = route.params;
  const outbox = !!sent;
  const body = outbox ? sent!.body : note!.body;
  const createdAt = outbox ? sent!.createdAt : note!.createdAt;

  const [replyBody, setReplyBody] = React.useState(
    (outbox ? sent!.replyBody : note!.replyBody) ?? null,
  );
  const [draft, setDraft] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const cardRef = React.useRef<View>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['notes', 'inbox'] });
    qc.invalidateQueries({ queryKey: ['notes', 'unread'] });
  };

  const onReply = async () => {
    const text = draft.trim();
    if (!text || busy || !note) return;
    setBusy(true);
    try {
      const res = await replyNote(note._id, text);
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
    if (!note) return;
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
    if (!note) return;
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
        {/* Share + moderation actions are recipient-only (inbox mode). */}
        {!outbox && (
          <>
            <Pressable onPress={() => shareNoteCard(cardRef, t)} hitSlop={8} style={{ marginRight: 16 }}>
              <Share2 size={20} color={theme.colors.muted} />
            </Pressable>
            <Pressable onPress={onBlock} hitSlop={8} style={{ marginRight: 16 }}>
              <Ban size={20} color={theme.colors.muted} />
            </Pressable>
            <Pressable onPress={onDelete} hitSlop={8}>
              <Trash2 size={20} color={theme.colors.muted} />
            </Pressable>
          </>
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {/* The note */}
          <View style={[styles.bubble, { backgroundColor: theme.colors.primarySoft }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <StickyNote size={16} color={theme.colors.primary} strokeWidth={2} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.primary }}>
                {outbox ? t('notes.sentLabel') : t('notes.anonymousSender')}
              </Text>
            </View>
            <Text style={{ fontSize: 16, lineHeight: 23, color: theme.colors.text }}>{body}</Text>
            <Text style={{ fontSize: 11, color: theme.colors.muted, marginTop: 10 }}>
              {shortTime(createdAt)}
            </Text>
          </View>

          {/* Reply. In outbox mode the replier (= recipient) is identified. */}
          {replyBody ? (
            <View style={[styles.bubble, styles.replyBubble, { backgroundColor: theme.colors.surface2 }]}>
              {outbox && sent!.replier ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Avatar
                    name={sent!.replier.displayName || '?'}
                    uri={sent!.replier.avatarUrl}
                    size={24}
                  />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.text }}>
                    {sent!.replier.displayName}
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.colors.muted }}>
                    {t('notes.repliedLabel')}
                  </Text>
                </View>
              ) : (
                <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.muted, marginBottom: 6 }}>
                  {t('notes.yourReply')}
                </Text>
              )}
              <Text style={{ fontSize: 16, lineHeight: 23, color: theme.colors.text }}>{replyBody}</Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Reply composer — inbox-only, and only until the one reply is sent. */}
        {!outbox && (
          replyBody ? (
            <View style={[styles.repliedBar, { borderTopColor: theme.colors.line }]}>
              <Text style={{ fontSize: 13, color: theme.colors.muted, textAlign: 'center' }}>
                {t('notes.alreadyReplied')}
              </Text>
            </View>
          ) : (
            <View style={[styles.composer, { borderTopColor: theme.colors.line }]}>
              <Text style={{ fontSize: 11.5, color: theme.colors.muted }}>
                ⚠️ {t('notes.replyDisclaimer')}
              </Text>
              <TextInput
                value={draft}
                onChangeText={(v) => setDraft(v.slice(0, BODY_MAX))}
                placeholder={t('notes.replyPlaceholder')}
                placeholderTextColor={theme.colors.muted}
                multiline
                maxLength={BODY_MAX}
                style={[styles.input, { color: theme.colors.text, backgroundColor: theme.colors.surface2 }]}
              />
              <Button label={t('notes.sendReply')} onPress={onReply} disabled={!draft.trim() || busy} />
            </View>
          )
        )}
      </KeyboardAvoidingView>

      {/* Off-screen branded card captured for image share (inbox only). */}
      {!outbox && (
        <View style={styles.offscreen} pointerEvents="none">
          <View ref={cardRef} collapsable={false} style={{ width: CARD_SIZE, height: CARD_SIZE }}>
            <NoteShareCard body={body} />
          </View>
        </View>
      )}
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
  // Rendered but kept off visible screen (not opacity:0 — view-shot needs the
  // target fully drawn) so it can be captured on demand.
  offscreen: { position: 'absolute', left: -9999, top: 0 },
});
