import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Crown, Lock, MoreHorizontal, Send } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import { TagChip } from '../../components/TagChip';
import { Card } from '../../components/Card';
import { tagById, type InterestTagId } from '../../data/interestTags';
import { getUserById } from '../../api/me';
import { openConversation } from '../../api/chats';
import {
  getPrivatePhotos,
  getSent,
  requestPrivatePhotos,
  type PhotoRequestStatus,
} from '../../api/privatePhotos';
import { useAuth } from '../../store/auth';
import { brandGradient } from '../../theme/tokens';
import { showSafetyMenu } from '../../utils/safetyMenu';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'UserDetail'>;
type Rt = RouteProp<RootStackParamList, 'UserDetail'>;

/**
 * Full-page profile view for another user. Reached today from the chat
 * header avatar/name tap; reusable from anywhere we want to show a user
 * outside the Discover swipe deck or AboutUserSheet.
 *
 * Shows: avatar, nickname, age, online state, bio, interests, prompts.
 * Action: safety menu (report/block).
 */
export function UserDetailScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const queryClient = useQueryClient();
  const me = useAuth((s) => s.user);
  const isPremium = !!(me as any)?.isPremium;
  const { userId } = route.params;

  const userQ = useQuery({
    queryKey: ['user', userId],
    queryFn: () => getUserById(userId),
    staleTime: 60_000,
  });

  const user = userQ.data;

  const onMore = () => {
    if (!user) return;
    showSafetyMenu({
      userId,
      userName: user.nickname,
      nav,
      // Coming from outside a chat context — no unmatch action.
      includeUnmatch: false,
    });
  };

  // Locate the requester→owner PhotoRequest for granular status (the
  // /private-photos endpoint collapses rejected/revoked/never-requested
  // all into 'none', which doesn't let us show distinct UI per state).
  const sentQ = useQuery({
    queryKey: ['photoRequests', 'sent'],
    queryFn: getSent,
    staleTime: 30_000,
    enabled: !!user && (user.privatePhotosCount ?? 0) > 0,
  });
  const myReqForUser = (sentQ.data?.requests ?? [])
    .filter((r) => r.owner)
    .find((r) => r.owner!._id === userId);
  const reqStatus: PhotoRequestStatus | 'none' = myReqForUser?.status ?? 'none';

  // When approved, fetch the actual photo URLs. The endpoint also handles
  // owner-self but we never hit that branch on someone else's profile.
  const privatePhotosQ = useQuery({
    queryKey: ['user', userId, 'privatePhotos'],
    queryFn: () => getPrivatePhotos(userId),
    enabled: reqStatus === 'approved',
    staleTime: 60_000,
  });

  const requestMut = useMutation({
    mutationFn: () => requestPrivatePhotos(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photoRequests', 'sent'] });
      Alert.alert(t('userDetail.requestSentToast'));
    },
    onError: (e: any) => {
      const detail = e?.response?.data?.error || e?.message || '';
      Alert.alert(t('userDetail.requestFailed'), detail);
    },
  });

  // "Send a message" CTA. Premium → openConversation (free if already
  // matched, else creates a DM). Non-premium → paywall. Mirrors
  // DiscoverScreen.openIntroChat behaviour for 402 fallbacks.
  const onSendMessage = async () => {
    if (!isPremium) {
      nav.navigate('Premium');
      return;
    }
    try {
      const res = await openConversation(userId);
      queryClient.invalidateQueries({ queryKey: ['chats', 'list'] });
      nav.replace('ChatDetail', { chatId: res.matchId });
    } catch (e: any) {
      const status = e?.response?.status;
      const body = e?.response?.data;
      if (status === 402 && body?.reason === 'premium_required') {
        nav.navigate('Premium');
      } else {
        Alert.alert(
          t('discover.openFailedTitle'),
          body?.error || e?.message || t('discover.openFailedFallback'),
        );
      }
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <View style={{ flex: 1 }} />
        {user && (
          <Pressable
            onPress={onMore}
            hitSlop={8}
            style={{
              width: 36, height: 36, borderRadius: 18,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: theme.colors.surface2,
            }}
          >
            <MoreHorizontal size={18} color={theme.colors.text} strokeWidth={1.6} />
          </Pressable>
        )}
      </View>

      {userQ.isLoading && (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      )}

      {userQ.isError && (
        <View style={styles.center}>
          <Text style={{ color: theme.colors.muted }}>{t('userDetail.loadFailed')}</Text>
        </View>
      )}

      {user && (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.profileHeader}>
            <Avatar
              name={user.nickname}
              uri={user.avatarUrl}
              avatarIdx={idxFor(userId)}
              size={92}
              shape="circle"
              showOnline={user.isOnline}
            />
            <Text style={[styles.name, { color: theme.colors.text }]}>
              {user.nickname}
              {user.age ? ` · ${user.age}` : ''}
            </Text>
            {user.countryCode && (
              <Text style={{ color: theme.colors.muted, fontSize: 13, marginTop: 4 }}>
                {user.countryCode}
              </Text>
            )}
          </View>

          {/* Public photos — horizontal strip of photos[1..] since [0] is
              already the avatar at the top. Skip rendering when only the
              avatar exists. */}
          {user.photos && user.photos.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingTop: 18, gap: 8 }}
            >
              {user.photos.slice(1).map((url) => (
                <ExpoImage
                  key={url}
                  source={{ uri: url }}
                  style={{ width: 140, height: 180, borderRadius: 14 }}
                  cachePolicy="memory-disk"
                  contentFit="cover"
                />
              ))}
            </ScrollView>
          )}

          {/* Locked photos block — only shown if owner has any. Status
              drives whether the user sees a CTA, a disabled chip, or the
              actual unlocked photos. */}
          {(user.privatePhotosCount ?? 0) > 0 && (
            <View style={{ marginTop: 22 }}>
              <Text style={[styles.section, { color: theme.colors.muted }]}>
                {t('userDetail.lockedPhotosCount', { n: user.privatePhotosCount })}
              </Text>

              {reqStatus === 'approved' ? (
                privatePhotosQ.isLoading ? (
                  <ActivityIndicator color={theme.colors.primary} />
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8 }}
                  >
                    {(privatePhotosQ.data?.photos ?? []).map((url) => (
                      <ExpoImage
                        key={url}
                        source={{ uri: url }}
                        style={{ width: 140, height: 180, borderRadius: 14 }}
                        cachePolicy="memory-disk"
                        contentFit="cover"
                      />
                    ))}
                  </ScrollView>
                )
              ) : (
                <LockedBlock
                  status={reqStatus}
                  busy={requestMut.isPending}
                  onRequest={() => requestMut.mutate()}
                />
              )}
            </View>
          )}

          {user.prompts && user.prompts.length > 0 && (
            <Card surface2 flat style={{ padding: 14, marginTop: 18 }}>
              <Text style={{ color: theme.colors.muted, fontSize: 12, marginBottom: 6 }}>
                {user.prompts[0].q}
              </Text>
              <Text
                style={{
                  fontFamily: 'Fraunces',
                  fontStyle: 'italic',
                  fontSize: 15,
                  lineHeight: 23,
                  color: theme.colors.text,
                  fontWeight: '500',
                }}
              >
                &ldquo;{user.prompts[0].a}&rdquo;
              </Text>
            </Card>
          )}

          {user.bio ? (
            <View style={{ marginTop: 22 }}>
              <Text style={[styles.section, { color: theme.colors.muted }]}>
                {t('userDetail.aboutSection')}
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 22, color: theme.colors.text2 }}>
                {user.bio}
              </Text>
            </View>
          ) : null}

          {user.interests && user.interests.length > 0 && (
            <View style={{ marginTop: 22 }}>
              <Text style={[styles.section, { color: theme.colors.muted }]}>
                {t('userDetail.interestsSection')}
              </Text>
              <View style={styles.tagsRow}>
                {(user.interests as InterestTagId[]).map((id) => {
                  const tag = tagById(id);
                  if (!tag) return null;
                  return <TagChip key={id} tag={tag} />;
                })}
              </View>
            </View>
          )}

          <Pressable onPress={onSendMessage} style={{ marginTop: 32 }}>
            {({ pressed }) => (
              <LinearGradient
                colors={[...brandGradient.colors] as [string, string, ...string[]]}
                locations={[...brandGradient.locations] as [number, number, ...number[]]}
                start={brandGradient.start}
                end={brandGradient.end}
                style={[
                  styles.sendCta,
                  pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
                ]}
              >
                <Send size={18} color="#FFFFFF" strokeWidth={2} />
                <Text style={styles.sendCtaText}>{t('userDetail.sendMessage')}</Text>
                {!isPremium && (
                  <View style={styles.proBadge}>
                    <Crown size={11} color="#FFFFFF" strokeWidth={2.2} />
                    <Text style={styles.proBadgeText}>
                      {t('userDetail.sendMessagePremiumOnly')}
                    </Text>
                  </View>
                )}
              </LinearGradient>
            )}
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/**
 * The "Request to view" surface shown when the requester is NOT yet
 * approved. Five states drive the copy/disabled-ness:
 *   none      → primary CTA
 *   pending   → disabled chip ("Request sent · pending")
 *   rejected  → disabled chip ("Try again in 7 days")
 *   revoked   → primary CTA with revoked copy ("Previously had access")
 *   expired   → backend-side state nobody currently writes; treat as none.
 */
