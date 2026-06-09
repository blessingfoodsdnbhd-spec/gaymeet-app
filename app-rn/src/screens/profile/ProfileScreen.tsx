import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bell,
  Camera,
  ChevronRight,
  Crown,
  Edit2,
  Gift,
  Globe,
  Lock,
  Mic,
  ShieldCheck,
  Megaphone,
  Settings as SettingsIcon,
  Share2,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';

import { useTheme } from '../../theme/ThemeProvider';
import { TopBar, IconButton } from '../../components/TopBar';
import { Avatar } from '../../components/Avatar';
import { Card } from '../../components/Card';
import { TagChip } from '../../components/TagChip';
import { DateField, formatYMD, parseYMD } from '../../components/DateField';
import { PhotoGridEditor } from '../../components/PhotoGridEditor';
import { usePhotoViewer } from '../../components/usePhotoViewer';
import { shareProfile } from '../../utils/shareProfile';
import { tagById, type InterestTagId } from '../../data/interestTags';
import { TopicPickerSheet } from './TopicPickerSheet';
import { VoiceRecorderSheet } from './VoiceRecorderSheet';
import { VoicePlayButton } from '../../components/VoicePlayButton';
import { getMyPersonas, updatePersona } from '../../api/mePersonas';
import { TOPICS_ENABLED, PRIVATE_PHOTOS_ENABLED } from '../../config/featureFlags';
import { HighlightsSection } from '../votes/HighlightsSection';
import { ProfileCompletionCard, useProfileCompletion } from '../../components/ProfileCompletionCard';
import { UpgradePremiumSheet } from '../../components/UpgradePremiumSheet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTopics, type Topic } from '../../api/topics';
import { uploadFile } from '../../api/upload';
import { getIncomingUnlocks } from '../../api/topicUnlocks';
import { useAuth } from '../../store/auth';
import { getMyStats, getViewers, patchMe, deleteVoiceIntro } from '../../api/me';
import { getUnreadCount } from '../../api/notifications';
import { computeAge, computeZodiac, zodiacLabel } from '../../utils/zodiac';
import { fetchIsAdmin } from '../../api/admin';
import { uploadProfilePhoto, deleteProfilePhoto, reorderPhotos } from '../../api/upload';
import {
  uploadPrivatePhoto,
  deletePrivatePhoto,
  getPrivatePhotos,
  getApprovedCount,
  relockAll,
} from '../../api/privatePhotos';
import type { RootStackParamList } from '../../navigation/types';

type AnyNav = NativeStackNavigationProp<any>;

const PHOTO_MAX = 5;

/**
 * Self profile (Me tab) — inline editor. No separate EditProfileScreen
 * is reachable from here; nickname/bio/age are inline TextInputs that
 * auto-save on blur, avatar + photo grids edit directly.
 *
 * UserDetailScreen handles viewing OTHER people's profiles (read-only).
 * This screen is always the current user's own profile.
 */
