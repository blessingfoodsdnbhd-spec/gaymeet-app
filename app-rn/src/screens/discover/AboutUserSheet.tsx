import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Heart, MessageCircle, MoreHorizontal, Share2, StickyNote, UserPlus, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { GestureDetector, type PanGesture } from 'react-native-gesture-handler';
import { Sheet } from '../../components/Sheet';
import { navigateAfterSheetClose } from '../../utils/keyboardSheet';
import { NameWithBadge } from '../../components/NameWithBadge';
import { Avatar } from '../../components/Avatar';
import { LockedPhotosBlock } from '../../components/LockedPhotosBlock';
import { PRIVATE_PHOTOS_ENABLED } from '../../config/featureFlags';
import { PhotoViewer } from '../../components/PhotoViewer';
import { TagChip } from '../../components/TagChip';
import { ProfileStatsText } from '../../components/ProfileStatsText';
import { Card } from '../../components/Card';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuth } from '../../store/auth';
import { brandGradient } from '../../theme/tokens';
import { tagById, type InterestTagId } from '../../data/interestTags';
import { isFollowing as fetchIsFollowing, toggleFollow } from '../../api/follows';
import { openConversation, getMatchStatus } from '../../api/chats';
import { getMe, logProfileView } from '../../api/me';
import {
  getPrivatePhotos,
  getSent,
  requestPrivatePhotos,
  type PhotoRequestStatus,
} from '../../api/privatePhotos';
import type { DiscoverCardUser } from '../../api/discover';
import type { RootStackParamList } from '../../navigation/types';
import { showSafetyMenu } from '../../utils/safetyMenu';
import { shareProfile } from '../../utils/shareProfile';
import { SendNoteSheet } from './SendNoteSheet';
import { VoicePlayButton } from '../../components/VoicePlayButton';
import { useDiscoverPrefs } from '../../store/discoverPrefs';
import { computeAge } from '../../utils/zodiac';
import { presenceFrom } from '../../utils/lastActive';
import { FollowBadge } from '../../components/FollowBadge';
import { PopularityBadge } from '../../components/PopularityBadge';

interface Props {
  open: boolean;
  user: DiscoverCardUser | null;
  onClose: () => void;
  onLike: () => void;
}

