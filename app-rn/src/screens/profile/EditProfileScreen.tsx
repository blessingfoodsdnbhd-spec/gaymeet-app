import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Lock, Plus, X } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';
import { Avatar } from '../../components/Avatar';
import { useAuth } from '../../store/auth';
import { patchMe } from '../../api/me';
import { uploadProfilePhoto, deleteProfilePhoto } from '../../api/upload';
import {
  uploadPrivatePhoto,
  deletePrivatePhoto,
  getPrivatePhotos,
  getApprovedCount,
  relockAll,
} from '../../api/privatePhotos';

const PHOTO_MAX = 5;

export function EditProfileScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const queryClient = useQueryClient();

  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [age, setAge] = useState(user?.age != null ? String(user.age) : '');
  const [busy, setBusy] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [publicBusy, setPublicBusy] = useState(false);
  const [privateBusy, setPrivateBusy] = useState(false);

  // Self-private-photos lookup. Backend special-cases self → returns the
  // real URLs with status='owner'. toPublicJSON strips the URLs from /me,
  // so we hit this dedicated endpoint instead.
  const myPrivatePhotosQ = useQuery({
    queryKey: ['me', 'privatePhotos'],
    queryFn: () => getPrivatePhotos(user!.id),
    enabled: !!user,
    staleTime: 60_000,
  });
  const privatePhotos = myPrivatePhotosQ.data?.photos ?? [];

  // Active-viewer count drives the "Revoke all" CTA copy.
  const approvedQ = useQuery({
    queryKey: ['photoRequests', 'approvedCount'],
    queryFn: getApprovedCount,
    enabled: !!user,
    staleTime: 30_000,
  });
  const approvedCount = approvedQ.data?.count ?? 0;

  const relockMut = useMutation({
    mutationFn: relockAll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photoRequests', 'approvedCount'] });
      queryClient.invalidateQueries({ queryKey: ['photoRequests', 'inbox'] });
    },
  });

  const pickAvatar = async () => {
    if (uploadingAvatar) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('profile.edit.photoPermTitle'), t('profile.edit.photoPermBody'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;
    setUploadingAvatar(true);
    try {
      // Server response already has the fresh avatarUrl + photos[] —
      // use it directly instead of a second getMe() round-trip that
      // could fail and stall the UI update.
      const result2 = await uploadProfilePhoto(result.assets[0].uri);
      if (user) {
        setUser({
          ...user,
          avatarUrl: result2.avatarUrl ?? user.avatarUrl,
          photos: result2.photos ?? user.photos,
        });
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const body = e?.response?.data;
      const detail = body?.error || body?.message || e?.message || 'unknown';
      Alert.alert(t('profile.edit.uploadFailed'), `${detail}${status ? ` (HTTP ${status})` : ''}`);
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Pick + upload helpers shared between public and private grids. Returns
  // the picked asset's URI or null if the user cancelled / permission denied.
  const pickFromLibrary = async (): Promise<string | null> => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert(t('profile.edit.photoPermTitle'), t('profile.edit.photoPermBody'));
      return null;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    return res.canceled ? null : res.assets[0].uri;
  };

  const addPublicPhoto = async () => {
    if (publicBusy) return;
    const uri = await pickFromLibrary();
    if (!uri) return;
    setPublicBusy(true);
    try {
      // Use primary=false (append, not swap) when there's already an
      // avatar — the user clicked the gallery slot, not "change avatar".
      // uploadProfilePhoto always sends primary=1; for append we'd need
      // a separate call. Keep it simple for now: the first upload sets
      // the avatar, subsequent uploads still prepend (visually the user
      // sees the newest photo as the avatar, which matches most apps).
      const r = await uploadProfilePhoto(uri);
      if (user) setUser({ ...user, avatarUrl: r.avatarUrl, photos: r.photos });
    } catch (e: any) {
      // Surface a rich error so users (and us via console logs) actually
      // see what failed — bare e.message is often empty on RN network
      // errors. Include the HTTP status when present.
      console.error('[upload-public] failed', {
        uri,
        status: e?.response?.status,
        data: e?.response?.data,
        message: e?.message,
        code: e?.code,
      });
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.error ||
        e?.message ||
        (status ? `HTTP ${status}` : 'network error');
      Alert.alert(
        t('profile.photoUploadFailed'),
        `${detail}${status ? ` (HTTP ${status})` : ''}`,
      );
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
            if (user) setUser({ ...user, avatarUrl: r.avatarUrl, photos: r.photos });
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
      // Local user count tracks new size for the public profile shape.
      if (user) {
        setUser({
          ...user,
          privatePhotosCount: (user.privatePhotosCount ?? 0) + 1,
        });
      }
    } catch (e: any) {
      console.error('[upload-private] failed', {
        uri,
        status: e?.response?.status,
        data: e?.response?.data,
        message: e?.message,
        code: e?.code,
      });
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.error ||
        e?.message ||
        (status ? `HTTP ${status}` : 'network error');
      Alert.alert(
        t('profile.photoUploadFailed'),
        `${detail}${status ? ` (HTTP ${status})` : ''}`,
      );
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
            if (user) {
              setUser({
                ...user,
                privatePhotosCount: Math.max(0, (user.privatePhotosCount ?? 1) - 1),
              });
            }
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

  const onSave = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await patchMe({
        nickname: nickname.trim() || undefined,
        bio: bio.trim(),
        age: age ? parseInt(age, 10) : undefined,
      });
      setUser(updated);
      nav.goBack();
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.error || e?.response?.data?.message || e?.message || 'unknown';
      Alert.alert(t('profile.edit.saveFailed'), `${detail}${status ? ` (HTTP ${status})` : ''}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 10,
        }}
      >
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ marginLeft: 8, fontSize: 18, fontWeight: '600', color: theme.colors.text }}>
          {t('profile.edit.title')}
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          <View style={{ alignItems: 'center', marginTop: 12, marginBottom: 24 }}>
            <Pressable onPress={pickAvatar} disabled={uploadingAvatar}>
              <Avatar
                name={nickname || user?.nickname}
                uri={user?.avatarUrl}
                avatarIdx={0}
                size={88}
              />
              {uploadingAvatar && (
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: 88,
                    height: 88,
                    borderRadius: 44,
                    backgroundColor: 'rgba(0,0,0,0.45)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ActivityIndicator color="#FFFFFF" />
                </View>
              )}
            </Pressable>
            <Pressable onPress={pickAvatar} disabled={uploadingAvatar} style={{ marginTop: 12 }}>
              <Text style={{ color: theme.colors.primary, fontSize: 14, fontWeight: '500' }}>
                {t('profile.edit.changeAvatar')}
              </Text>
            </Pressable>
          </View>

          {/* Public photos grid — 5 slots */}
          <SectionHeader>
            {t('profile.publicPhotosLimit', { count: user?.photos?.length ?? 0 })}
          </SectionHeader>
          <PhotoGrid
            photos={user?.photos ?? []}
            max={PHOTO_MAX}
            busy={publicBusy}
            onAdd={addPublicPhoto}
            onRemove={removePublicPhoto}
          />

          {/* Private photos grid — 5 slots, lock UX */}
          <SectionHeader>
            {t('profile.privatePhotosLimit', { count: privatePhotos.length })}
          </SectionHeader>
          <PhotoGrid
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
                marginTop: 12,
                paddingVertical: 10,
                opacity: pressed || relockMut.isPending ? 0.55 : 1,
              })}
            >
              <Text
                style={{
                  color: theme.colors.primary,
                  fontSize: 14,
                  fontWeight: '500',
                }}
              >
                {t('profile.revokeAllAccess', { n: approvedCount })}
              </Text>
            </Pressable>
          )}

          <Label>{t('profile.edit.nickname')}</Label>
          <Field value={nickname} onChangeText={setNickname} maxLength={30} />

          <Label>{t('profile.edit.bio')}</Label>
          <Field
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={140}
            minHeight={88}
            placeholder={t('profile.edit.bioPlaceholder')}
          />
          <Text style={{ marginTop: 4, fontSize: 11, color: theme.colors.muted, textAlign: 'right' }}>
            {bio.length} / 140
          </Text>

          <Label>{t('profile.edit.age')}</Label>
          <Field
            value={age}
            onChangeText={(v) => setAge(v.replace(/\D/g, '').slice(0, 2))}
            keyboardType="number-pad"
            maxLength={2}
          />
        </ScrollView>

        <View style={{ padding: 20 }}>
          <Button label={t('common.save')} loading={busy} onPress={onSave} fullWidth />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Text
      style={{
        fontSize: 12,
        color: theme.colors.muted,
        letterSpacing: 0.72,
        textTransform: 'uppercase',
        marginTop: 24,
        marginBottom: 10,
      }}
    >
      {children}
    </Text>
  );
}

/**
 * 5-slot photo grid. Each filled slot shows a thumbnail with an X to
 * remove; each empty slot up to `max` shows a + to pick + upload. Beyond
 * `max` no more empty cells are rendered. The badgeIcon (e.g. a tiny
 * Lock) appears in the corner of each filled slot — used for the
 * private gallery.
 */
function PhotoGrid({
  photos,
  max,
  busy,
  onAdd,
  onRemove,
  badgeIcon,
}: {
  photos: string[];
  max: number;
  busy: boolean;
  onAdd: () => void;
  onRemove: (url: string) => void;
  badgeIcon?: React.ReactNode;
}) {
  const theme = useTheme();
  const slots: Array<{ kind: 'photo' | 'add' | 'empty'; url?: string }> = [];
  for (let i = 0; i < max; i++) {
    if (i < photos.length) slots.push({ kind: 'photo', url: photos[i] });
    else if (i === photos.length) slots.push({ kind: 'add' });
    else slots.push({ kind: 'empty' });
  }
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {slots.map((s, i) => {
        const common = {
          flex: 1,
          aspectRatio: 1,
          borderRadius: 10,
          overflow: 'hidden' as const,
          backgroundColor: theme.colors.surface2,
        };
        if (s.kind === 'photo' && s.url) {
          return (
            <View key={`p-${s.url}`} style={common}>
              <ExpoImage
                source={{ uri: s.url }}
                style={StyleSheet.absoluteFill}
                cachePolicy="memory-disk"
                contentFit="cover"
              />
              <Pressable
                onPress={() => onRemove(s.url!)}
                hitSlop={6}
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={12} color="#FFFFFF" strokeWidth={2.4} />
              </Pressable>
              {badgeIcon && (
                <View
                  style={{
                    position: 'absolute',
                    bottom: 4,
                    left: 4,
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {badgeIcon}
                </View>
              )}
            </View>
          );
        }
        if (s.kind === 'add') {
          return (
            <Pressable
              key={`add-${i}`}
              onPress={onAdd}
              disabled={busy}
              style={[
                common,
                {
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1.5,
                  borderStyle: 'dashed',
                  borderColor: theme.colors.line,
                  opacity: busy ? 0.5 : 1,
                },
              ]}
            >
              {busy ? (
                <ActivityIndicator color={theme.colors.muted} />
              ) : (
                <Plus size={20} color={theme.colors.muted} strokeWidth={1.8} />
              )}
            </Pressable>
          );
        }
        return <View key={`e-${i}`} style={common} />;
      })}
    </View>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Text
      style={{
        fontSize: 13,
        color: theme.colors.muted,
        marginBottom: 8,
        marginTop: 14,
      }}
    >
      {children}
    </Text>
  );
}

function Field({
  multiline,
  minHeight,
  ...rest
}: React.ComponentProps<typeof TextInput> & { minHeight?: number }) {
  const theme = useTheme();
  return (
    <TextInput
      multiline={multiline}
      placeholderTextColor={theme.colors.muted}
      style={{
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.line,
        borderRadius: theme.radius.m,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 15,
        color: theme.colors.text,
        minHeight: multiline ? minHeight ?? 88 : undefined,
        textAlignVertical: multiline ? 'top' : 'auto',
      }}
      {...rest}
    />
  );
}
