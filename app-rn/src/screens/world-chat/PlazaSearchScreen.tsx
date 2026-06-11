import React from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Search as SearchIcon, X, Clock, Hash } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import { NameWithBadge } from '../../components/NameWithBadge';
import { EmptyState } from '../../components/EmptyState';
import { shortTime } from '../../utils/time';
import type { RootStackParamList } from '../../navigation/types';
import {
  searchPlazaMessages,
  searchPlazaRooms,
  searchPlazaUsers,
  type RoomLabel,
  type PlazaMessageResult,
  type PlazaRoomResult,
} from '../../api/plazaSearch';
import type { SearchUser } from '../../api/search';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Tab = 'rooms' | 'messages' | 'users';
const RECENT_KEY = 'meyou:plaza-search:v1';
const MAX_RECENT = 8;

function idxFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 10;
}

const TABS: { key: Tab; labelKey: string }[] = [
  { key: 'rooms', labelKey: 'plaza.search.tabs.rooms' },
  { key: 'messages', labelKey: 'plaza.search.tabs.messages' },
  { key: 'users', labelKey: 'plaza.search.tabs.users' },
];

/**
 * 广场搜索 — search across Plaza rooms (by name), messages (full-text in every
 * room the user can read) and users. Opened from the 🔍 in the Plaza tab bar.
 * Recent queries persist locally; message matches are highlighted. (CCCCCCC)
 */
