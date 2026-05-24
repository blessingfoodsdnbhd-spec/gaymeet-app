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
  StyleSheet,
  ActionSheetIOS,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { ChevronLeft, ImagePlus, X } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';
import { postMoment } from '../../api/moments';
import { uploadFile } from '../../api/upload';

const MAX_PHOTOS = 9;
const MAX_CONTENT = 500;

export function ComposerScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  // Note: a per-moment interest tag picker used to live here, but the
  // backend Moment schema has no `tag` field and the 'interest' feed
  // filter matches by the *author's* shared interests, not a per-post
  // tag. Selecting a tag in the UI did nothing. Removed to stop misleading
  // users; if per-post tags become a real feature, wire them through
  // schema + POST handler + feed filter end-to-end.

  const submitMut = useMutation({
    mutationFn: async () => {
      // Upload all picked photos to /api/upload, get back permanent URLs.
      // Skip URIs that already look like https — they're already uploaded.
      const uploadedUrls: string[] = [];
      for (const uri of photos) {
        if (/^https?:\/\//.test(uri)) {
          uploadedUrls.push(uri);
          continue;
        }
        try {
          const url = await uploadFile(uri);
          uploadedUrls.push(url);
        } catch (e: any) {
          // Annotate the error with which upload stage failed
          const wrapped: any = new Error(`upload failed: ${e?.message ?? e}`);
          wrapped.stage = 'upload';
          wrapped.uri = uri;
          wrapped.response = e?.response;
          throw wrapped;
        }
      }
      return postMoment({
        content: content.trim(),
        images: uploadedUrls,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moments'] });
      nav.goBack();
    },
    onError: (e: any) => {
      const stage = e?.stage ?? 'post';
      const status = e?.response?.status;
      const body = e?.response?.data;
      const detail = body?.error || body?.message || e?.message || 'unknown';
      console.warn('moments publish failed', { stage, status, body, error: e });
      Alert.alert(
        t('moments.composer.sendFailed'),
        `[${stage}] ${detail}${status ? ` (HTTP ${status})` : ''}`,
      );
    },
  });

  // Launch the OS image picker against the library. Multi-select up to
  // the remaining slot count (MAX_PHOTOS - current).
  const pickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('moments.composer.photoPermTitle'), t('moments.composer.photoPermBody'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
      quality: 0.8,
    });
    if (result.canceled) return;
    const uris = result.assets.map((a) => a.uri);
    setPhotos([...photos, ...uris].slice(0, MAX_PHOTOS));
  };

  // Open the device camera and append the captured photo. One shot per
  // tap — the camera UI doesn't have a multi-capture mode.
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('moments.cameraPermTitle'), t('moments.cameraPermBody'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });
    if (result.canceled) return;
    const uri = result.assets[0]?.uri;
    if (uri) setPhotos([...photos, uri].slice(0, MAX_PHOTOS));
  };

  // Source picker — show an action sheet on iOS, fall back to a chained
  // Alert on Android. Either route lets the user take a new photo OR
  // pick existing ones from the library. Backend accepts up to 9 images
  // per moment (Moment.images schema + routes/moments.js POST handler),
  // so we keep MAX_PHOTOS in sync.
  const onAddPhotoTap = () => {
    if (photos.length >= MAX_PHOTOS) return;
    const opts = [
      t('moments.composer.takePhoto'),
      t('moments.composer.chooseFromLibrary'),
      t('moments.composer.cancel'),
    ];
    const handle = (idx: number) => {
      if (idx === 0) takePhoto();
      else if (idx === 1) pickFromLibrary();
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: t('moments.composer.addPhotoTitle'),
          options: opts,
          cancelButtonIndex: 2,
          userInterfaceStyle: 'light',
        },
        handle,
      );
    } else {
      // Android fallback — Alert with two action buttons + cancel.
      Alert.alert(
        t('moments.composer.addPhotoTitle'),
        undefined,
        [
          { text: opts[0], onPress: () => handle(0) },
          { text: opts[1], onPress: () => handle(1) },
          { text: opts[2], style: 'cancel' },
        ],
      );
    }
  };

  const removeAt = (i: number) => setPhotos(photos.filter((_, j) => j !== i));

  const canSubmit = (content.trim().length > 0 || photos.length > 0) && !submitMut.isPending;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 10,
          justifyContent: 'space-between',
        }}
      >
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.text }}>
          {t('moments.composer.headerTitle')}
        </Text>
        <Pressable
          onPress={() => canSubmit && submitMut.mutate()}
          disabled={!canSubmit}
          hitSlop={8}
        >
          <Text
            style={{
              color: canSubmit ? theme.colors.primary : theme.colors.muted,
              fontSize: 14,
              fontWeight: '600',
            }}
          >
            {t('moments.composer.publish')}
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder={t('moments.composer.contentPlaceholder')}
            placeholderTextColor={theme.colors.muted}
            multiline
            maxLength={MAX_CONTENT}
            style={{
              fontSize: 16,
              lineHeight: 24,
              color: theme.colors.text,
              minHeight: 120,
              paddingTop: 8,
              paddingBottom: 8,
              textAlignVertical: 'top',
            }}
          />
          <Text style={{ alignSelf: 'flex-end', fontSize: 11, color: theme.colors.muted }}>
            {content.length} / {MAX_CONTENT}
          </Text>

          {/* Photo grid */}
          {(photos.length > 0 || photos.length < MAX_PHOTOS) && (
            <View style={styles.photoGrid}>
              {photos.map((uri, i) => (
                <View key={uri + i} style={styles.photoTile}>
                  <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
                  <Pressable
                    onPress={() => removeAt(i)}
                    style={[styles.removeBtn, { backgroundColor: 'rgba(0,0,0,0.6)' }]}
                  >
                    <X size={14} color="#FFFFFF" strokeWidth={2.4} />
                  </Pressable>
                </View>
              ))}
              {photos.length < MAX_PHOTOS && (
                <Pressable
                  onPress={onAddPhotoTap}
                  style={[
                    styles.photoTile,
                    {
                      backgroundColor: theme.colors.surface2,
                      borderWidth: 1,
                      borderColor: theme.colors.line,
                      borderStyle: 'dashed',
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                  ]}
                >
                  <ImagePlus size={28} color={theme.colors.muted} strokeWidth={1.6} />
                </Pressable>
              )}
            </View>
          )}

        </ScrollView>

        <View style={{ padding: 20 }}>
          <Button
            label={t('moments.composer.publishCta')}
            onPress={() => submitMut.mutate()}
            disabled={!canSubmit}
            loading={submitMut.isPending}
            fullWidth
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  photoTile: {
    width: '31.5%',
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
