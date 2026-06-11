import React from 'react';
import { View, Text, Pressable, ScrollView, Share, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Copy, Share2, Gift, Ticket } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import { NameWithBadge } from '../../components/NameWithBadge';
import { useAuth } from '../../store/auth';
import { useToast } from '../../components/ToastProvider';
import { getMyInviteCode, getInviteStats } from '../../api/invites';
import { InviteShareCard, CARD_SIZE } from './InviteShareCard';
import { shareInviteCard } from '../../utils/shareInviteCard';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function InviteFriendsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const me = useAuth((s) => s.user);
  const toast = useToast();
  const cardRef = React.useRef<View>(null);

  const codeQ = useQuery({ queryKey: ['invite', 'code'], queryFn: getMyInviteCode, staleTime: 60_000 });
  const statsQ = useQuery({ queryKey: ['invite', 'stats'], queryFn: getInviteStats, staleTime: 30_000 });
  const code = codeQ.data?.code ?? '······';
  const link = codeQ.data?.link ?? '';
  const invited = statsQ.data?.invitedCount ?? 0;

  const onCopy = async () => {
    if (!codeQ.data) return;
    await Clipboard.setStringAsync(code).catch(() => {});
    toast.success(t('invite.copied'));
  };

  const onShareText = async () => {
    if (!codeQ.data) return;
    try {
      await Share.share({ message: t('invite.shareText', { name: me?.nickname || '', code, link }) });
    } catch {
      /* cancelled */
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={{ marginRight: 10 }}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.text }}>{t('invite.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: theme.colors.primarySoft }]}>
          <Gift size={34} color={theme.colors.primaryDeep} />
          <Text style={[styles.heroTitle, { color: theme.colors.primaryDeep }]}>{t('invite.heroTitle')}</Text>
          <Text style={[styles.heroSub, { color: theme.colors.primaryDeep }]}>{t('invite.reward')}</Text>
        </View>

        {/* Code card */}
        <View style={[styles.codeCard, { borderColor: theme.colors.line, backgroundColor: theme.colors.surface }]}>
          <Text style={{ fontSize: 12, color: theme.colors.muted, fontWeight: '700' }}>{t('invite.myCode')}</Text>
          {codeQ.isLoading ? (
            <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 12 }} />
          ) : (
            <Text style={[styles.code, { color: theme.colors.text }]}>{code}</Text>
          )}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Pressable onPress={onCopy} style={[styles.actionBtn, { borderColor: theme.colors.line }]}>
              <Copy size={16} color={theme.colors.text} />
              <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 13.5 }}>{t('invite.copy')}</Text>
            </Pressable>
            <Pressable onPress={onShareText} style={[styles.actionBtn, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}>
              <Share2 size={16} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13.5 }}>{t('invite.share')}</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => shareInviteCard(cardRef, t)} style={{ marginTop: 12, alignSelf: 'center' }}>
            <Text style={{ color: theme.colors.primary, fontSize: 13, fontWeight: '700' }}>{t('invite.shareImage')}</Text>
          </Pressable>
        </View>

        {/* Stats */}
        <Text style={{ textAlign: 'center', color: theme.colors.muted, fontSize: 13.5, marginTop: 18 }}>
          {t('invite.stats', { n: invited, days: invited * 30 })}
        </Text>

        {/* Recent invitees */}
        {(statsQ.data?.recentInvitees?.length ?? 0) > 0 && (
          <View style={{ marginTop: 18 }}>
            <Text style={[styles.section, { color: theme.colors.muted }]}>{t('invite.recent')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
              {statsQ.data!.recentInvitees.map((u) => (
                <Pressable key={u.id} onPress={() => nav.navigate('UserDetail', { userId: u.id })} style={{ alignItems: 'center', width: 64 }}>
                  <Avatar name={u.displayName} uri={u.avatarUrl} size={48} />
                  <NameWithBadge
                    name={u.displayName}
                    official={u.isOfficial}
                    verified={u.isVerified}
                    premium={u.isPremium}
                    textStyle={{ fontSize: 11, color: theme.colors.text2, maxWidth: 64 }}
                    numberOfLines={1}
                    badgeSize={12}
                    containerStyle={{ marginTop: 4, maxWidth: 64 }}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Have a code? */}
        <Pressable onPress={() => nav.navigate('RedeemInvite')} style={{ marginTop: 26, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ticket size={16} color={theme.colors.primary} />
          <Text style={{ color: theme.colors.primary, fontSize: 14, fontWeight: '700' }}>{t('invite.haveCode')}</Text>
        </Pressable>
      </ScrollView>

      {/* Off-screen image card for sharing. */}
      <View style={styles.offscreen} pointerEvents="none">
        <View ref={cardRef} collapsable={false} style={{ width: CARD_SIZE, height: CARD_SIZE }}>
          <InviteShareCard code={code} name={me?.nickname} />
        </View>
      </View>
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
  hero: { borderRadius: 20, padding: 22, alignItems: 'center', gap: 8 },
  heroTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  heroSub: { fontSize: 14, fontWeight: '600', opacity: 0.9, textAlign: 'center' },
  codeCard: { marginTop: 16, borderWidth: 1, borderRadius: 18, padding: 18, alignItems: 'center' },
  code: { fontSize: 36, fontWeight: '900', letterSpacing: 8, marginTop: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
  },
  section: { fontSize: 12, letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 12 },
  offscreen: { position: 'absolute', left: -9999, top: 0 },
});
