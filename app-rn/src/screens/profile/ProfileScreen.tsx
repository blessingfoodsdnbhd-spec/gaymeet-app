import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BadgeCheck,
  BarChart3,
  Bell,
  ChevronRight,
  Crown,
  Gift,
  Globe,
  Lock,
  Megaphone,
  Mic,
  Pencil,
  Settings as SettingsIcon,
  ShieldCheck,
  Share2,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { useTheme } from '../../theme/ThemeProvider';
import { TopBar, IconButton } from '../../components/TopBar';
import { Avatar } from '../../components/Avatar';
import { Card } from '../../components/Card';
import { TagChip } from '../../components/TagChip';
import { NameWithBadge } from '../../components/NameWithBadge';
import { PopularityBadge } from '../../components/PopularityBadge';
import { PremiumBadge } from '../../components/PremiumBadge';
import { VoicePlayButton } from '../../components/VoicePlayButton';
import { usePhotoViewer } from '../../components/usePhotoViewer';
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
import { fetchIsAdmin } from '../../api/admin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RootStackParamList } from '../../navigation/types';

type AnyNav = NativeStackNavigationProp<any>;

/**
 * Self profile (我 tab) — READ-ONLY display (EEEE). All editing moved to the
 * dedicated EditProfileScreen, reached via the "编辑资料" button. This screen
 * shows the user's avatar/name, completion bar, tappable stats, a large photo
 * preview grid, and read-only previews of bio / interests / voice, plus the
 * invite card and settings rows. Keeping it form-free makes the most-used tab
 * lighter and removes the accidental-edit taps Wei Qian flagged.
 *
 * UserDetailScreen handles viewing OTHER people's profiles.
 */
