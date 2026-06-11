import React from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, SkipForward, UserPlus, X, Heart } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Avatar } from '../../components/Avatar';
import { RoleDot } from '../../components/RoleDot';
import { ChatComposer } from '../../components/ChatComposer';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuth } from '../../store/auth';
import { on as wsOn } from '../../api/ws';
import {
  joinMatch,
  cancelMatch,
  endMatch,
  sendMatchMessage,
  addMatchFriend,
  type MatchPartner,
  type MatchMessage,
} from '../../api/plaza';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Phase = 'searching' | 'chatting' | 'ended';

// Deterministic avatar-gradient index from a user id (mirrors World Chat).
function idxFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 10;
}

export function RandomChatScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const myId = useAuth((s) => s.user?.id) ?? '';

  const [phase, setPhase] = React.useState<Phase>('searching');
  const [partner, setPartner] = React.useState<MatchPartner | null>(null);
  const [messages, setMessages] = React.useState<MatchMessage[]>([]);
  const [draft, setDraft] = React.useState('');
  const [adding, setAdding] = React.useState(false);
  const [added, setAdded] = React.useState(false);

  // Keep the live sessionId in a ref so cleanup/handlers never see a stale value.
  const sessionRef = React.useRef<string | null>(null);
  const phaseRef = React.useRef<Phase>('searching');
  phaseRef.current = phase;

  const beginSearch = React.useCallback(async () => {
    setPhase('searching');
    setPartner(null);
    setMessages([]);
    setAdded(false);
    sessionRef.current = null;
    try {
      const res = await joinMatch();
      if (res.matched) {
        sessionRef.current = res.sessionId;
        setPartner(res.partner);
        setPhase('chatting');
      }
      // matched:false → wait for the match:found WS event below.
    } catch {
      Alert.alert(t('plaza.match.errorTitle'), t('plaza.match.errorBody'));
      nav.goBack();
    }
  }, [nav, t]);

  // Kick off the first search on mount; clean up the queue/session on unmount.
  React.useEffect(() => {
    beginSearch();
    return () => {
      if (phaseRef.current === 'searching') cancelMatch().catch(() => {});
      else if (sessionRef.current) endMatch(sessionRef.current).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // WS: matched while we were waiting, partner messages, partner left.
  React.useEffect(() => {
    let cancelled = false;
    const unsubs: Array<() => void> = [];
    (async () => {
      const uFound = await wsOn('match:found', ({ sessionId, partner: p }) => {
        if (cancelled) return;
        sessionRef.current = sessionId;
        setPartner(p as MatchPartner);
        setMessages([]);
        setAdded(false);
        setPhase('chatting');
      });
      const uRecv = await wsOn('match:receive', (m) => {
        if (cancelled || m.sessionId !== sessionRef.current) return;
        setMessages((prev) =>
          prev.some((x) => x.messageId === m.messageId) ? prev : [m as MatchMessage, ...prev],
        );
      });
      const uEnd = await wsOn('match:ended', ({ sessionId }) => {
        if (cancelled || sessionId !== sessionRef.current) return;
        sessionRef.current = null;
        setPhase('ended');
      });
      if (cancelled) {
        uFound();
        uRecv();
        uEnd();
        return;
      }
      unsubs.push(uFound, uRecv, uEnd);
    })();
    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, []);

  const onSend = async () => {
    const text = draft.trim();
    const sid = sessionRef.current;
    if (!text || !sid) return;
    setDraft('');
    try {
      const msg = await sendMatchMessage(sid, text);
      setMessages((prev) => [msg, ...prev]);
    } catch {
      setDraft(text); // restore on failure
    }
  };

  const onNext = async () => {
    const sid = sessionRef.current;
    if (sid) await endMatch(sid).catch(() => {});
    beginSearch();
  };

  const onExit = async () => {
    const sid = sessionRef.current;
    if (phaseRef.current === 'searching') await cancelMatch().catch(() => {});
    else if (sid) await endMatch(sid).catch(() => {});
    nav.goBack();
  };

  const onAddFriend = async () => {
    const sid = sessionRef.current;
    if (!sid || added) return;
    setAdding(true);
    try {
      await addMatchFriend(sid);
      setAdded(true);
    } catch {
      Alert.alert(t('plaza.match.addFailed'));
    } finally {
      setAdding(false);
    }
  };

  // ── Searching ───────────────────────────────────────────────────────────────
  if (phase === 'searching') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 18 }}>
          <Heart size={56} color={theme.colors.primary} fill={theme.colors.primarySoft} strokeWidth={1.6} />
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={{ fontSize: 17, fontWeight: '700', color: theme.colors.text }}>
            {t('plaza.match.searching')}
          </Text>
          <Text style={{ fontSize: 13, color: theme.colors.muted, textAlign: 'center' }}>
            {t('plaza.match.searchingHint')}
          </Text>
          <Pressable
            onPress={onExit}
            style={{
              marginTop: 12,
              paddingVertical: 12,
              paddingHorizontal: 28,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: theme.colors.line,
              backgroundColor: theme.colors.surface,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.text }}>
              {t('common.cancel')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Chatting / ended ─────────────────────────────────────────────────────────
  const locBits = [partner?.city, partner?.age ? `${partner.age}` : null].filter(Boolean).join(' · ');
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.line,
        }}
      >
        <Pressable onPress={onExit} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Avatar
          name={partner?.nickname || '?'}
          uri={partner?.avatarUrl}
          avatarIdx={idxFor(partner?.id || '')}
          size={38}
        />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <RoleDot tag={partner?.roleTag} />
            <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text }}>
              {partner?.nickname || t('plaza.match.stranger')}
            </Text>
          </View>
          {!!locBits && (
            <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 1 }}>{locBits}</Text>
          )}
        </View>
        {/* Add friend */}
        <Pressable onPress={onAddFriend} disabled={adding || added || phase === 'ended'} hitSlop={6}>
          <UserPlus
            size={22}
            color={added ? theme.colors.success : theme.colors.primary}
            strokeWidth={1.8}
          />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <FlatList
          data={messages}
          inverted
          keyExtractor={(m) => m.messageId}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 60, transform: [{ scaleY: -1 }] }}>
              <Text style={{ fontSize: 14, color: theme.colors.muted, textAlign: 'center' }}>
                {t('plaza.match.matchedHint')}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const mine = item.senderId === myId;
            return (
              <View style={{ flexDirection: mine ? 'row-reverse' : 'row' }}>
                <View
                  style={{
                    maxWidth: '78%',
                    backgroundColor: mine ? theme.colors.bubbleMeBg : theme.colors.surface,
                    borderWidth: mine ? 0 : 1,
                    borderColor: theme.colors.line,
                    borderRadius: 16,
                    paddingVertical: 9,
                    paddingHorizontal: 13,
                  }}
                >
                  <Text style={{ fontSize: 15, color: mine ? theme.colors.bubbleMeText : theme.colors.text }}>
                    {item.body}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        {phase === 'ended' ? (
          <View style={{ padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: theme.colors.line }}>
            <Text style={{ textAlign: 'center', fontSize: 14, color: theme.colors.muted }}>
              {t('plaza.match.partnerLeft')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <ActionButton icon={<SkipForward size={18} color="#fff" />} label={t('plaza.match.next')} solid onPress={onNext} />
              <ActionButton icon={<X size={18} color={theme.colors.text} />} label={t('plaza.match.exit')} onPress={onExit} />
            </View>
          </View>
        ) : (
          <>
            <View
              style={{
                flexDirection: 'row',
                gap: 10,
                paddingHorizontal: 16,
                paddingTop: 8,
              }}
            >
              <ActionButton icon={<SkipForward size={18} color="#fff" />} label={t('plaza.match.next')} solid onPress={onNext} />
              <ActionButton
                icon={<UserPlus size={18} color={added ? theme.colors.success : theme.colors.text} />}
                label={added ? t('plaza.match.added') : t('plaza.match.addFriend')}
                onPress={onAddFriend}
                disabled={adding || added}
              />
              <ActionButton icon={<X size={18} color={theme.colors.text} />} label={t('plaza.match.exit')} onPress={onExit} />
            </View>
            <ChatComposer
              value={draft}
              onChangeText={setDraft}
              onSend={onSend}
              placeholder={t('plaza.match.placeholder')}
              maxLength={2000}
            />
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  solid,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  solid?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 11,
        borderRadius: 999,
        backgroundColor: solid ? theme.colors.primary : theme.colors.surface,
        borderWidth: solid ? 0 : 1,
        borderColor: theme.colors.line,
        opacity: disabled ? 0.5 : pressed ? 0.9 : 1,
      })}
    >
      {icon}
      <Text style={{ fontSize: 13.5, fontWeight: '700', color: solid ? '#fff' : theme.colors.text }}>
        {label}
      </Text>
    </Pressable>
  );
}
