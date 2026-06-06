import React from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, StickyNote } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import {
  getInbox,
  getSentNotes,
  markNotesRead,
  type InboxNote,
  type SentNote,
} from '../../api/notes';
import { shortTime } from '../../utils/time';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Tab = 'inbox' | 'sent';

/**
 * 小纸条 — anonymous notes inbox. "收到" lists received notes (sender hidden);
 * "已发出" lists notes I sent (recipient shown). Opening this screen marks the
 * inbox read, clearing the 信息-tab badge.
 */
export function NotesInboxScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const qc = useQueryClient();
  const [tab, setTab] = React.useState<Tab>('inbox');

  const inboxQ = useQuery({
    queryKey: ['notes', 'inbox'],
    queryFn: getInbox,
    staleTime: 15_000,
  });
  const sentQ = useQuery({
    queryKey: ['notes', 'sent'],
    queryFn: getSentNotes,
    enabled: tab === 'sent',
    staleTime: 15_000,
  });

  // Mark inbox read on mount → clears the badge. Fire once.
  React.useEffect(() => {
    markNotesRead().then(() => {
      qc.invalidateQueries({ queryKey: ['notes', 'unread'] });
    });
  }, [qc]);

  const loading = tab === 'inbox' ? inboxQ.isLoading : sentQ.isLoading;
  const error = tab === 'inbox' ? inboxQ.isError : sentQ.isError;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ marginLeft: 8, fontSize: 16, fontWeight: '600', color: theme.colors.text }}>
          {t('notes.title')}
        </Text>
      </View>

      {/* 收到 / 已发出 toggle */}
      <View style={styles.tabs}>
        {(['inbox', 'sent'] as Tab[]).map((k) => {
          const active = tab === k;
          return (
            <Pressable key={k} onPress={() => setTab(k)} style={styles.tabBtn}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: active ? '700' : '500',
                  color: active ? theme.colors.primary : theme.colors.muted,
                }}
              >
                {t(k === 'inbox' ? 'notes.tabInbox' : 'notes.tabSent')}
              </Text>
              <View
                style={{
                  height: 2,
                  marginTop: 6,
                  borderRadius: 1,
                  backgroundColor: active ? theme.colors.primary : 'transparent',
                }}
              />
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerFill}>
          <Text style={{ color: theme.colors.muted, marginBottom: 12 }}>{t('notes.loadFailed')}</Text>
          <Button
            label={t('common.retry')}
            variant="soft"
            onPress={() => (tab === 'inbox' ? inboxQ.refetch() : sentQ.refetch())}
          />
        </View>
      ) : tab === 'inbox' ? (
        <FlatList
          data={inboxQ.data?.notes ?? []}
          keyExtractor={(n) => n._id}
          contentContainerStyle={{ paddingVertical: 4 }}
          ItemSeparatorComponent={Sep}
          renderItem={({ item }) => (
            <InboxRow note={item} onPress={() => nav.navigate('NoteDetail', { note: item })} />
          )}
          ListEmptyComponent={
            <EmptyState
              emoji="📝"
              title={t('notes.emptyInbox')}
              subtitle={t('empty.notes.subtitle')}
              primaryLabel={t('empty.notes.cta')}
              onPrimary={() => nav.navigate('Main', { screen: 'Discover' })}
            />
          }
        />
      ) : (
        <FlatList
          data={sentQ.data?.notes ?? []}
          keyExtractor={(n) => n._id}
          contentContainerStyle={{ paddingVertical: 4 }}
          ItemSeparatorComponent={Sep}
          renderItem={({ item }) => (
            <SentRow note={item} onPress={() => nav.navigate('NoteDetail', { sent: item })} />
          )}
          ListEmptyComponent={<Empty text={t('notes.emptySent')} />}
        />
      )}
    </SafeAreaView>
  );
}

function Sep() {
  const theme = useTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.line,
        marginLeft: 20,
      }}
    />
  );
}

function Empty({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.centerFill}>
      <Text style={{ color: theme.colors.muted, textAlign: 'center' }}>{text}</Text>
    </View>
  );
}

function InboxRow({ note, onPress }: { note: InboxNote; onPress: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 20,
        paddingVertical: 14,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: theme.colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <StickyNote size={20} color={theme.colors.primary} strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text
            numberOfLines={1}
            style={{ flex: 1, fontSize: 15, fontWeight: note.read ? '500' : '700', color: theme.colors.text }}
          >
            {note.body}
          </Text>
          {!note.read && (
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary }} />
          )}
        </View>
        <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 3 }}>
          {shortTime(note.createdAt)}
          {note.replyBody ? ` · ${t('notes.replied')}` : ''}
        </Text>
      </View>
      <ChevronRight size={18} color={theme.colors.muted} />
    </Pressable>
  );
}

function SentRow({ note, onPress }: { note: SentNote; onPress: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 20,
        paddingVertical: 14,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Avatar name={note.recipient.nickname || '?'} uri={note.recipient.avatarUrl} size={40} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: theme.colors.text }}>
          {note.body}
        </Text>
        <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 3 }}>
          {t('notes.toRecipient', { name: note.recipient.nickname })} · {shortTime(note.createdAt)}
        </Text>
        {note.replyBody ? (
          <Text
            numberOfLines={2}
            style={{ fontSize: 13, color: theme.colors.text2, marginTop: 5, fontStyle: 'italic' }}
          >
            ↩ {note.replyBody}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={18} color={theme.colors.muted} />
    </Pressable>
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
  tabs: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 12, gap: 24 },
  tabBtn: { alignItems: 'center' },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 28,
  },
});
