import React from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, SkipForward, UserPlus, Send, Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import { RoleDot } from '../../components/RoleDot';
import { useAuth } from '../../store/auth';
import { joinMatch, nextMatch, leaveMatch, type MatchJoinResult, type MatchPartner } from '../../api/plaza';
import { toggleFollow } from '../../api/follows';
import { on as wsOn, emit as wsEmit } from '../../api/ws';
import { shortTime } from '../../utils/time';

type Phase = 'searching' | 'matched' | 'partnerLeft';
type LocalMsg = { id: string; mine: boolean; body: string; createdAt: string };

/**
 * ❤️ 随机聊天 — random 1-on-1 matchmaking (Plaza Phase 3).
 *
 * Ephemeral: nothing here is persisted. We join the queue on mount, surface a
 * "match found" moment, then relay messages peer-to-peer over WS. "Next" finds
 * a fresh partner, "Add friend" converts to a permanent follow, "Exit" leaves.
 */
export function MatchmakingScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation();
  const myId = useAuth((s) => s.user?.id);

  const [phase, setPhase] = React.useState<Phase>('searching');
  const [partner, setPartner] = React.useState<MatchPartner | null>(null);
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<LocalMsg[]>([]);
  const [draft, setDraft] = React.useState('');
  const [followed, setFollowed] = React.useState(false);
  const [reveal, setReveal] = React.useState(false); // match-found flash

  // A monotonic-ish local id without Date.now in render paths.
  const seq = React.useRef(0);
  const localId = () => `l${(seq.current += 1)}`;

  const enterMatch = React.useCallback((sid: string, p: MatchPartner | null) => {
    setSessionId(sid);
    setPartner(p);
    setMessages([]);
    setFollowed(false);
    setPhase('matched');
    setReveal(true);
    setTimeout(() => setReveal(false), 1400);
  }, []);

  // Enter the searching state, then run a join/next request. On 'matched' we
  // transition immediately; on 'waiting' the WS 'match:found' handler takes
  // over. `request` is joinMatch (fresh) or nextMatch (drop current + re-queue,
  // done atomically server-side to avoid re-matching the partner we just left).
  const startSearch = React.useCallback(
    async (request: () => Promise<MatchJoinResult>) => {
      setPhase('searching');
      setPartner(null);
      setSessionId(null);
      try {
        const res = await request();
        if (res.status === 'matched') enterMatch(res.sessionId, res.partner);
      } catch {
        // Network blip — stay on the searching screen; the user can Exit.
      }
    },
    [enterMatch],
  );

  const search = React.useCallback(() => startSearch(joinMatch), [startSearch]);

  React.useEffect(() => {
    search();
    return () => {
      // Best-effort: leave the queue / end any session when we unmount.
      leaveMatch().catch(() => {});
      wsEmit('match:leave', {});
    };
  }, [search]);

  // WS: a partner arrived while we were waiting.
  React.useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;
    (async () => {
      const u = await wsOn('match:found', ({ sessionId: sid, partner: p }) => {
        if (!cancelled) enterMatch(sid, p);
      });
      if (cancelled) u();
      else unsub = u;
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [enterMatch]);

  // WS: incoming ephemeral message from the partner.
  React.useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;
    (async () => {
      const u = await wsOn('match:message', (m) => {
        if (cancelled || m.sessionId !== sessionId) return;
        setMessages((prev) => [
          { id: localId(), mine: false, body: m.body, createdAt: m.createdAt },
          ...prev,
        ]);
      });
      if (cancelled) u();
      else unsub = u;
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [sessionId]);

  // WS: partner left / session ended.
  React.useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;
    (async () => {
      const u = await wsOn('match:ended', (e) => {
        if (cancelled || e.sessionId !== sessionId) return;
        setPhase('partnerLeft');
        setSessionId(null);
      });
      if (cancelled) u();
      else unsub = u;
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [sessionId]);

  const sendMessage = () => {
    const body = draft.trim();
    if (!body || !sessionId) return;
    wsEmit('match:send', { sessionId, body });
    setMessages((prev) => [
      { id: localId(), mine: true, body, createdAt: new Date().toISOString() },
      ...prev,
    ]);
    setDraft('');
  };

  const onNext = () => {
    // Drop the current partner and find another. nextMatch() ends the current
    // session (notifying the partner) and re-queues atomically server-side.
    startSearch(nextMatch);
  };

  const onAddFriend = async () => {
    if (!partner || followed) return;
    setFollowed(true);
    try {
      const r = await toggleFollow(partner.id);
      setFollowed(r.following);
    } catch {
      setFollowed(false);
    }
  };

  const onExit = () => {
    leaveMatch().catch(() => {});
    nav.goBack();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const Header = (
    <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
      <Pressable onPress={onExit} hitSlop={10} style={styles.iconBtn}>
        <X size={22} color={theme.colors.text} />
      </Pressable>
      <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text }}>
        {t('plaza.randomChat')}
      </Text>
      <View style={{ width: 22 }} />
    </View>
  );

  if (phase === 'searching') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top', 'bottom']}>
        {Header}
        <View style={styles.center}>
          <Text style={{ fontSize: 64 }}>❤️</Text>
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 24 }} />
          <Text style={{ marginTop: 20, fontSize: 16, color: theme.colors.text2, fontWeight: '600' }}>
            {t('plaza.match.searching')}
          </Text>
          <Pressable onPress={onExit} style={{ marginTop: 28 }}>
            <Text style={{ color: theme.colors.muted, fontSize: 14 }}>{t('plaza.match.exit')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'partnerLeft') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top', 'bottom']}>
        {Header}
        <View style={styles.center}>
          <Text style={{ fontSize: 56 }}>👋</Text>
          <Text style={{ marginTop: 18, fontSize: 16, color: theme.colors.text2, fontWeight: '600' }}>
            {t('plaza.match.partnerLeft')}
          </Text>
          <Pressable
            onPress={search}
            style={[styles.cta, { backgroundColor: theme.colors.primary, marginTop: 26 }]}
          >
            <SkipForward size={18} color="#FFFFFF" />
            <Text style={styles.ctaText}>{t('plaza.match.findAnother')}</Text>
          </Pressable>
          <Pressable onPress={onExit} style={{ marginTop: 18 }}>
            <Text style={{ color: theme.colors.muted, fontSize: 14 }}>{t('plaza.match.exit')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // matched
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top', 'bottom']}>
      {Header}

      {/* Partner card */}
      <View style={[styles.partnerBar, { borderBottomColor: theme.colors.line }]}>
        <Avatar name={partner?.nickname || '?'} uri={partner?.avatarUrl} size={40} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <RoleDot role={partner?.role} size={8} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text }} numberOfLines={1}>
              {partner?.nickname}
            </Text>
          </View>
          {(partner?.age != null || partner?.city) && (
            <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 1 }} numberOfLines={1}>
              {[partner?.age, partner?.city].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>
        {reveal && (
          <Text style={{ fontSize: 13, fontWeight: '800', color: theme.colors.primary }}>
            {t('plaza.match.found')}
          </Text>
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <FlatList
          data={messages}
          inverted
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          ListEmptyComponent={
            <View style={{ paddingTop: 60, alignItems: 'center' }}>
              <Text style={{ color: theme.colors.muted }}>{t('plaza.match.sayHi')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.mine
                  ? { alignSelf: 'flex-end', backgroundColor: theme.colors.primary }
                  : { alignSelf: 'flex-start', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line },
              ]}
            >
              <Text style={{ color: item.mine ? '#FFFFFF' : theme.colors.text, fontSize: 15, lineHeight: 21 }}>
                {item.body}
              </Text>
              <Text style={{ color: item.mine ? 'rgba(255,255,255,0.7)' : theme.colors.muted, fontSize: 10, marginTop: 3, alignSelf: 'flex-end' }}>
                {shortTime(item.createdAt)}
              </Text>
            </View>
          )}
        />

        {/* Action row + composer */}
        <View style={[styles.actions, { borderTopColor: theme.colors.line }]}>
          <Pressable onPress={onNext} style={[styles.actionBtn, { backgroundColor: theme.colors.surface2 }]}>
            <SkipForward size={18} color={theme.colors.text} />
            <Text style={[styles.actionText, { color: theme.colors.text }]}>{t('plaza.match.next')}</Text>
          </Pressable>
          <Pressable
            onPress={onAddFriend}
            disabled={followed}
            style={[styles.actionBtn, { backgroundColor: followed ? theme.colors.primarySoft : theme.colors.surface2 }]}
          >
            {followed ? <Check size={18} color={theme.colors.primaryDeep} /> : <UserPlus size={18} color={theme.colors.text} />}
            <Text style={[styles.actionText, { color: followed ? theme.colors.primaryDeep : theme.colors.text }]}>
              {followed ? t('plaza.match.added') : t('plaza.match.addFriend')}
            </Text>
          </Pressable>
        </View>

        <View style={[styles.composer, { borderTopColor: theme.colors.line, backgroundColor: theme.colors.bg }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t('plaza.match.placeholder')}
            placeholderTextColor={theme.colors.muted}
            style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.line, color: theme.colors.text }]}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
            multiline
          />
          <Pressable
            onPress={sendMessage}
            disabled={!draft.trim()}
            style={[styles.sendBtn, { backgroundColor: draft.trim() ? theme.colors.primary : theme.colors.surface2 }]}
          >
            <Send size={18} color={draft.trim() ? '#FFFFFF' : theme.colors.muted} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  iconBtn: { padding: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 999 },
  ctaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  partnerBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  bubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 999 },
  actionText: { fontWeight: '700', fontSize: 14 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1 },
  input: { flex: 1, minHeight: 42, maxHeight: 120, borderRadius: 21, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});
