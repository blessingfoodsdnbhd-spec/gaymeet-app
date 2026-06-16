import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BadgeCheck,
  Bell,
  ChevronRight,
  Coins,
  Crown,
  Eye,
  Gift,
  ImagePlus,
  Mic,
  Pencil,
  Plus,
  Settings as SettingsIcon,
  Share2,
  Sparkles,
} from 'lucide-react-native';
import { Image as ExpoImage } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { useTheme } from '../../theme/ThemeProvider';
import { TopBar, IconButton } from '../../components/TopBar';
import { Card } from '../../components/Card';
import { TagChip } from '../../components/TagChip';
import { NameWithBadge } from '../../components/NameWithBadge';
import { PopularityBadge } from '../../components/PopularityBadge';
import { VoicePlayButton } from '../../components/VoicePlayButton';
import { usePhotoViewer } from '../../components/usePhotoViewer';
import { ProfilePhotoCarousel } from '../../components/ProfilePhotoCarousel';
import { ProfileCompletionCard, useProfileCompletion } from '../../components/ProfileCompletionCard';
import { HighlightsSection } from '../votes/HighlightsSection';
import { UpgradePremiumSheet } from '../../components/UpgradePremiumSheet';
import { shareProfile } from '../../utils/shareProfile';
import { tagById, type InterestTagId } from '../../data/interestTags';
import { PRIVATE_PHOTOS_ENABLED } from '../../config/featureFlags';
import { useAuth } from '../../store/auth';
import { getMyStats, getViewers } from '../../api/me';
import { getApprovedCount } from '../../api/privatePhotos';
import { getUnreadCount } from '../../api/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RootStackParamList } from '../../navigation/types';

type AnyNav = NativeStackNavigationProp<any>;

/**
 * Self profile (我 tab) — READ-ONLY display (EEEE). All editing moved to the
 * dedicated EditProfileScreen, reached via the "编辑资料" button. This screen
 * leads with a full-width hero (main photo / avatar), then name + completion
 * bar + tappable stats, a compact 3 × 2 public-photo grid, and read-only
 * previews of bio / interests / voice, plus the invite card and settings rows.
 * Keeping it form-free makes the most-used tab lighter and removes the
 * accidental-edit taps Wei Qian flagged.
 *
 * UserDetailScreen handles viewing OTHER people's profiles — it keeps the
 * full-width swipeable ProfilePhotoCarousel (the stranger / self-preview view).
 */