export function PlazaSearchScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const nav = useNavigation<Nav>();
  const zh = i18n.language.startsWith('zh');
  const localize = React.useCallback((l: RoomLabel) => (zh ? l.zh : l.en), [zh]);

  const [raw, setRaw] = React.useState('');
  const [q, setQ] = React.useState('');
  const [tab, setTab] = React.useState<Tab>('rooms');
  const [recent, setRecent] = React.useState<string[]>([]);

  // Debounce the query 300ms so we don't fire a request per keystroke.
  React.useEffect(() => {
    const id = setTimeout(() => setQ(raw.trim()), 300);
    return () => clearTimeout(id);
  }, [raw]);

  React.useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY)
      .then((v) => {
        if (v) setRecent(JSON.parse(v));
      })
      .catch(() => {});
  }, []);

  const remember = React.useCallback((term: string) => {
    const trimmed = term.trim();
    if (trimmed.length < 2) return;
    setRecent((prev) => {
      const next = [trimmed, ...prev.filter((x) => x !== trimmed)].slice(0, MAX_RECENT);
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const clearRecent = () => {
    setRecent([]);
    AsyncStorage.removeItem(RECENT_KEY).catch(() => {});
  };

  const roomsQ = useQuery({
    queryKey: ['plazaSearch', 'rooms', q],
    queryFn: () => searchPlazaRooms(q),
    enabled: tab === 'rooms' && q.length >= 1,
    staleTime: 15_000,
  });
  const messagesQ = useQuery({
    queryKey: ['plazaSearch', 'messages', q],
    queryFn: () => searchPlazaMessages(q),
    enabled: tab === 'messages' && q.length >= 1,
    staleTime: 15_000,
  });
  const usersQ = useQuery({
    queryKey: ['plazaSearch', 'users', q],
    queryFn: () => searchPlazaUsers(q),
    enabled: tab === 'users' && q.length >= 1,
    staleTime: 15_000,
  });

  const activeQ = tab === 'rooms' ? roomsQ : tab === 'messages' ? messagesQ : usersQ;

  const openRoom = (roomId: string, title: string, custom: boolean, scrollToMessageId?: string) => {
    remember(q);
    nav.navigate('WorldChatRoom', { roomId, title, custom, scrollToMessageId });
  };

  const renderRoom = ({ item }: { item: PlazaRoomResult }) => {
    const name = localize(item.label);
    return (
      <Pressable style={styles.row} onPress={() => openRoom(item.id, name, item.kind === 'custom')}>
        <View style={[styles.iconTile, { backgroundColor: theme.colors.primarySoft }]}>
          {item.flag ? (
            <Text style={{ fontSize: 22 }}>{item.flag}</Text>
          ) : (
            <Hash size={20} color={theme.colors.primaryDeep} strokeWidth={1.8} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: theme.colors.text }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }} numberOfLines={1}>
            {item.kind === 'custom' && item.description
              ? item.description
              : t('plaza.onlineCount', { count: item.onlineCount })}
          </Text>
        </View>
      </Pressable>
    );
  };

  const renderMessage = ({ item }: { item: PlazaMessageResult }) => {
    const snippet = item.body || item.caption || (item.type === 'voice' ? '🎙️' : '📷');
    const roomName = localize(item.roomLabel);
    const roomTag = `${item.roomFlag ? `${item.roomFlag} ` : ''}${roomName}`;
    return (
      <Pressable
        style={styles.msgRow}
        onPress={() => openRoom(item.roomId, roomName, item.custom, item.messageId)}
      >
        <Avatar uri={item.avatarUrl} name={item.displayName} avatarIdx={idxFor(item.userId)} size={40} />
        <View style={{ flex: 1 }}>
          <Highlight text={snippet} q={q} color={theme.colors.text} hi={theme.colors.primary} />
          <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 3 }} numberOfLines={1}>
            {item.displayName} · {roomTag} · {shortTime(item.createdAt)}
          </Text>
        </View>
      </Pressable>
    );
  };

  const renderUser = ({ item }: { item: SearchUser }) => (
    <Pressable
      style={styles.row}
      onPress={() => {
        remember(q);
        nav.navigate('UserDetail', { userId: item.id });
      }}
    >
      <Avatar uri={item.avatarUrl} name={item.nickname} avatarIdx={idxFor(item.id)} size={44} />
      <NameWithBadge
        name={item.nickname}
        official={item.isOfficial}
        verified={item.isVerified}
        textStyle={{ fontSize: 15, fontWeight: '600', color: theme.colors.text }}
        containerStyle={{ flex: 1 }}
      />
    </Pressable>
  );

  const data: any[] =
    tab === 'rooms'
      ? roomsQ.data?.rooms ?? []
      : tab === 'messages'
        ? messagesQ.data?.messages ?? []
        : usersQ.data?.users ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={theme.iconSize.l} color={theme.colors.text} />
        </Pressable>
        <View style={[styles.searchBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.line }]}>
          <SearchIcon size={16} color={theme.colors.muted} strokeWidth={1.8} />
          <TextInput
            value={raw}
            onChangeText={setRaw}
            autoFocus
            placeholder={t('plaza.search.placeholder')}
            placeholderTextColor={theme.colors.muted}
            style={{ flex: 1, fontSize: 15, color: theme.colors.text, padding: 0 }}
            returnKeyType="search"
            onSubmitEditing={() => remember(raw)}
          />
          {raw.length > 0 && (
            <Pressable onPress={() => setRaw('')} hitSlop={8}>
              <X size={16} color={theme.colors.muted} />
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.tabs}>
        {TABS.map((tb) => {
          const active = tab === tb.key;
          return (
            <Pressable
              key={tb.key}
              onPress={() => setTab(tb.key)}
              style={[
                styles.tabPill,
                {
                  backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                  borderColor: active ? theme.colors.primary : theme.colors.line,
                },
              ]}
            >
              <Text style={{ color: active ? '#FFFFFF' : theme.colors.text2, fontSize: 13.5, fontWeight: '600' }}>
                {t(tb.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {q.length < 1 ? (
        recent.length > 0 ? (
          <View style={{ flex: 1 }}>
            <View style={styles.recentHead}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.text2 }}>
                {t('plaza.search.recent')}
              </Text>
              <Pressable onPress={clearRecent} hitSlop={8}>
                <Text style={{ fontSize: 13, color: theme.colors.primary }}>{t('plaza.search.clear')}</Text>
              </Pressable>
            </View>
            {recent.map((term) => (
              <Pressable key={term} style={styles.row} onPress={() => setRaw(term)}>
                <Clock size={18} color={theme.colors.muted} strokeWidth={1.8} />
                <Text style={[styles.rowTitle, { color: theme.colors.text }]} numberOfLines={1}>
                  {term}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <EmptyState emoji="🔍" title={t('plaza.search.hintTitle')} subtitle={t('plaza.search.hintSubtitle')} />
        )
      ) : activeQ.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : data.length === 0 ? (
        <EmptyState emoji="🫥" title={t('plaza.search.empty', { q })} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(it: any) => it.messageId ?? it.id}
          renderItem={
            tab === 'rooms' ? renderRoom : tab === 'messages' ? renderMessage : (renderUser as any)
          }
          contentContainerStyle={{ paddingVertical: 6 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      )}
    </SafeAreaView>
  );
}

/** Renders `text` with case-insensitive occurrences of `q` tinted + bold. */
function Highlight({ text, q, color, hi }: { text: string; q: string; color: string; hi: string }) {
  const base = { fontSize: 15, lineHeight: 20, color };
  if (!q) return <Text style={base} numberOfLines={2}>{text}</Text>;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const parts: { s: string; on: boolean }[] = [];
  let i = 0;
  // Guard against an empty needle (would loop forever).
  if (needle.length === 0) return <Text style={base} numberOfLines={2}>{text}</Text>;
  while (i <= text.length) {
    const at = lower.indexOf(needle, i);
    if (at < 0) {
      parts.push({ s: text.slice(i), on: false });
      break;
    }
    if (at > i) parts.push({ s: text.slice(i, at), on: false });
    parts.push({ s: text.slice(at, at + needle.length), on: true });
    i = at + needle.length;
  }
  return (
    <Text style={base} numberOfLines={2}>
      {parts.map((p, k) => (
        <Text key={k} style={p.on ? { color: hi, fontWeight: '700' } : undefined}>
          {p.s}
        </Text>
      ))}
    </Text>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  tabPill: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  recentHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '600' },
  iconTile: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
