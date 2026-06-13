import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Platform,
  Alert,
  StyleSheet,
  ActionSheetIOS,
  InteractionManager,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { ChevronLeft, ImagePlus, X, Users, MapPin, Clock } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';
import { FriendPickerSheet, type TagPick } from '../../components/FriendPickerSheet';
import { MomentLocationSheet, type MomentPlace } from '../../components/MomentLocationSheet';
import { openSheetAfterKeyboardDismiss } from '../../utils/keyboardSheet';
import { postMoment } from '../../api/moments';
import { uploadFile } from '../../api/upload';
import { setMomentLocationHandler } from '../../utils/momentLocationBridge';

const MAX_PHOTOS = 3;
const MAX_CONTENT = 500;

export function ComposerScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [tagged, setTagged] = useState<TagPick[]>([]);
  const [place, setPlace] = useState<MomentPlace | null>(null);
  const [tagOpen, setTagOpen] = useState(false);
  const [locOpen, setLocOpen] = useState(false);
  // The MapPicker navigate is queued here and fired from the location Sheet's
  // onClosed (see onChooseMap), so it presents only AFTER the Sheet has fully
  // slid out and its Modal is gone — never present-while-dismissing (iOS) and
  // never stacked behind a not-yet-torn-down Modal (Android).
  const pendingMapRef = useRef(false);
  const [ephemeral, setEphemeral] = useState(false); // 24h auto-expire (STORY1)
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
        taggedUserIds: tagged.length ? tagged.map((p) => p._id) : undefined,
        ...(ephemeral ? { expiresInHours: 24 } : {}),
        ...(place
          ? { lat: place.lat, lng: place.lng, locationLabel: place.label }
          : {}),
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
  // pick existing ones from the library. Backend caps a moment at
  // MAX_PHOTOS images (routes/moments.js POST handler), so we keep this
  // client limit in sync.
  const onAddPhotoTap = () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert(t('moments.compose.maxPhotos', { max: MAX_PHOTOS }));
      return;
    }
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
        // keyboard-controller KAV — "padding" both platforms (Android edge-to-edge safe)
        behavior="padding"
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

          {/* Photo row — horizontal scroll of 80×80 thumbnails + a larger,
              friendlier dashed-pink "add photo" tile (TTT redesign). */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoRow}
            keyboardShouldPersistTaps="handled"
          >
            {photos.map((uri, i) => (
              <View key={uri + i} style={styles.photoThumb}>
                <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
                <Pressable
                  onPress={() => removeAt(i)}
                  hitSlop={6}
                  style={[styles.removeBtn, { backgroundColor: 'rgba(0,0,0,0.6)' }]}
                >
                  <X size={13} color="#FFFFFF" strokeWidth={2.4} />
                </Pressable>
              </View>
            ))}
            {(() => {
              const full = photos.length >= MAX_PHOTOS;
              const tint = full ? theme.colors.muted : theme.colors.primary;
              return (
                <Pressable
                  onPress={onAddPhotoTap}
                  disabled={full}
                  style={[
                    styles.addTile,
                    {
                      borderColor: tint,
                      backgroundColor: full ? theme.colors.surface2 : theme.colors.primarySoft,
                    },
                  ]}
                >
                  <ImagePlus size={30} color={tint} strokeWidth={1.8} />
                  <Text style={{ fontSize: 11.5, color: tint, marginTop: 6, fontWeight: '600' }}>
                    {t('moments.compose.addPhoto')}
                  </Text>
                  <Text style={{ fontSize: 10.5, color: tint, marginTop: 2 }}>
                    {t('moments.compose.photosCount', { n: photos.length, max: MAX_PHOTOS })}
                  </Text>
                </Pressable>
              );
            })()}
          </ScrollView>

          {/* Tag friends + add location (FB/IG-style). */}
          <Pressable onPress={() => openSheetAfterKeyboardDismiss(() => setTagOpen(true))} style={[styles.actionRow, { borderTopColor: theme.colors.line }]}>
            <Users size={18} color={theme.colors.primary} strokeWidth={2} />
            <Text style={{ flex: 1, fontSize: 15, color: theme.colors.text }}>
              {t('moments.compose.tag')}
            </Text>
            {tagged.length > 0 && (
              <Text style={{ fontSize: 13, color: theme.colors.muted }}>
                {t('moments.compose.taggedCount', { n: tagged.length })}
              </Text>
            )}
          </Pressable>
          {tagged.length > 0 && (
            <Text style={{ fontSize: 13, color: theme.colors.primaryDeep, marginTop: 2 }}>
              📎 {tagged.map((p) => `@${p.nickname}`).join(' ')}
            </Text>
          )}

          <Pressable onPress={() => openSheetAfterKeyboardDismiss(() => setLocOpen(true))} style={[styles.actionRow, { borderTopColor: theme.colors.line }]}>
            <MapPin size={18} color={theme.colors.primary} strokeWidth={2} />
            <Text style={{ flex: 1, fontSize: 15, color: theme.colors.text }}>
              {place ? place.label : t('moments.compose.location')}
            </Text>
          </Pressable>

          {/* 24h ephemeral toggle (STORY1). */}
          <Pressable
            onPress={() => setEphemeral((v) => !v)}
            style={[styles.actionRow, { borderTopColor: theme.colors.line }]}
          >
            <Clock size={18} color={ephemeral ? theme.colors.primary : theme.colors.muted} strokeWidth={2} />
            <Text style={{ flex: 1, fontSize: 15, color: theme.colors.text }}>
              {t('moments.compose.ephemeral')}
            </Text>
            <View
              style={{
                width: 44,
                height: 26,
                borderRadius: 13,
                padding: 3,
                backgroundColor: ephemeral ? theme.colors.primary : theme.colors.surface2,
                alignItems: ephemeral ? 'flex-end' : 'flex-start',
                justifyContent: 'center',
              }}
            >
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' }} />
            </View>
          </Pressable>

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

      <FriendPickerSheet
        open={tagOpen}
        onClose={() => setTagOpen(false)}
        selectedIds={tagged.map((p) => p._id)}
        onConfirm={setTagged}
      />
      <MomentLocationSheet
        open={locOpen}
        onClose={() => setLocOpen(false)}
        onClosed={() => {
          // Both platforms: the location Sheet has now FULLY slid out and its
          // Modal window is gone, so presenting the MapPicker is clean. Why this
          // matters per platform:
          //   iOS — MapPicker is `presentation: 'fullScreenModal'` (#185). Present
          //     it while the Sheet's VC is still dismissing and iOS tangles the
          //     chain (Composer → Sheet → MapPicker), so Save → goBack unwinds the
          //     WHOLE chain and dumps the user on the Moments list with the draft
          //     lost (#204).
          //   Android — pushing mid-Dialog-teardown got dropped, so the map
          //     "needed 4–5 taps" (#190).
          // Both were previously worked around separately (iOS native onDismiss,
          // Android setTimeout(400)); onClosed is the single reliable signal. The
          // extra interaction frame lets the teardown settle fully before present.
          if (pendingMapRef.current) {
            pendingMapRef.current = false;
            InteractionManager.runAfterInteractions(() =>
              (nav as any).navigate('MapPicker', { mode: 'moment' }),
            );
          }
        }}
        current={place}
        onPick={setPlace}
        onChooseMap={() => {
          // One-shot bridge — MapPicker resolves the picked place on Save (HHHHH).
          // Queue the navigate and close the Sheet; the present fires from
          // onClosed above once the slide-out completes (same path both platforms).
          setMomentLocationHandler(setPlace);
          pendingMapRef.current = true;
          setLocOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  photoRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    paddingRight: 4,
  },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  addTile: {
    width: 100,
    height: 100,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    marginTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  removeBtn: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
