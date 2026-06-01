import React, { useState } from 'react';
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
  Globe,
  Lock,
  ShieldCheck,
  Settings as SettingsIcon,
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
import { PhotoGridEditor } from '../../components/PhotoGridEditor';
import { tagById, type InterestTagId } from '../../data/interestTags';
import { TopicPickerSheet } from './TopicPickerSheet';
import { getMyPersonas, updatePersona } from '../../api/mePersonas';
import { getTopics, type Topic } from '../../api/topics';
import { uploadFile } from '../../api/upload';
import { getIncomingUnlocks } from '../../api/topicUnlocks';
import { useAuth } from '../../store/auth';
import { getMyStats, patchMe } from '../../api/me';
import { uploadProfilePhoto, deleteProfilePhoto } from '../../api/upload';
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

  // Inline editable fields — local state, auto-saved onEndEditing.
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [age, setAge] = useState(user?.age != null ? String(user.age) : '');

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

  // Self's private photo URLs. Backend special-cases self → returns the
  // real URLs with status='owner'. toPublicJSON strips these from /me.
  const myPrivatePhotosQ = useQuery({
    queryKey: ['me', 'privatePhotos'],
    queryFn: () => getPrivatePhotos(user!.id),
    enabled: !!user,
    staleTime: 60_000,
  });
  const privatePhotos = myPrivatePhotosQ.data?.photos ?? [];

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
    mutationFn: (patch: { nickname?: string; bio?: string; age?: number }) => patchMe(patch),
    onSuccess: (updated) => setUser(updated),
    onError: (e: any) => {
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
  const saveAge = () => {
    const n = age ? parseInt(age, 10) : undefined;
    if (n === user.age) return;
    if (n !== undefined && (isNaN(n) || n < 18 || n > 99)) return;
    saveMut.mutate({ age: n });
  };

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
    const uri = await pickFromLibrary();
    if (!uri) return;
    setPublicBusy(true);
    try {
      const r = await uploadProfilePhoto(uri);
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
        right={
          <>
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

            <TextInput
              value={nickname}
              onChangeText={setNickname}
              onEndEditing={saveNickname}
              placeholder={t('profile.edit.nickname')}
              placeholderTextColor={theme.colors.muted}
              maxLength={30}
              style={[styles.nicknameInput, { color: theme.colors.text }]}
            />
          </View>

          {/* Stats — 5 tiles. Tap any to drill into the corresponding list. */}
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
              label={t('profile.stats.friends')}
              value={fmt(stats?.following)}
              onPress={() => nav.navigate('FriendsList')}
            />
            <Stat
              label={t('profile.stats.moments')}
              value={fmt(stats?.moments)}
              onPress={() => nav.navigate('MyMoments')}
            />
            <Stat
              label={t('profile.stats.privatePhotos')}
              value={fmt(approvedQ.data?.count)}
              onPress={() => nav.navigate('PhotoRequests')}
            />
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
          />

          {/* Private photos */}
          <SectionTitle>
            {t('profile.privatePhotosLimit', { count: privatePhotos.length })}
          </SectionTitle>
          <PhotoGridEditor
            photos={privatePhotos}
            max={PHOTO_MAX}
            busy={privateBusy || myPrivatePhotosQ.isLoading}
            onAdd={addPrivatePhoto}
            onRemove={removePrivatePhoto}
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

          {/* Topic Personas — each row jumps into the edit screen for
              its slug; the "+" CTA opens the TopicPickerSheet to choose
              a new topic to join. Backend caps the number of active
              personas (Free 2 / Premium 8); we don't enforce client-
              side so the limit-reached path surfaces a real 402 alert
              from the edit-screen save mutation.
              Order: sits directly under the Private Photos block per
              user feedback — topics are now more central than the
              interests tags, so they get prime real estate. */}
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

          <SectionTitle>{t('profile.edit.age')}</SectionTitle>
          <TextInput
            value={age}
            onChangeText={(v) => setAge(v.replace(/\D/g, '').slice(0, 2))}
            onEndEditing={saveAge}
            keyboardType="number-pad"
            maxLength={2}
            style={[
              styles.inlineField,
              {
                color: theme.colors.text,
                borderColor: theme.colors.line,
                backgroundColor: theme.colors.surface,
                width: 90,
              },
            ]}
          />

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
  avatarSpinner: {
    borderRadius: 48,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nicknameInput: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 14,
    textAlign: 'center',
    minWidth: 120,
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