export function ProfileScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
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
  const isAdminQ = useQuery({
    queryKey: ['me', 'isAdmin'],
    queryFn: fetchIsAdmin,
    staleTime: 60 * 60_000,
    enabled: !!user,
  });
  const isAdmin = isAdminQ.data === true;

  if (!user) return null;

  const interests = (user.interests ?? []) as InterestTagId[];
  const photos = user.photos ?? [];
  const stats = statsQ.data;
  const fmt = (n: number | undefined) => (typeof n === 'number' ? n : '—');
  const official = !!(user as any).isOfficial;
  const photoVerified = !!(user as any).isVerified;

  // GGGG — large 3-column photo grid. Tile = (screen − h-padding − 2 gaps) / 3.
  const GAP = 8;
  const tile = Math.floor((width - theme.spacing.xl * 2 - GAP * 2) / 3);

  const goEdit = () => nav.navigate('EditProfile');

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
            <IconButton onPress={() => nav.navigate('AccountSettings')}>
              <SettingsIcon size={18} color={theme.colors.text} strokeWidth={1.6} />
            </IconButton>
          </>
        }
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: theme.spacing.xl, paddingBottom: 40 }}>
        <View style={{ marginTop: 12 }}>
          <ProfileCompletionCard user={user} />
        </View>

        {/* Avatar + name + verified badge (read-only) + 编辑资料 button. */}
        <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 6 }}>
          <Avatar name={user.nickname} uri={user.avatarUrl} avatarIdx={0} size={96} shape="circle" />
          <NameWithBadge
            name={user.nickname}
            official={official}
            verified={photoVerified}
            badgeSize={18}
            textStyle={{ fontSize: 22, fontWeight: '700', color: theme.colors.text }}
            containerStyle={{ marginTop: 12 }}
          />
          {(user.streak?.current ?? 0) > 0 && (
            <Text style={{ marginTop: 6, fontSize: 13, color: theme.colors.primaryDeep, fontWeight: '600' }}>
              {t('profile.streak', { n: user.streak!.current })}
            </Text>
          )}
          {((user as any).popularity ?? 0) >= 1 && (
            <View style={{ marginTop: 6 }}>
              <PopularityBadge value={(user as any).popularity} size="md" />
            </View>
          )}
          {(user as any).isPremium && (
            <View style={{ marginTop: 6 }}>
              <PremiumBadge isPremium size={20} />
            </View>
          )}
          {!official && <View style={{ height: 12 }} />}
          <Pressable
            onPress={goEdit}
            style={({ pressed }) => [
              styles.editBtn,
              { borderColor: theme.colors.line, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Pencil size={15} color={theme.colors.primary} strokeWidth={2} />
            <Text style={{ color: theme.colors.primary, fontSize: 14, fontWeight: '600' }}>
              {t('editProfile.title')}
            </Text>
          </Pressable>
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

        {/* Public photos — large 3-col preview (read-only). Tap a photo to
            view; tap 编辑 to manage. */}
        <SectionTitle>{t('profile.publicPhotosLimit', { count: photos.length })}</SectionTitle>
        {photos.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
            {photos.map((url, i) => (
              <Pressable key={`${url}-${i}`} onPress={() => photoViewer.open(photos, i)}>
                <Image
                  source={{ uri: url }}
                  style={{ width: tile, height: tile, borderRadius: theme.radius.m, backgroundColor: theme.colors.surface2 }}
                  contentFit="cover"
                />
              </Pressable>
            ))}
          </View>
        ) : (
          <Pressable onPress={goEdit}>
            <Text style={{ color: theme.colors.muted, fontSize: 13 }}>{t('profile.edit.addPhotosHint')}</Text>
          </Pressable>
        )}

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
          <SettingsRow
            icon={<Lock size={18} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
            label={t('profile.rows.privacy')}
            onPress={() => nav.navigate('PrivacySettings')}
          />
          <Divider />
          <SettingsRow
            icon={<Bell size={18} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
            label={t('profile.rows.notifications')}
            onPress={() => nav.navigate('NotificationSettings')}
          />
          <Divider />
          <SettingsRow
            icon={<Globe size={18} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
            label={t('profile.rows.language')}
            detail={i18n.language.startsWith('zh') ? t('profile.rows.languageValueZh') : t('profile.rows.languageValueEn')}
            onPress={() => nav.navigate('LanguageSettings')}
          />
          <Divider />
          <SettingsRow
            icon={<ShieldCheck size={18} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
            label={t('profile.rows.account')}
            onPress={() => nav.navigate('AccountSettings')}
          />
          <Divider />
          <SettingsRow
            icon={<BarChart3 size={18} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
            label={t('profile.rows.myData')}
            onPress={() => nav.navigate('MyAnalytics')}
          />
          <Divider />
          <SettingsRow
            icon={<Gift size={18} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
            label={t('profile.rows.giftPremium')}
            onPress={() => nav.navigate('PremiumGift')}
          />
          <Divider />
          <SettingsRow
            icon={<BadgeCheck size={18} color={theme.colors.success} strokeWidth={1.8} />}
            label={t('profile.rows.verification')}
            detail={photoVerified ? t('verification.verified') : undefined}
            onPress={() => nav.navigate('Verification')}
          />
          {isAdmin && (
            <>
              <Divider />
              <SettingsRow
                icon={<BadgeCheck size={18} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
                label={t('profile.rows.adminVerifications')}
                onPress={() => nav.navigate('AdminVerifications')}
              />
              <Divider />
              <SettingsRow
                icon={<Megaphone size={18} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
                label={t('profile.rows.announcementAdmin')}
                onPress={() => nav.navigate('AnnouncementAdmin')}
              />
              <Divider />
              <SettingsRow
                icon={<ShieldCheck size={18} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
                label={t('profile.rows.adminReports')}
                onPress={() => nav.navigate('AdminReports')}
              />
              <Divider />
              <SettingsRow
                icon={<Crown size={18} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
                label={t('profile.rows.adminStats')}
                onPress={() => nav.navigate('AdminStats')}
              />
            </>
          )}
        </Card>

        <Text style={{ textAlign: 'center', marginTop: 32, color: theme.colors.muted, fontSize: 11.5 }}>
          Meyou · v{Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '2.0'} ({Constants.nativeBuildVersion ?? '—'})
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
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  statsRow: { flexDirection: 'row', gap: 6, marginTop: 18 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  inviteCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16, marginTop: 24 },
});