export function ProfileScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<AnyNav>();
  const { width } = useWindowDimensions();
  const user = useAuth((s) => s.user);
  const photoViewer = usePhotoViewer();

  const unreadQ = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: getUnreadCount,
    staleTime: 30_000,
    select: (d) => d.count,
  });
  const unread = unreadQ.data ?? 0;

  // One-time Premium nudge once the profile is ≥80% complete.
  const { percent: completionPct } = useProfileCompletion(user);
  const [upsellOpen, setUpsellOpen] = useState(false);
  useEffect(() => {
    if (!user || completionPct < 80 || completionPct >= 100) return;
    AsyncStorage.getItem('premium.upsell80.v1')
      .then((v) => {
        if (!v) {
          setUpsellOpen(true);
          AsyncStorage.setItem('premium.upsell80.v1', '1').catch(() => {});
        }
      })
      .catch(() => {});
  }, [completionPct, user]);

  const statsQ = useQuery({
    queryKey: ['me', 'stats'],
    queryFn: getMyStats,
    staleTime: 60_000,
    enabled: !!user,
  });
  const viewersQ = useQuery({
    queryKey: ['users', 'viewers'],
    queryFn: getViewers,
    staleTime: 60_000,
    enabled: !!user,
  });
  const approvedQ = useQuery({
    queryKey: ['photoRequests', 'approvedCount'],
    queryFn: getApprovedCount,
    enabled: !!user,
    staleTime: 30_000,
  });

  if (!user) return null;

  const interests = (user.interests ?? []) as InterestTagId[];
  const photos = user.photos ?? [];
  // Hero = all photos in a swipeable carousel, falling back to the avatar.
  // Tapping a photo opens the same fullscreen gallery the grid uses.
  const heroPhotos = photos.length > 0 ? photos : user.avatarUrl ? [user.avatarUrl] : [];
  // 3-column photo grid: 6 visible cells (3 × 2). Square tiles, 8px gutters.
  const GRID_GAP = 8;
  const GRID_SLOTS = 6;
  const tile = Math.floor((width - theme.spacing.xl * 2 - GRID_GAP * 2) / 3);
  const overflow = photos.length - GRID_SLOTS;
  const stats = statsQ.data;
  const fmt = (n: number | undefined) => (typeof n === 'number' ? n : '—');
  const official = !!(user as any).isOfficial;
  const photoVerified = !!(user as any).isVerified;

  const goEdit = () => nav.navigate('EditProfile');

  // Version label. `nativeBuildVersion` is the runtime build number, but it can
  // be null in some build contexts — fall back to the bundled app.json values
  // (iOS buildNumber / Android versionCode) so we never render a bare dash.
  const appVersion =
    Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '2.0';
  const fallbackBuild =
    Platform.OS === 'ios'
      ? Constants.expoConfig?.ios?.buildNumber
      : Constants.expoConfig?.android?.versionCode;
  const buildNumber =
    Constants.nativeBuildVersion ??
    (fallbackBuild != null ? String(fallbackBuild) : '—');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <TopBar
        title={t('tabs.profile')}
        right={
          <>
            <IconButton onPress={() => nav.navigate('NotificationCenter')}>
              <View>
                <Bell size={18} color={theme.colors.text} strokeWidth={1.6} />
                {unread > 0 && (
                  <View style={[styles.bellBadge, { backgroundColor: theme.colors.primary, borderColor: theme.colors.bg }]}>
                    <Text style={styles.bellBadgeText}>{unread > 9 ? '9+' : unread}</Text>
                  </View>
                )}
              </View>
            </IconButton>
            <IconButton onPress={() => shareProfile(user.id, user.nickname, t)}>
              <Share2 size={18} color={theme.colors.text} strokeWidth={1.6} />
            </IconButton>
            <IconButton onPress={() => nav.navigate('Settings')}>
              <SettingsIcon size={18} color={theme.colors.text} strokeWidth={1.6} />
            </IconButton>
          </>
        }
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: theme.spacing.xl, paddingBottom: 40 }}>
        {/* Hero — full-width swipeable carousel of ALL photos (falls back to the
            avatar). Breaks out of the content padding for a full-bleed banner
            under the TopBar; paged with dot indicator, tap a photo to open the
            fullscreen viewer. Shared with UserDetailScreen via ProfilePhotoCarousel. */}
        <ProfilePhotoCarousel
          photos={heroPhotos}
          width={width}
          height={width}
          onPressPhoto={(p, i) => photoViewer.open(p, i)}
          style={{ marginHorizontal: -theme.spacing.xl }}
          empty={
            <Pressable
              onPress={goEdit}
              style={{ width, height: width, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.colors.surface2 }}
            >
              <ImagePlus size={32} color={theme.colors.primary} strokeWidth={1.8} />
              <Text style={{ color: theme.colors.muted, fontSize: 13 }}>{t('profile.edit.addPhotosHint')}</Text>
            </Pressable>
          }
        />

        <View style={{ marginTop: 16 }}>
          <ProfileCompletionCard user={user} />
        </View>

        {/* Name + verified badge (read-only) + 编辑资料 button. */}
        <View style={{ alignItems: 'center', marginTop: 12, marginBottom: 6 }}>
          <NameWithBadge
            name={user.nickname}
            official={official}
            verified={photoVerified}
            premium={(user as any).isPremium}
            badgeSize={18}
            premiumSize={22}
            textStyle={{ fontSize: 22, fontWeight: '700', color: theme.colors.text }}
          />
          {(user.streak?.current ?? 0) > 0 && (
            <View
              style={{
                marginTop: 8,
                flexDirection: 'row',
                alignItems: 'center',
                alignSelf: 'center',
                paddingVertical: 4,
                paddingHorizontal: 12,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.primarySoft,
              }}
            >
              <Text style={{ fontSize: 13, color: theme.colors.primaryDeep, fontWeight: '700' }}>
                {t('profile.streak', { n: user.streak!.current })}
              </Text>
            </View>
          )}
          {((user as any).popularity ?? 0) >= 1 && (
            <View style={{ marginTop: 6 }}>
              <PopularityBadge value={(user as any).popularity} size="md" />
            </View>
          )}
          {!official && <View style={{ height: 12 }} />}
          {/* Edit + preview side by side. Preview opens your own card in stranger view. */}
          <View style={styles.actionRow}>
            <Pressable
              onPress={goEdit}
              style={({ pressed }) => [
                styles.actionBtn,
                { borderColor: theme.colors.line, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Pencil size={15} color={theme.colors.primary} strokeWidth={2} />
              <Text style={{ color: theme.colors.primary, fontSize: 14, fontWeight: '600' }}>
                {t('editProfile.title')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => nav.navigate('UserDetail', { userId: user.id, previewMode: true })}
              style={({ pressed }) => [
                styles.actionBtn,
                { borderColor: theme.colors.line, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Eye size={15} color={theme.colors.text2} strokeWidth={2} />
              <Text style={{ color: theme.colors.text2, fontSize: 14, fontWeight: '600' }}>
                {t('profile.previewMyProfile')}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Stats — 6 tiles, tappable. */}
        <View style={styles.statsRow}>
          <Stat label={t('profile.stats.matches')} value={fmt(stats?.matches)} onPress={() => nav.navigate('MatchesList')} />
          <Stat label={t('profile.stats.likes')} value={fmt(stats?.likes)} onPress={() => nav.navigate('LikedMe')} />
          <Stat label={t('profile.stats.viewers')} value={fmt(viewersQ.data?.count)} onPress={() => nav.navigate('Viewers')} />
        </View>
        <View style={[styles.statsRow, { marginTop: 6 }]}>
          <Stat label={t('profile.stats.friends')} value={fmt(stats?.following)} onPress={() => nav.navigate('FriendsList')} />
          <Stat label={t('profile.stats.moments')} value={fmt(stats?.moments)} onPress={() => nav.navigate('MyMoments')} />
          {PRIVATE_PHOTOS_ENABLED && (
            <Stat label={t('profile.stats.privatePhotos')} value={fmt(approvedQ.data?.count)} onPress={() => nav.navigate('PhotoRequests')} />
          )}
        </View>

        {/* Public photos — compact 3 × 2 grid (read-only) so all 6 are visible
            at a glance. Tap a tile to open the fullscreen swipeable gallery;
            empty slots are "+" add-shortcuts into EditProfileScreen. With more
            than 6 photos the last tile shows a +N badge and opens the full set. */}
        <SectionTitle>{t('profile.publicPhotosLimit', { count: photos.length })}</SectionTitle>
        <View style={styles.grid}>
          {Array.from({ length: GRID_SLOTS }).map((_, i) => {
            const url = photos[i];
            const showMore = i === GRID_SLOTS - 1 && overflow > 0;
            if (url) {
              return (
                <Pressable
                  key={`photo-${i}-${url}`}
                  onPress={() => photoViewer.open(photos, i)}
                  style={{ width: tile, height: tile, borderRadius: theme.radius.m, overflow: 'hidden', backgroundColor: theme.colors.surface2 }}
                >
                  <ExpoImage
                    source={{ uri: url }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                  {showMore && (
                    <View style={styles.moreOverlay}>
                      <Text style={styles.moreText}>+{overflow}</Text>
                    </View>
                  )}
                </Pressable>
              );
            }
            return (
              <Pressable
                key={`add-${i}`}
                onPress={goEdit}
                style={{ width: tile, height: tile, borderRadius: theme.radius.m, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface2, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.colors.line }}
              >
                <Plus size={22} color={theme.colors.muted} strokeWidth={2} />
              </Pressable>
            );
          })}
        </View>

        {/* Bio preview (read-only). */}
        <SectionTitle>{t('profile.edit.bio')}</SectionTitle>
        <Pressable onPress={goEdit}>
          <Text style={{ color: user.bio ? theme.colors.text : theme.colors.muted, fontSize: 14, lineHeight: 21 }} numberOfLines={4}>
            {user.bio || t('profile.edit.bioPlaceholder')}
          </Text>
        </Pressable>

        {/* Interests (read-only chips). */}
        <SectionTitle>{t('profile.interestsTitle')}</SectionTitle>
        <Pressable onPress={goEdit} style={styles.tagsRow}>
          {interests.length > 0 ? (
            interests.map((id) => {
              const tag = tagById(id);
              return tag ? <TagChip key={id} tag={tag} shared /> : null;
            })
          ) : (
            <Text style={{ color: theme.colors.muted, fontSize: 13 }}>{t('profile.interestsEmpty')}</Text>
          )}
        </Pressable>

        {/* Voice intro (read-only play). */}
        <SectionTitle>{t('profile.voiceIntro.label')}</SectionTitle>
        {user.voiceIntroUrl ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: theme.radius.pill, backgroundColor: theme.colors.primarySoft }}>
            <VoicePlayButton url={user.voiceIntroUrl} size={18} color={theme.colors.primaryDeep} />
            <Text style={{ fontSize: 13, color: theme.colors.primaryDeep, fontWeight: '600' }}>0:05</Text>
          </View>
        ) : (
          <Pressable onPress={goEdit} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 11, borderRadius: theme.radius.pill, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.colors.line }}>
            <Mic size={16} color={theme.colors.primary} strokeWidth={2} />
            <Text style={{ fontSize: 14, color: theme.colors.text2 }}>{t('profile.voiceIntro.record')}</Text>
          </Pressable>
        )}

        {/* 高光时刻 — read-only contest placements. */}
        <HighlightsSection userId={user.id} />

        {/* Invite friends. */}
        <Pressable
          onPress={() => nav.navigate('InviteFriends')}
          style={({ pressed }) => [styles.inviteCard, { backgroundColor: theme.colors.primarySoft, opacity: pressed ? 0.92 : 1 }]}
        >
          <Crown size={24} color={theme.colors.primaryDeep} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: theme.colors.primaryDeep }}>{t('invite.cardTitle')}</Text>
            <Text style={{ fontSize: 12.5, color: theme.colors.primaryDeep, marginTop: 2, opacity: 0.85 }}>{t('invite.reward')}</Text>
          </View>
          <ChevronRight size={20} color={theme.colors.primaryDeep} />
        </Pressable>

        {/* Settings. */}
        <SectionTitle>{t('profile.settingsTitle')}</SectionTitle>
        <Card flat style={{ paddingVertical: 4 }}>
          {/* Wallet / coins (Phase 4). */}
          <SettingsRow
            icon={<Coins size={18} color={theme.colors.warning} strokeWidth={1.8} />}
            label={t('profile.rows.wallet')}
            detail={t('wallet.coinsN', { n: user.coins ?? 0 })}
            onPress={() => nav.navigate('Wallet')}
          />
          <Divider />
          {/* Active Premium users get the name badge instead — the row is redundant (SSSSS). */}
          {!(user as any).isPremium && (
            <>
              <SettingsRow
                icon={<Crown size={18} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
                label={t('profile.rows.premium')}
                detail={t('profile.rows.premiumUpgrade')}
                onPress={() => nav.navigate('Premium')}
              />
              <Divider />
            </>
          )}
          {/* Gifting Premium is Premium-only (SSSSSS) — free users would mint
              free Premium for the recipient at no cost. Hide the entry; the
              backend also returns 403 PREMIUM_REQUIRED as the real gate. */}
          {!!(user as any).isPremium && (
            <>
              <SettingsRow
                icon={<Gift size={18} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
                label={t('profile.rows.giftPremium')}
                onPress={() => nav.navigate('PremiumGift')}
              />
              <Divider />
            </>
          )}
          <SettingsRow
            icon={<BadgeCheck size={18} color={theme.colors.success} strokeWidth={1.8} />}
            label={t('profile.rows.verification')}
            detail={photoVerified ? t('verification.verified') : undefined}
            onPress={() => nav.navigate('Verification')}
          />
          <Divider />
          <SettingsRow
            icon={<Sparkles size={18} color={theme.colors.secondary} strokeWidth={1.8} />}
            label={t('profile.rows.appIcon')}
            onPress={() => nav.navigate('AppIcon')}
          />
        </Card>

        <Text style={{ textAlign: 'center', marginTop: 32, color: theme.colors.muted, fontSize: 11.5 }}>
          Meyou · v{appVersion}
        </Text>
      </ScrollView>

      <UpgradePremiumSheet open={upsellOpen} onClose={() => setUpsellOpen(false)} reason={t('premium.upsell.profile80')} />
      {photoViewer.node}
    </SafeAreaView>
  );
}