export function ProfileScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const nav = useNavigation<AnyNav>();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const queryClient = useQueryClient();

  // Unread notification count for the header bell badge.
  const unreadQ = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: getUnreadCount,
    staleTime: 30_000,
    select: (d) => d.count,
  });
  const unread = unreadQ.data ?? 0;

  // One-time Premium nudge once the profile is ≥80% complete (Phase 6).
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

  // Inline editable fields — local state, auto-saved onEndEditing.
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  // Name field needs an explicit edit affordance (users couldn't tell the bold
  // name was tappable). Focus state highlights the underline + pencil; the ref
  // lets the pencil icon focus the input.
  const [nameFocused, setNameFocused] = useState(false);
  const nameInputRef = useRef<TextInput>(null);
  const [bio, setBio] = useState(user?.bio ?? '');
  // Date of birth drives age + zodiac. Edited as a YYYY-MM-DD string; the
  // backend stores it and denormalizes the computed age.
  const [dob, setDob] = useState(user?.dob ? user.dob.slice(0, 10) : '');
  const [height, setHeight] = useState(user?.height != null ? String(user.height) : '');
  const [weight, setWeight] = useState(user?.weight != null ? String(user.weight) : '');
  const [bodyType, setBodyType] = useState<string | null>(user?.bodyType ?? null);
  const [relationshipStatus, setRelationshipStatus] = useState<string | null>(
    user?.relationshipStatus ?? null,
  );
  const [mbti, setMbti] = useState<string | null>(user?.mbti ?? null);
  const [intents, setIntents] = useState<string[]>(user?.intents ?? []);
  const [city, setCity] = useState(user?.city ?? '');

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [publicBusy, setPublicBusy] = useState(false);
  const [privateBusy, setPrivateBusy] = useState(false);

  // Stats — single endpoint covers matches/likes/following/moments.
  const statsQ = useQuery({
    queryKey: ['me', 'stats'],
    queryFn: getMyStats,
    staleTime: 60_000,
    enabled: !!user,
  });

  // "谁在看你" count for the 6th stat tile — count is returned for free users
  // too (only the viewer identities are gated), so this is safe to always show.
  const viewersQ = useQuery({
    queryKey: ['users', 'viewers'],
    queryFn: getViewers,
    staleTime: 60_000,
    enabled: !!user,
  });

  // Admin gate for in-app admin UI (e.g. Announcement Manager). Always fetch
  // the authoritative flag from the server.
  //
  // NOTE: do NOT seed this with `initialData: () => getCachedIsAdmin()`.
  // getCachedIsAdmin is async, so that made `initialData` a *Promise* (always
  // truthy) — which (a) poisoned `data` so `data === true` was never true, and
  // (b) marked the query "fresh" under staleTime so fetchIsAdmin never ran.
  // Net effect: the admin row was hidden for every admin, regardless of the
  // backend. Letting the query fetch normally fixes it.
  const isAdminQ = useQuery({
    queryKey: ['me', 'isAdmin'],
    queryFn: fetchIsAdmin,
    staleTime: 60 * 60_000,
    enabled: !!user,
  });
  const isAdmin = isAdminQ.data === true;

  // Self's private photo URLs. Backend special-cases self → returns the
  // real URLs with status='owner'. toPublicJSON strips these from /me.
  const myPrivatePhotosQ = useQuery({
    queryKey: ['me', 'privatePhotos'],
    queryFn: () => getPrivatePhotos(user!.id),
    enabled: !!user,
    staleTime: 60_000,
  });
  const privatePhotos = myPrivatePhotosQ.data?.photos ?? [];
  const photoViewer = usePhotoViewer();

  // Approved viewer count — drives the 5th stat tile ("Private") and the
  // "Revoke all" CTA. Not Premium-gated server-side; works for everyone.
  const approvedQ = useQuery({
    queryKey: ['photoRequests', 'approvedCount'],
    queryFn: getApprovedCount,
    enabled: !!user,
    staleTime: 30_000,
  });
  const approvedCount = approvedQ.data?.count ?? 0;

  // Topic Personas — list mine + the full topic catalog so we can label
  // each persona row with its topic name + icon for the locale.
  const myPersonasQ = useQuery({
    queryKey: ['me', 'topic-personas'],
    queryFn: getMyPersonas,
    enabled: !!user,
    staleTime: 30_000,
  });
  const topicsQ = useQuery({
    queryKey: ['topics', 'list'],
    queryFn: getTopics,
    enabled: !!user,
    staleTime: 5 * 60_000,
  });
  const topicBySlug = new Map<string, Topic>(
    (topicsQ.data ?? []).map((tp) => [tp.slug, tp]),
  );
  const personaLocale: 'en' | 'zh' = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const [topicPickerOpen, setTopicPickerOpen] = useState(false);
  const [voiceRecorderOpen, setVoiceRecorderOpen] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);

  const onDeleteVoice = async () => {
    if (voiceBusy) return;
    setVoiceBusy(true);
    try {
      await deleteVoiceIntro();
      setUser({ ...user!, voiceIntroUrl: null });
    } catch {
      // best-effort
    } finally {
      setVoiceBusy(false);
    }
  };

  // Pending unlock-request count drives the badge on the inbox link
  // shown under the Personas section. Always-on so the user sees new
  // requests the moment they land on Profile.
  const incomingQ = useQuery({
    queryKey: ['topic-unlocks', 'incoming'],
    queryFn: getIncomingUnlocks,
    enabled: !!user,
    staleTime: 30_000,
  });
  const incomingCount = (incomingQ.data ?? []).length;

  // Per-persona photo cap mirrors the cap on TopicPersonaEditScreen:
  // Free 3, Premium 5. The list row label "已上傳 X/Y 張" was previously
  // hardcoded to Y=5 which over-reported the available slots for Free
  // users.
  const personaPhotoMax = (user as any)?.isPremium ? 5 : 3;

  // Per-persona "currently uploading" tracker so each row's
  // PhotoGridEditor renders its own spinner. Set<slug>.
  const [personaUploading, setPersonaUploading] = useState<Set<string>>(
    new Set(),
  );
  const markPersonaUploading = (slug: string, on: boolean) =>
    setPersonaUploading((prev) => {
      const next = new Set(prev);
      if (on) next.add(slug);
      else next.delete(slug);
      return next;
    });

  // Add a photo to an existing persona — pick from library, upload to
  // B2, PATCH the persona row with the new photos array, then
  // invalidate so the local list re-renders. Server caps the array at
  // personaPhotoMax (3 / 5) and returns 402 with reason
  // 'premium_required' if exceeded — we surface that as an alert,
  // matching the existing TopicPersonaEditScreen behaviour.
  const addPersonaPhoto = async (slug: string, currentPhotos: string[]) => {
    if (personaUploading.has(slug)) return;
    if (currentPhotos.length >= personaPhotoMax) {
      Alert.alert(
        t('topics.photoCapTitle'),
        t('topics.photoCapBody', { max: personaPhotoMax }),
      );
      return;
    }
    const uri = await pickFromLibrary();
    if (!uri) return;
    markPersonaUploading(slug, true);
    try {
      const b2Url = await uploadFile(uri);
      await updatePersona(slug, { photos: [...currentPhotos, b2Url] });
      queryClient.invalidateQueries({ queryKey: ['me', 'topic-personas'] });
      queryClient.invalidateQueries({ queryKey: ['topics', slug, 'personas'] });
    } catch (e: any) {
      const status = e?.response?.status;
      const body = e?.response?.data;
      if (status === 402 && body?.reason === 'premium_required') {
        Alert.alert(
          t('topics.personaLimitTitle'),
          body?.error || t('topics.premiumLimit'),
        );
      } else {
        Alert.alert(
          t('profile.photoUploadFailed'),
          body?.error || e?.message || '',
        );
      }
    } finally {
      markPersonaUploading(slug, false);
    }
  };

  const removePersonaPhoto = async (
    slug: string,
    currentPhotos: string[],
    url: string,
  ) => {
    if (personaUploading.has(slug)) return;
    markPersonaUploading(slug, true);
    try {
      await updatePersona(slug, {
        photos: currentPhotos.filter((p) => p !== url),
      });
      queryClient.invalidateQueries({ queryKey: ['me', 'topic-personas'] });
      queryClient.invalidateQueries({ queryKey: ['topics', slug, 'personas'] });
    } catch (e: any) {
      Alert.alert(
        t('topics.saveFailed'),
        e?.response?.data?.error || e?.message || '',
      );
    } finally {
      markPersonaUploading(slug, false);
    }
  };

  const saveMut = useMutation({
    mutationFn: (patch: {
      nickname?: string;
      bio?: string;
      dob?: string | null;
      height?: number;
      weight?: number;
      bodyType?: string;
      city?: string;
      relationshipStatus?: string | null;
      mbti?: string | null;
      intents?: string[];
    }) => patchMe(patch),
    onSuccess: (updated) => setUser(updated),
    onError: (e: any) => {
      if (e?.response?.data?.code === 'RESERVED_NAME') {
        setNickname(user?.nickname ?? ''); // revert the field
        Alert.alert(t('errors.reservedName'));
        return;
      }
      const detail = e?.response?.data?.error || e?.message || '';
      Alert.alert(t('profile.edit.saveFailed'), detail);
    },
  });

  const relockMut = useMutation({
    mutationFn: relockAll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photoRequests', 'approvedCount'] });
      queryClient.invalidateQueries({ queryKey: ['photoRequests', 'inbox'] });
    },
  });

  if (!user) return null;

  const interests = (user.interests ?? []) as InterestTagId[];
  const prompts = user.prompts ?? [];
  const mobileGames = user.mobileGames ?? [];
  // Reference "now" for DOB picker bounds (18–99 years old).
  const dobNow = new Date();
  const stats = statsQ.data;
  const fmt = (n: number | undefined) => (typeof n === 'number' ? n : '—');

  // Auto-save helpers — only fire if the value actually changed vs the
  // last-known user object, to avoid spamming the API with no-op patches.
  const saveNickname = () => {
    const next = nickname.trim();
    if (!next || next === user.nickname) return;
    saveMut.mutate({ nickname: next });
  };
  const saveBio = () => {
    const next = bio.trim();
    if (next === (user.bio ?? '').trim()) return;
    saveMut.mutate({ bio: next });
  };
  // DOB picked from the native date wheel → store the YYYY-MM-DD string and
  // persist immediately (a discrete action, not text editing). Same 18–99 guard
  // as before; the picker's min/max bounds make out-of-range hard to hit anyway.
  const onPickDob = (d: Date) => {
    const v = formatYMD(d);
    if (!v) return;
    setDob(v);
    const existing = user.dob ? user.dob.slice(0, 10) : '';
    if (v === existing) return;
    const a = computeAge(v);
    if (a == null || a < 18 || a > 99) return;
    saveMut.mutate({ dob: v });
  };
  const saveHeight = () => {
    const n = height ? parseInt(height, 10) : undefined;
    if (n === user.height) return;
    if (n !== undefined && (isNaN(n) || n < 100 || n > 250)) return;
    saveMut.mutate({ height: n });
  };
  const saveWeight = () => {
    const n = weight ? parseInt(weight, 10) : undefined;
    if (n === user.weight) return;
    if (n !== undefined && (isNaN(n) || n < 30 || n > 300)) return;
    saveMut.mutate({ weight: n });
  };
  const saveCity = () => {
    const next = city.trim();
    if (next === (user.city ?? '').trim()) return;
    saveMut.mutate({ city: next });
  };
  const pickBodyType = (id: string) => {
    const next = bodyType === id ? null : id; // tap again to clear
    setBodyType(next);
    saveMut.mutate({ bodyType: next ?? '' });
  };
  const BODY_TYPES = ['average', 'fit', 'chubby', 'slim'];

  const RELATIONSHIP_OPTIONS = [
    'single', 'in_relationship', 'married', 'open_relationship', 'polyamorous',
  ];
  const MBTI_TYPES = [
    'INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP',
    'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP',
  ];
  const INTENT_OPTIONS = ['friends', 'chat', 'serious', 'activity', 'language'];
  // Enum fields clear with null (NOT '' — that fails the schema enum).
  const pickRelationship = (id: string) => {
    const next = relationshipStatus === id ? null : id;
    setRelationshipStatus(next);
    saveMut.mutate({ relationshipStatus: next });
  };
  const pickMbti = (code: string) => {
    const next = mbti === code ? null : code;
    setMbti(next);
    saveMut.mutate({ mbti: next });
  };
  const toggleIntent = (id: string) => {
    const next = intents.includes(id)
      ? intents.filter((x) => x !== id)
      : [...intents, id];
    setIntents(next);
    saveMut.mutate({ intents: next });
  };
  const rsKey = (id: string) =>
    ({ in_relationship: 'inRelationship', open_relationship: 'openRelationship' } as Record<string, string>)[id] ?? id;

  // Pick + upload helpers — used for avatar tap, public grid, private grid.
  // editable=true → show the crop screen but with NO aspect constraint, so the
  // user freely chooses the framing (used for the round avatar). editable=false
  // → skip cropping entirely and keep the ORIGINAL aspect ratio (public /
  // private / persona photos; grids show a square thumbnail via cover-fit).
  const pickFromLibrary = async (
    editable = false,
  ): Promise<string | null> => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert(t('profile.edit.photoPermTitle'), t('profile.edit.photoPermBody'));
      return null;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: editable,
      quality: 0.85,
    });
    return res.canceled ? null : res.assets[0].uri;
  };

  const pickAvatar = async () => {
    if (uploadingAvatar) return;
    // Avatar keeps the crop screen (round avatar) but with no aspect lock.
    const uri = await pickFromLibrary(true);
    if (!uri) return;
    setUploadingAvatar(true);
    try {
      const r = await uploadProfilePhoto(uri);
      setUser({ ...user, avatarUrl: r.avatarUrl ?? user.avatarUrl, photos: r.photos ?? user.photos });
    } catch (e: any) {
      console.error('[upload-avatar] failed', { uri, status: e?.response?.status, message: e?.message });
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.error || e?.message || (status ? `HTTP ${status}` : 'network error');
      Alert.alert(t('profile.edit.uploadFailed'), `${detail}${status ? ` (HTTP ${status})` : ''}`);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const addPublicPhoto = async () => {
    if (publicBusy) return;
    // Crop only on Android: there allowsEditing gives a FREE-aspect crop. On iOS
    // the native editor is square-only, which cropped portrait photos badly
    // (PR JJJ) — so iOS keeps the photo's natural shape (no editor). primary=false
    // → appended but not auto-promoted to avatar (#5).
    const uri = await pickFromLibrary(Platform.OS === 'android');
    if (!uri) return;
    setPublicBusy(true);
    try {
      const r = await uploadProfilePhoto(uri, false);
      setUser({ ...user, avatarUrl: r.avatarUrl, photos: r.photos });
    } catch (e: any) {
      console.error('[upload-public] failed', { uri, status: e?.response?.status, message: e?.message });
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.error || e?.message || (status ? `HTTP ${status}` : 'network error');
      Alert.alert(t('profile.photoUploadFailed'), `${detail}${status ? ` (HTTP ${status})` : ''}`);
    } finally {
      setPublicBusy(false);
    }
  };

  const removePublicPhoto = (url: string) => {
    Alert.alert(t('profile.deletePhotoTitle'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.deletePhotoAction'),
        style: 'destructive',
        onPress: async () => {
          try {
            const r = await deleteProfilePhoto(url);
            setUser({ ...user, avatarUrl: r.avatarUrl, photos: r.photos });
          } catch (e: any) {
            const detail = e?.response?.data?.error || e?.message || '';
            Alert.alert(t('profile.photoDeleteFailed'), detail);
          }
        },
      },
    ]);
  };

  // Long-press a gallery photo → choose to make it the avatar (or delete).
  // photos[0] is the avatar, so "set as avatar" is a reorder to the front.
  const setAsAvatar = (url: string) => {
    if (!user) return;
    if (url === user.avatarUrl) return; // already the avatar
    Alert.alert(t('profile.photoActions'), '', [
      {
        text: t('profile.setAsAvatar'),
        onPress: async () => {
          try {
            const others = (user.photos ?? []).filter((p) => p !== url);
            const r = await reorderPhotos([url, ...others]);
            setUser({ ...user, photos: r.photos, avatarUrl: r.avatarUrl });
          } catch (e: any) {
            const detail = e?.response?.data?.error || e?.message || '';
            Alert.alert(t('profile.edit.uploadFailed'), detail);
          }
        },
      },
      { text: t('profile.deletePhotoAction'), style: 'destructive', onPress: () => removePublicPhoto(url) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const addPrivatePhoto = async () => {
    if (privateBusy) return;
    const uri = await pickFromLibrary();
    if (!uri) return;
    setPrivateBusy(true);
    try {
      await uploadPrivatePhoto(uri);
      await queryClient.invalidateQueries({ queryKey: ['me', 'privatePhotos'] });
      setUser({ ...user, privatePhotosCount: (user.privatePhotosCount ?? 0) + 1 });
    } catch (e: any) {
      console.error('[upload-private] failed', { uri, status: e?.response?.status, message: e?.message });
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.error || e?.message || (status ? `HTTP ${status}` : 'network error');
      Alert.alert(t('profile.photoUploadFailed'), `${detail}${status ? ` (HTTP ${status})` : ''}`);
    } finally {
      setPrivateBusy(false);
    }
  };

  const removePrivatePhoto = (url: string) => {
    Alert.alert(t('profile.deletePhotoTitle'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.deletePhotoAction'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePrivatePhoto(url);
            await queryClient.invalidateQueries({ queryKey: ['me', 'privatePhotos'] });
            setUser({
              ...user,
              privatePhotosCount: Math.max(0, (user.privatePhotosCount ?? 1) - 1),
            });
          } catch (e: any) {
            const detail = e?.response?.data?.error || e?.message || '';
            Alert.alert(t('profile.photoDeleteFailed'), detail);
          }
        },
      },
    ]);
  };

  const onRevokeAll = () => {
    if (approvedCount === 0) return;
    Alert.alert(
      t('profile.revokeAllConfirmTitle'),
      t('profile.revokeAllConfirmBody', { n: approvedCount }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.revokeAllAction'),
          style: 'destructive',
          onPress: () => relockMut.mutate(),
        },
      ],
    );
  };

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
            <IconButton onPress={() => user && shareProfile(user.id, user.nickname, t)}>
              <Share2 size={18} color={theme.colors.text} strokeWidth={1.6} />
            </IconButton>
            <IconButton onPress={() => nav.navigate('AccountSettings')}>
              <SettingsIcon size={18} color={theme.colors.text} strokeWidth={1.6} />
            </IconButton>
          </>
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Profile completion nudge — hides itself at 100%. */}
          <View style={{ marginTop: 12 }}>
            <ProfileCompletionCard user={user} />
          </View>

          {/* Avatar — tap to change. Photos[0] is always the avatar. */}
          <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 6 }}>
            <Pressable onPress={pickAvatar} disabled={uploadingAvatar} hitSlop={6}>
              <Avatar
                name={nickname || user.nickname}
                uri={user.avatarUrl}
                avatarIdx={0}
                size={96}
                shape="circle"
              />
              {/* Camera badge — bottom-right of avatar */}
              <View style={[styles.cameraBadge, { backgroundColor: theme.colors.primary }]}>
                <Camera size={14} color="#FFFFFF" strokeWidth={2} />
              </View>
              {uploadingAvatar && (
                <View style={[StyleSheet.absoluteFill, styles.avatarSpinner]}>
                  <ActivityIndicator color="#FFFFFF" />
                </View>
              )}
            </Pressable>

            {/* Name + edit affordance. The bold name alone read as a static
                heading ("看不清楚" — users couldn't tell it was editable), so
                wrap it in a row with a visible pencil and an underline that
                turns brand-colored on focus. Tapping the pencil focuses input. */}
            <Pressable
              onPress={() => nameInputRef.current?.focus()}
              style={[
                styles.nameEditRow,
                {
                  borderBottomColor: nameFocused
                    ? theme.colors.primary
                    : theme.colors.line,
                },
              ]}
            >
              <TextInput
                ref={nameInputRef}
                value={nickname}
                onChangeText={setNickname}
                onFocus={() => setNameFocused(true)}
                onEndEditing={() => {
                  setNameFocused(false);
                  saveNickname();
                }}
                onBlur={() => setNameFocused(false)}
                placeholder={t('profile.edit.nickname')}
                placeholderTextColor={theme.colors.muted}
                maxLength={30}
                style={[styles.nicknameInput, { color: theme.colors.text }]}
              />
              <Edit2
                size={16}
                color={nameFocused ? theme.colors.primary : theme.colors.muted}
                strokeWidth={2}
              />
            </Pressable>
          </View>

          {/* Stats — 6 tiles in two rows of 3. Tap any to drill into the list. */}
          <View style={styles.statsRow}>
            <Stat
              label={t('profile.stats.matches')}
              value={fmt(stats?.matches)}
              onPress={() => nav.navigate('MatchesList')}
            />
            <Stat
              label={t('profile.stats.likes')}
              value={fmt(stats?.likes)}
              onPress={() => nav.navigate('LikedMe')}
            />
            <Stat
              label={t('profile.stats.viewers')}
              value={fmt(viewersQ.data?.count)}
              onPress={() => nav.navigate('Viewers')}
            />
          </View>
          <View style={[styles.statsRow, { marginTop: 6 }]}>
            <Stat
              label={t('profile.stats.friends')}
              value={fmt(stats?.following)}
              onPress={() => nav.navigate('FriendsList')}
            />
            <Stat
              label={t('profile.stats.moments')}
              value={fmt(stats?.moments)}
              onPress={() => nav.navigate('MyMoments')}
            />
            {PRIVATE_PHOTOS_ENABLED && (
              <Stat
                label={t('profile.stats.privatePhotos')}
                value={fmt(approvedQ.data?.count)}
                onPress={() => nav.navigate('PhotoRequests')}
              />
            )}
          </View>

          {/* Public photos */}
          <SectionTitle>
            {t('profile.publicPhotosLimit', { count: user.photos?.length ?? 0 })}
          </SectionTitle>
          <PhotoGridEditor
            photos={user.photos ?? []}
            max={PHOTO_MAX}
            busy={publicBusy}
            onAdd={addPublicPhoto}
            onRemove={removePublicPhoto}
            onView={(i) => photoViewer.open(user.photos ?? [], i)}
            onSetAvatar={setAsAvatar}
            avatarUrl={user.avatarUrl}
          />

          {/* Private photos — hidden behind PRIVATE_PHOTOS_ENABLED for the
              Apple 4.3(b) content strip. Public photos above are unaffected. */}
          {PRIVATE_PHOTOS_ENABLED && (
            <>
              <SectionTitle>
                {t('profile.privatePhotosLimit', { count: privatePhotos.length })}
              </SectionTitle>
              <PhotoGridEditor
                photos={privatePhotos}
                max={PHOTO_MAX}
                busy={privateBusy || myPrivatePhotosQ.isLoading}
                onAdd={addPrivatePhoto}
                onRemove={removePrivatePhoto}
                onView={(i) => photoViewer.open(privatePhotos, i)}
                badgeIcon={<Lock size={12} color="#FFFFFF" strokeWidth={2.2} />}
              />
              <Text style={{ color: theme.colors.muted, fontSize: 12, marginTop: 8 }}>
                {t('profile.privatePhotosHint')}
              </Text>
              {approvedCount > 0 && (
                <Pressable
                  onPress={onRevokeAll}
                  disabled={relockMut.isPending}
                  style={({ pressed }) => ({
                    marginTop: 10,
                    paddingVertical: 8,
                    opacity: pressed || relockMut.isPending ? 0.55 : 1,
                  })}
                >
                  <Text style={{ color: theme.colors.primary, fontSize: 14, fontWeight: '500' }}>
                    {t('profile.revokeAllAccess', { n: approvedCount })}
                  </Text>
                </Pressable>
              )}
            </>
          )}

          {/* Topic Personas — each row jumps into the edit screen for
              its slug; the "+" CTA opens the TopicPickerSheet to choose
              a new topic to join. Backend caps the number of active
              personas (Free 2 / Premium 8); we don't enforce client-
              side so the limit-reached path surfaces a real 402 alert
              from the edit-screen save mutation.
              Order: sits directly under the Private Photos block per
              user feedback — topics are now more central than the
              interests tags, so they get prime real estate. */}
          {TOPICS_ENABLED && (
          <>
          <SectionTitle>{t('profile.personasTitle')}</SectionTitle>
          {(myPersonasQ.data ?? []).filter((p) => p.isActive).length === 0 ? (
            <Text style={{ color: theme.colors.muted, fontSize: 13 }}>
              {t('profile.personasEmpty')}
            </Text>
          ) : (
            (myPersonasQ.data ?? [])
              .filter((p) => p.isActive)
              .map((p) => {
                const tp = topicBySlug.get(p.topicSlug);
                const label = tp?.name?.[personaLocale] ?? tp?.name?.en ?? p.topicSlug;
                return (
                  <View key={p.id} style={{ paddingVertical: 12 }}>
                    {/* Header row: icon + topic name + nickname/count
                        subtitle, with a small pencil button on the
                        right that jumps into TopicPersonaEditScreen
                        for nickname edit / leave actions. Photo
                        add/remove happens inline below — no nav. */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <Text style={{ fontSize: 20 }}>{tp?.icon || '•'}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: '600' }}>
                          {label}
                        </Text>
                        <Text style={{ color: theme.colors.muted, fontSize: 12, marginTop: 2 }}>
                          {p.nickname} · {t('topics.uploadPhotos', { count: p.photos.length, max: personaPhotoMax })}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() =>
                          nav.navigate('TopicPersonaEdit', {
                            topicSlug: p.topicSlug,
                            topicName: label,
                            topicIcon: tp?.icon,
                          })
                        }
                        hitSlop={8}
                        style={({ pressed }) => ({
                          padding: 6,
                          opacity: pressed ? 0.6 : 1,
                        })}
                        accessibilityLabel={t('topics.editNickname')}
                      >
                        <Edit2 size={16} color={theme.colors.muted} strokeWidth={1.8} />
                      </Pressable>
                    </View>
                    {/* Inline photo grid — same UX as public + private
                        photo grids above. Each removal/add hits PATCH
                        /api/me/topic-personas/:slug then invalidates
                        the personas query. */}
                    <View style={{ marginTop: 10 }}>
                      <PhotoGridEditor
                        photos={p.photos}
                        max={personaPhotoMax}
                        busy={personaUploading.has(p.topicSlug)}
                        onAdd={() => addPersonaPhoto(p.topicSlug, p.photos)}
                        onRemove={(url) =>
                          removePersonaPhoto(p.topicSlug, p.photos, url)
                        }
                      />
                    </View>
                  </View>
                );
              })
          )}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Pressable
              onPress={() => setTopicPickerOpen(true)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 999,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: theme.colors.line,
              }}
            >
              <Text style={{ color: theme.colors.text2, fontSize: 14 }}>
                + {t('topics.join')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => nav.navigate('UnlockRequests')}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 999,
                backgroundColor: theme.colors.primarySoft,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Text style={{ color: theme.colors.primaryDeep, fontSize: 14, fontWeight: '600' }}>
                {t('topics.inboxLink')}
              </Text>
              {incomingCount > 0 && (
                <View
                  style={{
                    minWidth: 18,
                    height: 18,
                    paddingHorizontal: 5,
                    borderRadius: 9,
                    backgroundColor: theme.colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                    {incomingCount}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
          </>
          )}

          {/* Interests — moved below Topic Personas per user feedback
              (Topic Personas section is now adjacent to Photos which
              is the more useful adjacency). */}
          <SectionTitle>{t('profile.interestsTitle')}</SectionTitle>
          <View style={styles.tagsRow}>
            {interests.length > 0 ? (
              interests.map((id) => {
                const tag = tagById(id);
                if (!tag) return null;
                return <TagChip key={id} tag={tag} shared />;
              })
            ) : (
              <Text style={{ color: theme.colors.muted, fontSize: 13 }}>
                {t('profile.interestsEmpty')}
              </Text>
            )}
            <Pressable
              onPress={() => nav.navigate('TagsEdit')}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 9,
                borderRadius: 999,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: theme.colors.line,
              }}
            >
              <Text style={{ color: theme.colors.text2, fontSize: 14 }}>
                {t('profile.interestsManage')}
              </Text>
            </Pressable>
          </View>
          {mobileGames.length > 0 && (
            <Text style={{ fontSize: 13, color: theme.colors.text2, marginTop: 8 }}>
              🎮 {t('profile.mobileGames.label')}: {mobileGames.join('、')}
            </Text>
          )}

          {/* 介绍声音 / Voice Intro */}
          <SectionTitle>{t('profile.voiceIntro.label')}</SectionTitle>
          {user.voiceIntroUrl ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: theme.colors.primarySoft }}>
                <VoicePlayButton url={user.voiceIntroUrl} size={18} color={theme.colors.primaryDeep} />
                <Text style={{ fontSize: 13, color: theme.colors.primaryDeep, fontWeight: '600' }}>0:05</Text>
              </View>
              <Pressable onPress={onDeleteVoice} disabled={voiceBusy} hitSlop={8}>
                <Text style={{ fontSize: 14, color: theme.colors.muted }}>{t('profile.voiceIntro.delete')}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => setVoiceRecorderOpen(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 11, borderRadius: 999, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.colors.line }}
            >
              <Mic size={16} color={theme.colors.primary} strokeWidth={2} />
              <Text style={{ fontSize: 14, color: theme.colors.text2 }}>{t('profile.voiceIntro.record')}</Text>
            </Pressable>
          )}

          {/* 高光时刻 — top-3 contest placements (renders nothing if none). */}
          <HighlightsSection userId={user.id} />

          {/* Prompts */}
          <SectionTitle>{t('profile.promptsTitle')}</SectionTitle>
          {prompts.length > 0 ? (
            prompts.map((p, i) => (
              <Card key={i} surface2 flat style={{ padding: 14, marginBottom: 10 }}>
                <Text style={{ fontSize: 12, color: theme.colors.muted, marginBottom: 6 }}>
                  {p.q}
                </Text>
                <Text
                  style={{
                    fontFamily: 'Fraunces',
                    fontStyle: 'italic',
                    fontWeight: '500',
                    fontSize: 15,
                    lineHeight: 23,
                    color: theme.colors.text,
                  }}
                >
                  &ldquo;{p.a}&rdquo;
                </Text>
              </Card>
            ))
          ) : (
            <Text style={{ color: theme.colors.muted, fontSize: 13 }}>
              {t('profile.promptsEmpty')}
            </Text>
          )}
          <Pressable onPress={() => nav.navigate('PromptsEdit')} style={{ marginTop: 6 }}>
            <Text style={{ color: theme.colors.primary, fontSize: 13.5, fontWeight: '500' }}>
              {t('profile.promptsAdd')}
            </Text>
          </Pressable>

          {/* About — bio + age inline. Auto-save on blur. */}
          <SectionTitle>{t('profile.edit.bio')}</SectionTitle>
          <TextInput
            value={bio}
            onChangeText={setBio}
            onEndEditing={saveBio}
            placeholder={t('profile.edit.bioPlaceholder')}
            placeholderTextColor={theme.colors.muted}
            maxLength={140}
            multiline
            style={[
              styles.inlineField,
              {
                color: theme.colors.text,
                borderColor: theme.colors.line,
                backgroundColor: theme.colors.surface,
                minHeight: 88,
                textAlignVertical: 'top',
              },
            ]}
          />
          <Text
            style={{
              marginTop: 4,
              fontSize: 11,
              color: theme.colors.muted,
              textAlign: 'right',
            }}
          >
            {bio.length} / 140
          </Text>

          <SectionTitle>{t('profile.edit.dob')}</SectionTitle>
          <View style={{ width: 200 }}>
            <DateField
              label={t('profile.edit.dob')}
              placeholder={t('profile.edit.dobHint')}
              value={parseYMD(dob)}
              onChange={onPickDob}
              minDate={new Date(dobNow.getFullYear() - 99, dobNow.getMonth(), dobNow.getDate())}
              maxDate={new Date(dobNow.getFullYear() - 18, dobNow.getMonth(), dobNow.getDate())}
              defaultDate={new Date(dobNow.getFullYear() - 25, dobNow.getMonth(), dobNow.getDate())}
            />
          </View>
          {/* Live "29 岁 · ♏ 天蝎" preview computed from the entered DOB. */}
          {(() => {
            const a = computeAge(dob);
            if (a == null) return null;
            const z = computeZodiac(dob);
            const label =
              t('about.stats.age', { n: a }) +
              (z ? ` · ${zodiacLabel(z, i18n.language)}` : '');
            return (
              <Text style={{ marginTop: 6, color: theme.colors.muted, fontSize: 13 }}>
                {label}
              </Text>
            );
          })()}

          {/* Height + Weight (both optional) */}
          <SectionTitle>{t('profile.edit.height')}</SectionTitle>
          <TextInput
            value={height}
            onChangeText={(v) => setHeight(v.replace(/\D/g, '').slice(0, 3))}
            onEndEditing={saveHeight}
            keyboardType="number-pad"
            maxLength={3}
            placeholder="cm"
            placeholderTextColor={theme.colors.muted}
            style={[
              styles.inlineField,
              { color: theme.colors.text, borderColor: theme.colors.line, backgroundColor: theme.colors.surface, width: 120 },
            ]}
          />

          <SectionTitle>{t('profile.edit.weight')}</SectionTitle>
          <TextInput
            value={weight}
            onChangeText={(v) => setWeight(v.replace(/\D/g, '').slice(0, 3))}
            onEndEditing={saveWeight}
            keyboardType="number-pad"
            maxLength={3}
            placeholder="kg"
            placeholderTextColor={theme.colors.muted}
            style={[
              styles.inlineField,
              { color: theme.colors.text, borderColor: theme.colors.line, backgroundColor: theme.colors.surface, width: 120 },
            ]}
          />

          {/* Body type — single-select chips, tap again to clear */}
          <SectionTitle>{t('profile.edit.bodyType')}</SectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {BODY_TYPES.map((id) => {
              const active = bodyType === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => pickBodyType(id)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 16,
                    paddingVertical: 9,
                    borderRadius: theme.radius.pill,
                    backgroundColor: active ? theme.colors.primarySoft : theme.colors.surface2,
                    borderWidth: active ? 0 : 1,
                    borderColor: theme.colors.line,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ fontSize: 14, fontWeight: '500', color: active ? theme.colors.primaryDeep : theme.colors.text2 }}>
                    {t(`profile.edit.bodyTypes.${id}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Relationship status — single select (tap again to clear) */}
          <SectionTitle>{t('profile.relationshipStatus.label')}</SectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {RELATIONSHIP_OPTIONS.map((id) => {
              const active = relationshipStatus === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => pickRelationship(id)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 16,
                    paddingVertical: 9,
                    borderRadius: theme.radius.pill,
                    backgroundColor: active ? theme.colors.primarySoft : theme.colors.surface2,
                    borderWidth: active ? 0 : 1,
                    borderColor: theme.colors.line,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ fontSize: 14, fontWeight: '500', color: active ? theme.colors.primaryDeep : theme.colors.text2 }}>
                    {t(`profile.relationshipStatus.${rsKey(id)}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* MBTI — single select 16 codes (tap again to clear) */}
          <SectionTitle>{t('profile.mbti.label')}</SectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {MBTI_TYPES.map((code) => {
              const active = mbti === code;
              return (
                <Pressable
                  key={code}
                  onPress={() => pickMbti(code)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: theme.radius.pill,
                    backgroundColor: active ? theme.colors.primarySoft : theme.colors.surface2,
                    borderWidth: active ? 0 : 1,
                    borderColor: theme.colors.line,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', letterSpacing: 0.5, color: active ? theme.colors.primaryDeep : theme.colors.text2 }}>
                    {code}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Intents — multi select */}
          <SectionTitle>{t('profile.intents.label')}</SectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {INTENT_OPTIONS.map((id) => {
              const active = intents.includes(id);
              return (
                <Pressable
                  key={id}
                  onPress={() => toggleIntent(id)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 16,
                    paddingVertical: 9,
                    borderRadius: theme.radius.pill,
                    backgroundColor: active ? theme.colors.primarySoft : theme.colors.surface2,
                    borderWidth: active ? 0 : 1,
                    borderColor: theme.colors.line,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ fontSize: 14, fontWeight: '500', color: active ? theme.colors.primaryDeep : theme.colors.text2 }}>
                    {t(`profile.intents.${id}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* City (optional, free text) */}
          <SectionTitle>{t('profile.edit.city')}</SectionTitle>
          <TextInput
            value={city}
            onChangeText={setCity}
            onEndEditing={saveCity}
            placeholder={t('profile.edit.cityPlaceholder')}
            placeholderTextColor={theme.colors.muted}
            maxLength={40}
            style={[
              styles.inlineField,
              { color: theme.colors.text, borderColor: theme.colors.line, backgroundColor: theme.colors.surface },
            ]}
          />

          {/* Invite friends — mutual Premium reward (viral growth hook). */}
          <Pressable
            onPress={() => nav.navigate('InviteFriends')}
            style={({ pressed }) => [
              styles.inviteCard,
              { backgroundColor: theme.colors.primarySoft, opacity: pressed ? 0.92 : 1 },
            ]}
          >
            <Gift size={24} color={theme.colors.primaryDeep} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: theme.colors.primaryDeep }}>
                {t('invite.cardTitle')}
              </Text>
              <Text style={{ fontSize: 12.5, color: theme.colors.primaryDeep, marginTop: 2, opacity: 0.85 }}>
                {t('invite.reward')}
              </Text>
            </View>
            <ChevronRight size={20} color={theme.colors.primaryDeep} />
          </Pressable>

          {/* Settings */}
          <SectionTitle>{t('profile.settingsTitle')}</SectionTitle>
          <Card flat style={{ paddingVertical: 4 }}>
            <SettingsRow
              icon={<Crown size={18} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
              label={t('profile.rows.premium')}
              detail={
                (user as any).isPremium
                  ? t('profile.rows.premiumActive')
                  : t('profile.rows.premiumUpgrade')
              }
              onPress={() => nav.navigate('Premium')}
            />
            <Divider />
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
              detail={
                i18n.language.startsWith('zh')
                  ? t('profile.rows.languageValueZh')
                  : t('profile.rows.languageValueEn')
              }
              onPress={() => nav.navigate('LanguageSettings')}
            />
            <Divider />
            <SettingsRow
              icon={<ShieldCheck size={18} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
              label={t('profile.rows.account')}
              onPress={() => nav.navigate('AccountSettings')}
            />
            {isAdmin && (
              <>
                <Divider />
                <SettingsRow
                  icon={<Megaphone size={18} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
                  label={t('profile.rows.announcementAdmin')}
                  onPress={() => nav.navigate('AnnouncementAdmin')}
                />
              </>
            )}
          </Card>

          <Text
            style={{
              textAlign: 'center',
              marginTop: 32,
              color: theme.colors.muted,
              fontSize: 11.5,
            }}
          >
            Meyou · v2.0.0
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <TopicPickerSheet
        open={topicPickerOpen}
        onClose={() => setTopicPickerOpen(false)}
        onPick={(tp) => {
          setTopicPickerOpen(false);
          nav.navigate('TopicPersonaEdit', {
            topicSlug: tp.slug,
            topicName: tp.name[personaLocale] ?? tp.name.en ?? tp.slug,
            topicIcon: tp.icon,
          });
        }}
      />
      <VoiceRecorderSheet
        open={voiceRecorderOpen}
        onClose={() => setVoiceRecorderOpen(false)}
        onSaved={(voiceIntroUrl) => setUser({ ...user!, voiceIntroUrl })}
      />
      <UpgradePremiumSheet open={upsellOpen} onClose={() => setUpsellOpen(false)} reason={t('premium.upsell.profile80')} />
      {photoViewer.node}
    </SafeAreaView>
  );
}

function Stat({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string | number;
  onPress?: () => void;
}) {
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
      <Text
        numberOfLines={1}
        style={{ fontSize: 11, color: theme.colors.muted, marginTop: 4 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Text
      style={{
        fontSize: 12,
        color: theme.colors.muted,
        letterSpacing: 0.72,
        textTransform: 'uppercase',
        marginTop: 24,
        marginBottom: 12,
      }}
    >
      {children}
    </Text>
  );
}

function SettingsRow({
  icon,
  label,
  detail,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  detail?: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 14,
        gap: 12,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 9,
          backgroundColor: theme.colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
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
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.line,
        marginHorizontal: 14,
      }}
    />
  );
}

const styles = StyleSheet.create({
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
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
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
  },
  avatarSpinner: {
    borderRadius: 48,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 6,
    marginTop: 14,
    paddingLeft: 8,
    paddingRight: 6,
    paddingBottom: 2,
    borderBottomWidth: 1.5,
  },
  nicknameInput: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    minWidth: 80,
    paddingVertical: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 18,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 0,
  },
  inlineField: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
});
