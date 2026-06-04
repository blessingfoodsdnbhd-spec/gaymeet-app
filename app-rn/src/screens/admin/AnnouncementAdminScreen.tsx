import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Switch,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ChevronLeft, Trash2, Plus, ImagePlus } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../components/Card';
import { AnnouncementCard } from '../../components/AnnouncementModal';
import { DateTimeField } from '../../components/DateTimeField';
import { uploadFile } from '../../api/upload';
import {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  type AdminAnnouncement,
  type AnnouncementInput,
} from '../../api/admin';

const QK = ['admin', 'announcements'] as const;

export function AnnouncementAdminScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation();
  const qc = useQueryClient();

  const listQ = useQuery({ queryKey: QK, queryFn: listAnnouncements });

  // ── Create form state ──────────────────────────────────────────────────────
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [ctaUrl, setCtaUrl] = useState('');
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [endsAt, setEndsAt] = useState<Date | null>(null);
  const [justPublished, setJustPublished] = useState(false);

  const resetForm = () => {
    setImageUrl('');
    setCtaUrl('');
    setTitle('');
    setStartsAt(null);
    setEndsAt(null);
  };

  const errAlert = (e: any) => {
    const status = e?.response?.status;
    const detail =
      e?.response?.data?.error || e?.response?.data?.message || e?.message || 'unknown';
    Alert.alert(t('admin.error'), `${detail}${status ? ` (HTTP ${status})` : ''}`);
  };

  // ── Image picker → upload → imageUrl ───────────────────────────────────────
  const doPick = async (source: 'camera' | 'gallery') => {
    try {
      let res: ImagePicker.ImagePickerResult;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (perm.status !== 'granted') {
          Alert.alert(t('profile.edit.photoPermTitle'), t('profile.edit.photoPermBody'));
          return;
        }
        res = await ImagePicker.launchCameraAsync({ quality: 0.85 });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm.status !== 'granted') {
          Alert.alert(t('profile.edit.photoPermTitle'), t('profile.edit.photoPermBody'));
          return;
        }
        res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.85,
        });
      }
      if (res.canceled) return;
      setUploading(true);
      const url = await uploadFile(res.assets[0].uri);
      setImageUrl(url);
    } catch (e) {
      errAlert(e);
    } finally {
      setUploading(false);
    }
  };

  const pickImage = () => {
    if (uploading) return;
    Alert.alert(t('admin.ann.pickImage'), undefined, [
      { text: t('admin.ann.camera'), onPress: () => doPick('camera') },
      { text: t('admin.ann.gallery'), onPress: () => doPick('gallery') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const createMut = useMutation({
    mutationFn: (input: AnnouncementInput) => createAnnouncement(input),
    onSuccess: () => {
      resetForm();
      qc.invalidateQueries({ queryKey: QK });
      setJustPublished(true);
      setTimeout(() => setJustPublished(false), 2200);
    },
    onError: errAlert,
  });

  const toggleMut = useMutation({
    mutationFn: (a: AdminAnnouncement) =>
      updateAnnouncement(a._id, { isActive: !a.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
    onError: errAlert,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteAnnouncement(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
    onError: errAlert,
  });

  const onSubmit = () => {
    if (!imageUrl.trim()) {
      Alert.alert(t('admin.error'), t('admin.ann.imageUrlRequired'));
      return;
    }
    createMut.mutate({
      imageUrl: imageUrl.trim(),
      ctaUrl: ctaUrl.trim() || null,
      title: title.trim() || null,
      startsAt: startsAt ? startsAt.toISOString() : null,
      endsAt: endsAt ? endsAt.toISOString() : null,
    });
  };

  const onDelete = (a: AdminAnnouncement) => {
    Alert.alert(t('admin.ann.deleteTitle'), t('admin.ann.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('admin.ann.delete'),
        style: 'destructive',
        onPress: () => deleteMut.mutate(a._id),
      },
    ]);
  };

  const field = (
    label: string,
    value: string,
    onChangeText: (v: string) => void,
    placeholder: string,
    extra?: { keyboardType?: 'url' | 'default' },
  ) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={[styles.label, { color: theme.colors.text2 }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={extra?.keyboardType === 'url' ? 'url' : 'default'}
        style={[
          styles.input,
          {
            color: theme.colors.text,
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.line,
          },
        ]}
      />
    </View>
  );

  const canPublish = !!imageUrl.trim() && !uploading && !createMut.isPending;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ marginLeft: 8, fontSize: 18, fontWeight: '600', color: theme.colors.text }}>
          {t('admin.ann.title')}
        </Text>
      </View>

      {justPublished && (
        <View style={[styles.toast, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.toastText}>{t('admin.ann.published')}</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <Card>
          <View style={{ padding: 14 }}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              {t('admin.ann.newTitle')}
            </Text>

            {/* Image picker */}
            <Text style={[styles.label, { color: theme.colors.text2 }]}>
              {t('admin.ann.image')}
            </Text>
            {imageUrl ? (
              <View style={{ marginBottom: 12 }}>
                <ExpoImage source={{ uri: imageUrl }} style={styles.imagePreview} contentFit="cover" />
                <Pressable onPress={pickImage} disabled={uploading} style={styles.changeBtn}>
                  {uploading ? (
                    <ActivityIndicator color={theme.colors.primary} />
                  ) : (
                    <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>
                      {t('admin.ann.changeImage')}
                    </Text>
                  )}
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={pickImage}
                disabled={uploading}
                style={[styles.imageDrop, { borderColor: theme.colors.line }]}
              >
                {uploading ? (
                  <ActivityIndicator color={theme.colors.primary} />
                ) : (
                  <>
                    <ImagePlus size={26} color={theme.colors.muted} />
                    <Text style={{ color: theme.colors.muted, marginTop: 6, fontSize: 13 }}>
                      {t('admin.ann.pickImage')}
                    </Text>
                  </>
                )}
              </Pressable>
            )}

            {field(t('admin.ann.ctaUrl'), ctaUrl, setCtaUrl, 'https://meyou.uk/promo', {
              keyboardType: 'url',
            })}
            {field(t('admin.ann.ctaTitle'), title, setTitle, t('admin.ann.ctaTitlePh'))}

            <DateTimeField label={t('admin.ann.startsAt')} value={startsAt} onChange={setStartsAt} />
            <DateTimeField label={t('admin.ann.endsAt')} value={endsAt} onChange={setEndsAt} />
            <Text style={[styles.hint, { color: theme.colors.muted }]}>
              {t('admin.ann.dateHint')}
            </Text>

            {/* Live preview */}
            {!!imageUrl && (
              <View style={{ marginTop: 4, marginBottom: 12 }}>
                <Text style={[styles.label, { color: theme.colors.text2 }]}>
                  {t('admin.ann.preview')}
                </Text>
                <View style={styles.previewStage}>
                  <AnnouncementCard
                    imageUrl={imageUrl}
                    title={title.trim() || null}
                    ctaUrl={ctaUrl.trim() || null}
                    width={200}
                  />
                </View>
              </View>
            )}

            <Pressable
              onPress={onSubmit}
              disabled={!canPublish}
              style={[
                styles.submitBtn,
                { backgroundColor: theme.colors.primary, opacity: canPublish ? 1 : 0.5 },
              ]}
            >
              {createMut.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Plus size={18} color="#fff" strokeWidth={2} />
                  <Text style={styles.submitText}>{t('admin.ann.publish')}</Text>
                </>
              )}
            </Pressable>
          </View>
        </Card>

        {/* ── Existing list ── */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text, marginLeft: 4 }]}>
          {t('admin.ann.existing')}
        </Text>

        {listQ.isLoading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 16 }} />
        ) : listQ.isError ? (
          <Pressable onPress={() => listQ.refetch()}>
            <Text style={{ color: theme.colors.danger, textAlign: 'center' }}>
              {t('admin.ann.loadFailed')}
            </Text>
          </Pressable>
        ) : (listQ.data ?? []).length === 0 ? (
          <Text style={{ color: theme.colors.muted, textAlign: 'center', marginTop: 8 }}>
            {t('admin.ann.empty')}
          </Text>
        ) : (
          (listQ.data ?? []).map((a) => (
            <Card key={a._id}>
              <View style={{ padding: 12, flexDirection: 'row', gap: 12 }}>
                <ExpoImage source={{ uri: a.imageUrl }} style={styles.thumb} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: theme.colors.text, fontWeight: '600' }}>
                    {a.title || t('admin.ann.untitled')}
                  </Text>
                  <Text numberOfLines={1} style={{ color: theme.colors.muted, fontSize: 12, marginTop: 2 }}>
                    {a.ctaUrl || t('admin.ann.noLink')}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 10 }}>
                    <Switch
                      value={a.isActive}
                      onValueChange={() => toggleMut.mutate(a)}
                      trackColor={{ false: theme.colors.line, true: theme.colors.primary }}
                      ios_backgroundColor={theme.colors.line}
                    />
                    <Text style={{ color: a.isActive ? theme.colors.primary : theme.colors.muted, fontSize: 13 }}>
                      {a.isActive ? t('admin.ann.active') : t('admin.ann.inactive')}
                    </Text>
                    <View style={{ flex: 1 }} />
                    <Pressable onPress={() => onDelete(a)} hitSlop={8}>
                      <Trash2 size={18} color={theme.colors.danger} strokeWidth={1.8} />
                    </Pressable>
                  </View>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  label: { fontSize: 12, marginBottom: 6, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  hint: { fontSize: 11, marginTop: -4, marginBottom: 12, lineHeight: 15 },
  imageDrop: {
    height: 130,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  imagePreview: { width: '100%', height: 160, borderRadius: 12, backgroundColor: '#0002' },
  changeBtn: { alignSelf: 'center', paddingVertical: 8, marginTop: 6 },
  previewStage: {
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 4,
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  thumb: { width: 64, height: 80, borderRadius: 8, backgroundColor: '#0002' },
  toast: {
    marginHorizontal: 20,
    marginBottom: 4,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  toastText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
