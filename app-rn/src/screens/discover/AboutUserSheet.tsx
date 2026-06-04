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
import { Heart, MessageCircle, MoreHorizontal, UserPlus, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Sheet } from '../../components/Sheet';
import { Avatar } from '../../components/Avatar';
import { LockedPhotosBlock } from '../../components/LockedPhotosBlock';
import { PhotoViewer } from '../../components/PhotoViewer';
import { TagChip } from '../../components/TagChip';
import { Card } from '../../components/Card';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuth } from '../../store/auth';
import { brandGradient } from '../../theme/tokens';
import { tagById, type InterestTagId } from '../../data/interestTags';
import { isFollowing as fetchIsFollowing, toggleFollow } from '../../api/follows';
import { openConversation } from '../../api/chats';
import { getMe } from '../../api/me';
import {
  getPrivatePhotos,
  getSent,
  requestPrivatePhotos,
  type PhotoRequestStatus,
} from '../../api/privatePhotos';
import type { DiscoverCardUser } from '../../api/discover';
import type { RootStackParamList } from '../../navigation/types';
import { showSafetyMenu } from '../../utils/safetyMenu';
import { computeAge, computeZodiac, zodiacLabel } from '../../utils/zodiac';
import { presenceFrom } from '../../utils/lastActive';
import { FollowBadge } from '../../components/FollowBadge';

interface Props {
  open: boolean;
  user: DiscoverCardUser | null;
  onClose: () => void;
  onLike: () => void;
}

export function AboutUserSheet({ open, user, onClose, onLike }: Props) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
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
  const hasPrivate = !isSelf && (user?.privatePhotosCount ?? 0) > 0;

  // Reset local liked flag when the target user changes.
  React.useEffect(() => {
    setLiked(false);
    setPrivateViewerIndex(null);
    setViewerIndex(null);
    setPage(0);
  }, [user?.id]);

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

  const followMut = useMutation({
    mutationFn: () => toggleFollow(user!.id),
    onSuccess: (data) => {
      queryClient.setQueryData(['follow', user?.id], data);
      // The friends list ('following list') count changed — refetch so
      // ProfileScreen stats stay in sync.
      queryClient.invalidateQueries({ queryKey: ['me', 'stats'] });
    },
    onError: (e: any) => {
      const detail = e?.response?.data?.error || e?.message || '';
      Alert.alert(t('about.followFailed'), detail);
    },
  });

  const onFollow = () => {
    if (!user || followMut.isPending) return;
    // Tap-to-follow only: if already following, ignore (we don't toggle off
    // from here — that's what FriendsList is for). Backend still toggles,
    // so we explicitly skip rather than firing.
    if (isAlreadyFollowing) return;
    followMut.mutate();
  };

  const onMessage = async () => {
    if (!user) return;
    try {
      const res = await openConversation(user.id);
      queryClient.invalidateQueries({ queryKey: ['chats', 'list'] });
      onClose();
      nav.navigate('ChatDetail', { chatId: res.matchId });
    } catch (e: any) {
      const status = e?.response?.status;
      const body = e?.response?.data;
      if (status === 402 && body?.reason === 'premium_required') {
        onClose();
        nav.navigate('Premium');
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
        </>
      }
    >
      {user && (
        <View style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ maxHeight: scrollMaxH, marginHorizontal: -20, marginTop: -6 }}
        >
          {/* Full-bleed photo carousel — paged, tap any photo to zoom. */}
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
            {!isSelf && (
              <Pressable onPress={onMore} hitSlop={8} style={[styles.overlayBtn, { left: 14 }]}>
                <MoreHorizontal size={20} color="#FFFFFF" strokeWidth={2} />
              </Pressable>
            )}
          </View>

          {/* Details */}
          <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={[styles.nameBig, { color: theme.colors.text }]}>
                {user.nickname}
                {(() => {
                  const a = computeAge(user.dob) ?? user.age;
                  return a != null ? ` · ${a}` : '';
                })()}
              </Text>
              <FollowBadge status={user.followStatus} size={18} />
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

          {(() => {
            // Compact stats pills — age (more prominent than the inline header
            // suffix), plus any optional body/work/location fields the user has
            // filled. Hidden entirely when nothing is set.
            const stats: string[] = [];
            // Age + zodiac. Prefer a live age from dob (always fresh); fall back
            // to the stored age for legacy users. Zodiac only when dob is set.
            const age = computeAge(user.dob) ?? user.age;
            if (age != null) {
              const z = computeZodiac(user.dob);
              stats.push(
                t('about.stats.age', { n: age }) +
                  (z ? ` · ${zodiacLabel(z, i18n.language)}` : ''),
              );
            }
            if (user.height) stats.push(`${user.height} cm`);
            if (user.weight) stats.push(`${user.weight} kg`);
            if (user.bodyType) stats.push(t(`profile.edit.bodyTypes.${user.bodyType}`));
            if (user.occupation) stats.push(user.occupation);
            if (user.city) stats.push(user.city);
            if (stats.length === 0) return null;
            return (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {stats.map((s, i) => (
                  <View
                    key={i}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: theme.radius.pill,
                      backgroundColor: theme.colors.surface2,
                    }}
                  >
                    <Text style={{ fontSize: 13, color: theme.colors.text2 }}>{s}</Text>
                  </View>
                ))}
              </View>
            );
          })()}

          {user.prompts && user.prompts.length > 0 && (
            <Card surface2 flat style={{ padding: 14, marginTop: 8 }}>
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

          {user.bio && (
            <View style={{ marginTop: 18 }}>
              <Text style={[styles.section, { color: theme.colors.muted }]}>{t('about.section')}</Text>
              <Text style={{ fontSize: 14, lineHeight: 22, color: theme.colors.text2 }}>
                {user.bio}
              </Text>
            </View>
          )}

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
              busy={followMut.isPending || followQ.isLoading}
              onPress={onFollow}
            />
            <PrimaryLikeAction
              label={liked ? t('about.liked') : t('about.like')}
              done={liked}
              onPress={() => {
                if (liked) return;
                setLiked(true);
                onLike();
              }}
            />
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
      )}

    </Sheet>
  );
}

function SecondaryAction({
  icon,
  label,
  done,
  busy,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  done: boolean;
  busy: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={done || busy}
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