export function AboutUserSheet({ open, user, onClose, onLike }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<NavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const me = useAuth((s) => s.user);
  const setMe = useAuth((s) => s.setUser);

  // Refetch self every time the sheet opens. The Premium gate was rendering
  // off the cached auth.user, which can lag behind reality if the user
  // upgraded on another device or the boot-time getMe() hadn't fired by the
  // time they opened a sheet. We also fall back to vipLevel>0 as a belt
  // for any edge where toPublicJSON's isPremium derivation differs from the
  // VIP-tier truth (premium expiry vs vip expiry, etc.).
  const meQ = useQuery({
    queryKey: ['user', 'me-self'],
    queryFn: getMe,
    enabled: open,
    staleTime: 60_000,
  });
  React.useEffect(() => {
    if (meQ.data) setMe(meQ.data);
  }, [meQ.data, setMe]);
  const meFresh: any = meQ.data ?? me;
  const isPremium = !!(meFresh?.isPremium || (meFresh?.vipLevel ?? 0) > 0);

  // Local "I just liked this person" flag so the button greys immediately.
  // The backend swipe is idempotent (findOneAndUpdate upsert), so even if
  // the user re-opens the sheet a moment later we don't accidentally
  // double-swipe — but `liked` is reset on each open to keep state honest
  // across different target users.
  const [liked, setLiked] = useState(false);

  // null = viewer closed; number = open at that photo index. Two viewers
  // — one for the public gallery, one for the unlocked private photos.
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [privateViewerIndex, setPrivateViewerIndex] = useState<number | null>(null);
  // Active page of the top photo carousel (for the dot indicators).
  const [page, setPage] = useState(0);
  // 小纸条 composer open state (anonymous note to this user).
  const [noteOpen, setNoteOpen] = useState(false);
  // Voice-intro playing state (drives the "正在播放介绍" badge).
  const [voicePlaying, setVoicePlaying] = useState(false);
  const introVoice = useDiscoverPrefs((s) => s.introVoice);

  const { width: screenW, height: screenH } = useWindowDimensions();

  // Backend nearby/discover endpoints already include user.photos via
  // toPublicJSON — no extra fetch needed. Cap at 5 so the gallery stays
  // within the same product limit enforced on upload (Phase 1 backend).
  const galleryPhotos = (user?.photos ?? []).slice(0, 5);
  // Photos for the top carousel: public gallery, falling back to the avatar so
  // there's always something full-bleed at the top.
  const carouselPhotos =
    galleryPhotos.length > 0
      ? galleryPhotos
      : user?.avatarUrl
        ? [user.avatarUrl]
        : [];

  // Self-guard: hide the entire locked-photos block when the target is
  // the current user. The Nearby grid prepends self, and we'd otherwise
  // render a "Request to view" CTA pointing at the user's own photos.
  const isSelf = !!user && !!meFresh?.id && user.id === meFresh.id;
  // PRIVATE_PHOTOS_ENABLED off (Apple 4.3(b) strip) → the entire locked-photos
  // block + request flow + its queries are skipped. Public photos are unaffected.
  const hasPrivate =
    PRIVATE_PHOTOS_ENABLED && !isSelf && (user?.privatePhotosCount ?? 0) > 0;

  // Reset local liked flag when the target user changes.
  React.useEffect(() => {
    setLiked(false);
    setPrivateViewerIndex(null);
    setViewerIndex(null);
    setPage(0);
  }, [user?.id]);

  // "谁在看你": log a profile view when the sheet opens for someone else.
  // Fire-and-forget — the backend skips self and de-dups per viewer→viewed.
  React.useEffect(() => {
    if (open && user?.id && !isSelf) logProfileView(user.id);
  }, [open, user?.id, isSelf]);

  // Private-photo request status — lifted from UserDetailScreen. We use
  // getSent() rather than getPrivatePhotos() for the gating because the
  // latter collapses rejected/revoked/none into a single 'none' status,
  // so we can't render distinct CTAs without the granular row.
  const sentQ = useQuery({
    queryKey: ['photoRequests', 'sent'],
    queryFn: getSent,
    enabled: open && hasPrivate,
    staleTime: 30_000,
  });
  const myReqForUser = (sentQ.data?.requests ?? [])
    .filter((r) => r.owner)
    .find((r) => r.owner!._id === user?.id);
  const reqStatus: PhotoRequestStatus | 'none' = myReqForUser?.status ?? 'none';

  // Pull the actual photo URLs only after approval. Same shape as
  // UserDetailScreen — keys by userId so switching targets refetches.
  const privatePhotosQ = useQuery({
    queryKey: ['user', user?.id, 'privatePhotos'],
    queryFn: () => getPrivatePhotos(user!.id),
    enabled: open && hasPrivate && reqStatus === 'approved',
    staleTime: 60_000,
  });
  const unlockedPhotos = privatePhotosQ.data?.photos ?? [];

  const requestMut = useMutation({
    mutationFn: () => requestPrivatePhotos(user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photoRequests', 'sent'] });
      Alert.alert(t('userDetail.requestSentToast'));
    },
    onError: (e: any) => {
      const detail = e?.response?.data?.error || e?.message || '';
      Alert.alert(t('userDetail.requestFailed'), detail);
    },
  });

  // Follow-state query. Only enabled while the sheet is open and we have
  // a target — avoids speculative requests while the parent component is
  // mounted but the sheet is dismissed.
  const followQ = useQuery({
    queryKey: ['follow', user?.id],
    queryFn: () => fetchIsFollowing(user!.id),
    enabled: open && !!user,
    staleTime: 30_000,
  });
  const isAlreadyFollowing = !!followQ.data?.following;

  // Whether I'm already matched (同频) with this user. Refetches on each open
  // (no staleTime) so the button reflects a match created moments ago and
  // stays "已同频" across re-opens (HHHH).
  const matchQ = useQuery({
    queryKey: ['match', user?.id],
    queryFn: () => getMatchStatus(user!.id),
    enabled: open && !!user && !isSelf,
  });
  const isMatched = !!matchQ.data?.matched;

  const onOpenMatchChat = () => {
    const mid = matchQ.data?.matchId;
    if (mid) {
      // Defer the push past the Sheet's Android Dialog teardown (else dropped on
      // Android until tapped several times). See navigateAfterSheetClose.
      navigateAfterSheetClose(onClose, () => nav.navigate('ChatDetail', { chatId: mid }));
    } else {
      onMessage(); // fallback: resolve/open the conversation
    }
  };

  const followMut = useMutation({
    mutationFn: () => toggleFollow(user!.id),
    // Optimistic: flip the button to "已关注" the instant it's tapped instead of
    // after the ~round-trip (which felt broken — users thought the tap missed).
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['follow', user?.id] });
      const prev = queryClient.getQueryData<{ following: boolean }>(['follow', user?.id]);
      // Flip to the opposite of the current state (toggleFollow toggles server-
      // side) so the button updates instantly for BOTH follow and unfollow.
      queryClient.setQueryData(['follow', user?.id], { following: !prev?.following });
      return { prev };
    },
    onSuccess: (data) => {
      // Reconcile with the server's authoritative result.
      queryClient.setQueryData(['follow', user?.id], data);
      // The friends list ('following list') count changed — refetch so
      // ProfileScreen stats stay in sync.
      queryClient.invalidateQueries({ queryKey: ['me', 'stats'] });
    },
    onError: (e: any, _vars, ctx: { prev: unknown } | undefined) => {
      // Revert the optimistic flip, then surface the failure.
      if (ctx && ctx.prev !== undefined) {
        queryClient.setQueryData(['follow', user?.id], ctx.prev);
      }
      const detail = e?.response?.data?.error || e?.message || '';
      Alert.alert(t('about.followFailed'), detail);
    },
  });

  const onFollow = () => {
    if (!user || followMut.isPending) return;
    // Already following → confirm before unfollowing; otherwise follow directly.
    if (isAlreadyFollowing) {
      Alert.alert(t('about.unfollowConfirm'), '', [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('about.unfollowAction'),
          style: 'destructive',
          onPress: () => followMut.mutate(),
        },
      ]);
      return;
    }
    followMut.mutate();
  };

  const onMessage = async () => {
    if (!user) return;
    try {
      const res = await openConversation(user.id);
      queryClient.invalidateQueries({ queryKey: ['chats', 'list'] });
      navigateAfterSheetClose(onClose, () => nav.navigate('ChatDetail', { chatId: res.matchId }));
    } catch (e: any) {
      const status = e?.response?.status;
      const body = e?.response?.data;
      if (status === 402 && body?.reason === 'premium_required') {
        navigateAfterSheetClose(onClose, () => nav.navigate('Premium'));
      } else {
        Alert.alert(
          t('about.messageFailed'),
          body?.error || e?.message || '',
        );
      }
    }
  };

  const onMore = () => {
    if (!user) return;
    const userId = user.id;
    const userName = user.nickname;
    if (Platform.OS === 'android') {
      // Android: the SafetyMenuSheet is a <Modal>, and opening a second Modal
      // while this Sheet's Modal is up stacks it BEHIND (RN nested-Modal
      // limitation) — the user would see nothing. So dismiss the sheet first,
      // then open the menu after its slide-out (~220ms).
      onClose();
      setTimeout(() => showSafetyMenu({ userId, userName, nav }), 250);
    } else {
      // iOS: ActionSheetIOS renders natively ABOVE any Modal, so keep the
      // sheet open — the menu appears over it (the previous code closed the
      // sheet here unnecessarily, kicking the user back to the grid).
      showSafetyMenu({ userId, userName, nav });
    }
  };

  // Carousel ~half the screen; the scroll region is bounded to a definite
  // pixel height (the Sheet card is position:absolute + maxHeight only, so a
  // flex:1 ScrollView wouldn't get a scroll viewport — same constraint the
  // FiltersSheet fix handles). Reserve room for the sticky action footer.
  const carouselH = Math.round(screenH * 0.5);
  const scrollMaxH = screenH * 0.95 - (isSelf ? 84 : 150);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      maxHeight="95%"
      overlay={
        <>
          <PhotoViewer
            open={viewerIndex !== null}
            photos={galleryPhotos}
            initialIndex={viewerIndex ?? 0}
            onClose={() => setViewerIndex(null)}
          />
          <PhotoViewer
            open={privateViewerIndex !== null}
            photos={unlockedPhotos}
            initialIndex={privateViewerIndex ?? 0}
            onClose={() => setPrivateViewerIndex(null)}
          />
          <SendNoteSheet
            open={noteOpen}
            recipient={user ? { id: user.id, nickname: user.nickname, avatarUrl: user.avatarUrl, isOfficial: user.isOfficial, isVerified: user.isVerified, isPremium: user.isPremium } : null}
            onClose={() => setNoteOpen(false)}
          />
        </>
      }
    >
      {(dragArea: PanGesture) => user ? (
        <View style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          style={{ maxHeight: scrollMaxH, marginHorizontal: -20, marginTop: -6 }}
        >
          {/* Full-bleed photo carousel — paged, tap any photo to zoom. Wrapped
              in a GestureDetector so a downward drag here dismisses the sheet
              (the big area users instinctively grab); activeOffsetY/failOffsetX
              keep tap-to-zoom and horizontal paging working. */}
          <GestureDetector gesture={dragArea}>
          <View style={{ width: screenW, height: carouselH, backgroundColor: theme.colors.surface2 }}>
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
                    onPress={() => setViewerIndex(idx)}
                    style={{ width: screenW, height: carouselH }}
                  >
                    <ExpoImage
                      source={{ uri: url }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      // VVVVV/MMMM — full-res decode so the large carousel never
                      // reuses the grid-sized decode of this same url (→ 格子).
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
                  avatarIdx={user.avatarIdx}
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

            <Pressable onPress={onClose} hitSlop={8} style={[styles.overlayBtn, { right: 14 }]}>
              <X size={20} color="#FFFFFF" strokeWidth={2} />
            </Pressable>
            <Pressable
              onPress={() => user && shareProfile(user.id, user.nickname, t)}
              hitSlop={8}
              style={[styles.overlayBtn, { right: 58 }]}
            >
              <Share2 size={18} color="#FFFFFF" strokeWidth={2} />
            </Pressable>
            {!isSelf && (
              <Pressable
                onPress={() => setNoteOpen(true)}
                hitSlop={8}
                style={[styles.overlayBtn, { right: 102 }]}
              >
                <StickyNote size={18} color="#FFFFFF" strokeWidth={2} />
              </Pressable>
            )}
            {!isSelf && (
              <Pressable onPress={onMore} hitSlop={8} style={[styles.overlayBtn, { left: 14 }]}>
                <MoreHorizontal size={20} color="#FFFFFF" strokeWidth={2} />
              </Pressable>
            )}
          </View>
          </GestureDetector>

          {/* Details */}
          <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <NameWithBadge
                name={`${user.nickname}${(() => {
                  const a = computeAge(user.dob) ?? user.age;
                  return a != null ? ` · ${a}` : '';
                })()}`}
                official={user.isOfficial}
                verified={user.isVerified}
                premium={user.isPremium}
                textStyle={[styles.nameBig, { color: theme.colors.text }]}
                badgeSize={18}
              />
              <FollowBadge status={user.followStatus} size={18} />
              <PopularityBadge value={(user as any).popularity} />
              {/* Voice intro — always tappable; auto-plays once on open when the
                  Nearby "介绍声音" toggle is on. Not for own profile. */}
              {!isSelf && !!user.voiceIntroUrl && (
                <VoicePlayButton
                  key={`${user.id}-${open ? 'o' : 'c'}`}
                  url={user.voiceIntroUrl}
                  size={20}
                  autoPlay={open && introVoice}
                  onPlayingChange={setVoicePlaying}
                />
              )}
              {voicePlaying && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: theme.colors.primarySoft }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.primary }} />
                  <Text style={{ fontSize: 11.5, color: theme.colors.primaryDeep, fontWeight: '700' }}>
                    {t('about.playingIntro')}
                  </Text>
                </View>
              )}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6 }}>
              {(() => {
                const p = presenceFrom(t, user.lastActiveAt, user.isOnline);
                if (!p) return null;
                return (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {p.online && (
                      <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: theme.colors.online }} />
                    )}
                    <Text style={{ fontSize: 13, color: p.online ? theme.colors.online : theme.colors.muted }}>
                      {p.text}
                    </Text>
                  </View>
                );
              })()}
              {!!user.distance && (
                <Text style={{ fontSize: 13, color: theme.colors.muted }}>{user.distance}</Text>
              )}
            </View>

          {/* Factual attributes as one plain bullet-separated line (was a grid
              of rounded "stats pills"). Interests stay as chips below. */}
          <ProfileStatsText user={user} style={{ marginTop: 12 }} />

          {user.bio && (
            <View style={{ marginTop: 18 }}>
              <Text style={[styles.section, { color: theme.colors.muted }]}>{t('about.section')}</Text>
              <Text style={{ fontSize: 14, lineHeight: 22, color: theme.colors.text2 }}>
                {user.bio}
              </Text>
            </View>
          )}

          {/* Q&A prompts — render ALL of them (was previously only prompts[0]),
              each as a card with the question label above the answer, matching
              the prompts editor. */}
          {(() => {
            const prompts = (user.prompts ?? []).filter((p) => p.q && p.a);
            if (prompts.length === 0) return null;
            return (
              <View style={{ marginTop: 18 }}>
                <Text style={[styles.section, { color: theme.colors.muted }]}>
                  {t('about.promptsSection')}
                </Text>
                <View style={{ gap: 8 }}>
                  {prompts.map((p, i) => (
                    <Card key={i} surface2 flat style={{ padding: 14 }}>
                      <Text style={{ color: theme.colors.muted, fontSize: 12, marginBottom: 6 }}>
                        {p.q}
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
                        &ldquo;{p.a}&rdquo;
                      </Text>
                    </Card>
                  ))}
                </View>
              </View>
            );
          })()}

          {/* Private-photo locked block — only rendered when the target
              actually has private photos AND we're not viewing ourselves.
              Five-state UI lives in the shared LockedPhotosBlock; the
              approved branch renders the unlocked photos inline as a
              horizontal scroll that opens the PhotoViewer on tap. */}
          {hasPrivate && (
            <View style={{ marginTop: 18 }}>
              <Text style={[styles.section, { color: theme.colors.muted }]}>
                {t('userDetail.lockedPhotosCount', { n: user.privatePhotosCount })}
              </Text>
              {reqStatus === 'approved' ? (
                privatePhotosQ.isLoading ? (
                  <View style={{ paddingVertical: 12 }}>
                    {/* Lightweight spinner — same theme color as elsewhere */}
                    <Text style={{ color: theme.colors.muted, fontSize: 13 }}>…</Text>
                  </View>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8 }}
                  >
                    {unlockedPhotos.map((url, idx) => (
                      <Pressable
                        key={`pp-${idx}-${url}`}
                        onPress={() => setPrivateViewerIndex(idx)}
                      >
                        <ExpoImage
                          source={{ uri: url }}
                          style={{ width: 96, height: 96, borderRadius: 12 }}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                        />
                      </Pressable>
                    ))}
                  </ScrollView>
                )
              ) : (
                <LockedPhotosBlock
                  status={reqStatus}
                  busy={requestMut.isPending}
                  onRequest={() => requestMut.mutate()}
                />
              )}
            </View>
          )}

          <View style={{ marginTop: 18 }}>
            <Text style={[styles.section, { color: theme.colors.muted }]}>
              {t('about.interestsCount', { n: (user.sharedTags ?? []).length })}
            </Text>
            <View style={styles.tagsRow}>
              {((user.interests ?? []) as InterestTagId[]).map((id) => {
                const tag = tagById(id);
                if (!tag) return null;
                return (
                  <TagChip
                    key={id}
                    tag={tag}
                    shared={(user.sharedTags ?? []).includes(id)}
                  />
                );
              })}
            </View>
            {(user.mobileGames ?? []).length > 0 && (
              <Text style={{ fontSize: 13, color: theme.colors.text2, marginTop: 10 }}>
                🎮 {t('about.gamesPlays')}: {(user.mobileGames ?? []).slice(0, 5).join('、')}
                {(user.mobileGames ?? []).length > 5
                  ? ` +${(user.mobileGames ?? []).length - 5}`
                  : ''}
              </Text>
            )}
          </View>

            <View style={{ height: 16 }} />
          </View>
        </ScrollView>

        {/* Sticky action footer — Follow / Like / Message (Premium only). */}
        {!isSelf && (
          <View style={styles.footer}>
            <SecondaryAction
              icon={<UserPlus size={18} color={theme.colors.primaryDeep} strokeWidth={2} />}
              label={isAlreadyFollowing ? t('about.following') : t('about.follow')}
              done={isAlreadyFollowing}
              pressableWhenDone
              busy={followMut.isPending || followQ.isLoading}
              onPress={onFollow}
            />
            {isMatched ? (
              // Already 同频 — solid pink (vs the gradient Like) + tap → chat.
              <MatchedAction label={t('about.matched')} onPress={onOpenMatchChat} />
            ) : (
              <PrimaryLikeAction
                label={
                  liked
                    ? t('about.liked')
                    : user.likedByThem
                      ? t('about.becomeMatch')
                      : t('about.like')
                }
                done={liked}
                onPress={() => {
                  if (liked) return;
                  setLiked(true);
                  onLike();
                }}
              />
            )}
            {isPremium && (
              <SecondaryAction
                icon={<MessageCircle size={18} color={theme.colors.primaryDeep} strokeWidth={2} />}
                label={t('about.message')}
                done={false}
                busy={false}
                onPress={onMessage}
              />
            )}
          </View>
        )}
        </View>
      ) : null}

    </Sheet>
  );
}