function LockedBlock({
  status,
  busy,
  onRequest,
}: {
  status: PhotoRequestStatus | 'none';
  busy: boolean;
  onRequest: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  const isDisabled =
    status === 'pending' || status === 'rejected';
  const label =
    status === 'pending'
      ? t('userDetail.requestSent')
      : status === 'rejected'
      ? t('userDetail.requestRejected')
      : status === 'revoked'
      ? t('userDetail.requestRevoked')
      : t('userDetail.requestToView');

  return (
    <Pressable
      onPress={onRequest}
      disabled={isDisabled || busy}
      style={({ pressed }) => [
        styles.lockedCta,
        {
          backgroundColor: isDisabled ? theme.colors.surface2 : theme.colors.primarySoft,
          borderColor: theme.colors.line,
          opacity: pressed || busy ? 0.7 : 1,
        },
      ]}
    >
      <Lock
        size={18}
        color={isDisabled ? theme.colors.muted : theme.colors.primaryDeep}
        strokeWidth={1.8}
      />
      <Text
        style={{
          fontSize: 14,
          fontWeight: '600',
          color: isDisabled ? theme.colors.muted : theme.colors.primaryDeep,
        }}
      >
        {label}
      </Text>
      {busy && <ActivityIndicator size="small" color={theme.colors.primaryDeep} />}
    </Pressable>
  );
}

/** Deterministic avatar gradient index based on userId — same algorithm
 *  the discover cards use so the same user gets the same color
 *  everywhere. Lifted from chats/ChatDetailScreen so it stays consistent. */
function idxFor(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHeader: {
    alignItems: 'center',
    paddingTop: 12,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 14,
  },
  section: {
    fontSize: 12,
    letterSpacing: 0.72,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  sendCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 18,
    elevation: 6,
    shadowColor: '#4F8FE8',
    shadowOpacity: 0.32,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
  },
  sendCtaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  proBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  lockedCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
