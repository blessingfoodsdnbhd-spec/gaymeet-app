import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Crown, Eye, MoreHorizontal, Send, StickyNote, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useTheme } from '../../theme/ThemeProvider';
import { VerifiedBadge, PhotoVerifiedBadge } from '../../components/NameWithBadge';
import { PopularityBadge } from '../../components/PopularityBadge';
import { PremiumBadge } from '../../components/PremiumBadge';
import { LevelProgress } from '../../components/UserLevelBadge';
import { getUserLevel } from '../../api/plaza';
import { Avatar } from '../../components/Avatar';
import { VoicePlayButton } from '../../components/VoicePlayButton';
import { useDiscoverPrefs } from '../../store/discoverPrefs';
import { usePhotoViewer } from '../../components/usePhotoViewer';
import { LockedPhotosBlock } from '../../components/LockedPhotosBlock';
import { HighlightsSection } from '../votes/HighlightsSection';
import { TagChip } from '../../components/TagChip';
import { ProfileStatsText } from '../../components/ProfileStatsText';
import { Card } from '../../components/Card';
import { tagById, type InterestTagId } from '../../data/interestTags';
import { getUserById } from '../../api/me';
import { computeAge, computeZodiac } from '../../utils/zodiac';
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
import { SendNoteSheet } from '../discover/SendNoteSheet';
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
  const { userId, previewMode = false } = route.params;
  const photoViewer = usePhotoViewer();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const carouselH = Math.round(screenH * 0.5);
  const [page, setPage] = React.useState(0);
  const introVoice = useDiscoverPrefs((s) => s.introVoice);
  // 小纸条 (anonymous note) composer — hidden on your own profile.
  const [noteOpen, setNoteOpen] = React.useState(false);
  const myId = String((me as any)?.id ?? (me as any)?._id ?? '');
  const isSelf = !!myId && myId === String(userId);

  const userQ = useQuery({
    queryKey: ['user', userId],
    queryFn: () => getUserById(userId),
    staleTime: 60_000,
  });

  const user = userQ.data;

  // Chat-XP level + progress (吹水等级) — shown under the name in the header.
  const levelQ = useQuery({
    queryKey: ['user', userId, 'level'],
    queryFn: () => getUserLevel(userId),
    staleTime: 60_000,
  });

  // Top carousel photos — all public photos, falling back to the avatar.
  const carouselPhotos: string[] = user
    ? (user.photos && user.photos.length > 0
        ? user.photos
        : (user.avatarUrl ? [user.avatarUrl] : []))
    : [];

  const onMore = () => {
    if (!user) return;
    showSafetyMenu({
      userId,
      userName: user.nickname,
      nav,
      // Coming from outside a chat context — no unmatch action.
      includeUnmatch: false,
      // Surface invalidation is centralized in showSafetyMenu; here we just
      // leave the now-blocked profile (the next fetch would 404 BLOCKED anyway).
      onBlocked: () => nav.goBack(),
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
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['bottom']}>
      {/* Floating back button — always available, incl. while loading. */}
      <Pressable
        onPress={() => nav.goBack()}
        hitSlop={8}
        style={[styles.floatBtn, { top: insets.top + 8, left: 14 }]}
      >
        <ChevronLeft size={22} color="#FFFFFF" strokeWidth={2.2} />
      </Pressable>

      {userQ.isLoading && (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      )}

      {userQ.isError && (
        <View style={styles.center}>
          <Text style={{ color: theme.colors.muted }}>
            {/* 403/404 → the user is blocked or gone: show "用户不可用".
                Other errors (network/5xx) keep the generic load-failed copy. */}
            {[403, 404].includes((userQ.error as any)?.response?.status)
              ? t('userDetail.userUnavailable')
              : t('userDetail.loadFailed')}
          </Text>
        </View>
      )}

      {user && (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Self-preview banner — informational, shown only when arriving via
              the 我-tab "preview as others see me" entry. */}
          {previewMode && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                marginTop: insets.top + 8,
                marginBottom: 4,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: theme.radius.m,
                backgroundColor: theme.colors.primarySoft,
              }}
            >
              <Eye size={16} color={theme.colors.primaryDeep} strokeWidth={2} />
              <Text style={{ flex: 1, color: theme.colors.primaryDeep, fontSize: 13, fontWeight: '600' }}>
                {t('profile.previewBanner')}
              </Text>
            </View>
          )}
          {/* Full-bleed photo carousel — replaces the small round avatar.
              Paged, swipeable through all photos; tap to open the zoom viewer. */}
          <View
            style={{
              width: screenW,
              height: carouselH,
              marginHorizontal: -20,
              backgroundColor: theme.colors.surface2,
            }}
          >
            {carouselPhotos.length > 0 ? (
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) =>
                  setPage(Math.round(e.nativeEvent.contentOffset.x / screenW))
                }
              >
                {carouselPhotos.map((url, idx) => (
                  <Pressable
                    key={`c-${idx}-${url}`}
                    onPress={() => photoViewer.open(carouselPhotos, idx)}
                    style={{ width: screenW, height: carouselH }}
                  >
                    <ExpoImage
                      source={{ uri: url }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      // VVVVV/MMMM — full-res decode. This gallery url is also
                      // rendered small elsewhere (discover/nearby grids); without
                      // this the large carousel reuses that grid-sized decode → 格子.
                      allowDownscaling={false}
                      priority="high"
                    />
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                <Avatar
                  name={user.nickname}
                  uri={user.avatarUrl}
                  avatarIdx={idxFor(userId)}
                  size={120}
                  shape="circle"
                />
              </View>
            )}

            {carouselPhotos.length > 1 && (
              <View style={styles.dots} pointerEvents="none">
                {carouselPhotos.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      { backgroundColor: i === page ? '#FFFFFF' : 'rgba(255,255,255,0.5)' },
                    ]}
                  />
                ))}
              </View>
            )}

            {/* Voice intro — auto-plays once on open when the pref is on. */}
            {!!user.voiceIntroUrl && (
              <View style={styles.voiceBtn}>
                <VoicePlayButton url={user.voiceIntroUrl} autoPlay={introVoice} size={20} color="#FFFFFF" />
              </View>
            )}

            {/* 小纸条 — anonymous note (PR J), mirrors AboutUserSheet.
                Hidden on own profile and in self-preview (can't note yourself). */}
            {!isSelf && !previewMode && (
              <Pressable
                onPress={() => setNoteOpen(true)}
                hitSlop={8}
                style={[styles.floatBtn, { top: insets.top + 8, right: 58 }]}
              >
                <StickyNote size={18} color="#FFFFFF" strokeWidth={2} />
              </Pressable>
            )}

            {/* Safety menu (report/block) — meaningless in self-preview. */}
            {!previewMode && (
              <Pressable onPress={onMore} hitSlop={8} style={[styles.floatBtn, { top: insets.top + 8, right: 14 }]}>
                <MoreHorizontal size={20} color="#FFFFFF" strokeWidth={2} />
              </Pressable>
            )}
          </View>

          {/* Name + age + zodiac + country, below the photo. */}
          <View style={{ paddingTop: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={[styles.name, { color: theme.colors.text, marginTop: 0 }]}>
                {user.nickname}
                {(() => {
                  const a = computeAge(user.dob) ?? user.age;
                  if (a == null) return '';
                  const z = computeZodiac(user.dob);
                  return ` · ${a}${z ? ` ${z.emoji}` : ''}`;
                })()}
              </Text>
              {(user as any).isOfficial ? (
                <VerifiedBadge size={16} />
              ) : (user as any).isVerified ? (
                <PhotoVerifiedBadge size={16} />
              ) : null}
              <PopularityBadge value={(user as any).popularity} size="md" />
              <PremiumBadge isPremium={(user as any).isPremium} size={18} />
            </View>
            {user.countryCode && (
              <Text style={{ color: theme.colors.muted, fontSize: 13, marginTop: 4 }}>
                {user.countryCode}
              </Text>
            )}
            {/* Chat-XP level (吹水等级) + progress toward the next tier. */}
            {levelQ.data && (
              <View style={{ marginTop: 12 }}>
                <LevelProgress {...levelQ.data} />
              </View>
            )}
            {/* Factual attributes (height/weight/body/relationship/mbti/intent/
                city) as one plain bullet-separated line. Interests stay chips. */}
            <ProfileStatsText user={user} style={{ marginTop: 8 }} />
          </View>

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
                    {(privatePhotosQ.data?.photos ?? []).map((url, i) => (
                      <Pressable
                        key={url}
                        onPress={() => photoViewer.open(privatePhotosQ.data?.photos ?? [], i)}
                      >
                        <ExpoImage
                          source={{ uri: url }}
                          style={{ width: 140, height: 180, borderRadius: 14 }}
                          cachePolicy="memory-disk"
                          contentFit="cover"
                        />
                      </Pressable>
                    ))}
                  </ScrollView>
                )
              ) : (
                <LockedPhotosBlock
                  status={reqStatus}
                  busy={!previewMode && requestMut.isPending}
                  onRequest={() => requestMut.mutate()}
                  disabled={previewMode}
                />
              )}
            </View>
          )}

          {/* 高光时刻 — contest placements (renders nothing if none). */}
          <View style={{ marginTop: 18 }}>
            <HighlightsSection userId={userId} />
          </View>

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

          {/* Send-message CTA hidden in self-preview (can't DM yourself). */}
          {!previewMode && (
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
          )}
        </ScrollView>
      )}
      {photoViewer.node}
      <SendNoteSheet
        open={noteOpen}
        recipient={user ? { id: userId, nickname: user.nickname, avatarUrl: user.avatarUrl } : null}
        onClose={() => setNoteOpen(false)}
      />
    </SafeAreaView>
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
  // Circular translucent overlay button (back / more) on the photo carousel.
  floatBtn: {
    position: 'absolute',
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  voiceBtn: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  dots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
});