function Stat({ label, value, onPress }: { label: string; value: string | number; onPress?: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.l,
        borderWidth: 1,
        borderColor: theme.colors.line,
        paddingVertical: 12,
        alignItems: 'center',
        opacity: pressed && onPress ? 0.7 : 1,
      })}
    >
      <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.text }}>{value}</Text>
      <Text numberOfLines={1} style={{ fontSize: 11, color: theme.colors.muted, marginTop: 4 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Text style={{ fontSize: 12, color: theme.colors.muted, letterSpacing: 0.72, textTransform: 'uppercase', marginTop: 24, marginBottom: 12 }}>
      {children}
    </Text>
  );
}

function SettingsRow({ icon, label, detail, onPress }: { icon: React.ReactNode; label: string; detail?: string; onPress?: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, gap: 12, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </View>
      <Text style={{ flex: 1, fontSize: 15, color: theme.colors.text }}>{label}</Text>
      {detail && <Text style={{ fontSize: 13, color: theme.colors.muted }}>{detail}</Text>}
      <ChevronRight size={16} color={theme.colors.muted} strokeWidth={1.6} />
    </Pressable>
  );
}

function Divider() {
  const theme = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.line, marginHorizontal: 14 }} />;
}

const styles = StyleSheet.create({
  bellBadge: {
    position: 'absolute',
    top: -5,
    right: -7,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  bellBadgeText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '800' },
  actionRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 10,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  statsRow: { flexDirection: 'row', gap: 6, marginTop: 18 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  inviteCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16, marginTop: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // "+N" badge on the last tile when there are more than 6 photos — tapping it
  // opens the fullscreen gallery where the rest are reachable by swiping.
  moreOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  moreText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
});