function SecondaryAction({
  icon,
  label,
  done,
  busy,
  onPress,
  pressableWhenDone = false,
}: {
  icon: React.ReactNode;
  label: string;
  done: boolean;
  busy: boolean;
  onPress: () => void;
  /** Keep the button tappable even in the "done" state — used by Follow so the
   *  "已关注" state can be tapped to unfollow (Like stays one-way disabled). */
  pressableWhenDone?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={(done && !pressableWhenDone) || busy}
      style={({ pressed }) => [
        styles.secondaryBtn,
        {
          backgroundColor: done ? theme.colors.surface2 : theme.colors.primarySoft,
          opacity: pressed || busy ? 0.7 : 1,
        },
      ]}
    >
      {icon}
      <Text
        numberOfLines={1}
        style={{
          color: done ? theme.colors.muted : theme.colors.primaryDeep,
          fontSize: 13,
          fontWeight: '600',
          marginTop: 6,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** "已同频" — solid-pink primary action (distinct from the gradient Like and the
 *  greyed one-way "已喜欢"), tappable to open the existing chat (HHHH). */
function MatchedAction({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryBtn,
        { opacity: pressed ? 0.88 : 1, transform: pressed ? [{ scale: 0.98 }] : [] },
      ]}
    >
      <View style={[styles.primaryInner, { backgroundColor: theme.colors.primary }]}>
        <Heart size={18} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2} />
        <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700', marginTop: 6 }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function PrimaryLikeAction({
  label,
  done,
  onPress,
}: {
  label: string;
  done: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={done}
      style={({ pressed }) => [
        styles.primaryBtn,
        { opacity: pressed ? 0.88 : 1, transform: pressed ? [{ scale: 0.98 }] : [] },
      ]}
    >
      {done ? (
        <View
          style={[
            styles.primaryInner,
            { backgroundColor: theme.colors.surface2 },
          ]}
        >
          <Heart
            size={18}
            color={theme.colors.muted}
            fill={theme.colors.muted}
            strokeWidth={2}
          />
          <Text
            numberOfLines={1}
            style={{
              color: theme.colors.muted,
              fontSize: 13,
              fontWeight: '700',
              marginTop: 6,
            }}
          >
            {label}
          </Text>
        </View>
      ) : (
        <LinearGradient
          colors={[...brandGradient.colors] as [string, string, ...string[]]}
          locations={[...brandGradient.locations] as [number, number, ...number[]]}
          start={brandGradient.start}
          end={brandGradient.end}
          style={styles.primaryInner}
        >
          <Heart size={18} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2} />
          <Text
            numberOfLines={1}
            style={{
              color: '#FFFFFF',
              fontSize: 13,
              fontWeight: '700',
              marginTop: 6,
            }}
          >
            {label}
          </Text>
        </LinearGradient>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  name: { fontSize: 18, fontWeight: '700' },
  nameBig: { fontSize: 24, fontWeight: '700', letterSpacing: -0.4 },
  dots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  overlayBtn: {
    position: 'absolute',
    top: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    paddingBottom: 4,
  },
  section: {
    fontSize: 12,
    letterSpacing: 0.72,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  actionRow: { flexDirection: 'row', gap: 8 },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    flex: 1.2,
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#4F8FE8',
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  primaryInner: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
});
