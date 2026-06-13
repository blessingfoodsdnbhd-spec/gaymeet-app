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
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { ChevronLeft, ImagePlus, X, Users, MapPin, Clock } from 'lucide-react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';
import { FriendPickerSheet, type TagPick } from '../../components/FriendPickerSheet';
import { MomentLocationSheet, type MomentPlace } from '../../components/MomentLocationSheet';
import { openSheetAfterKeyboardDismiss } from '../../utils/keyboardSheet';
import { postMoment, patchMoment } from '../../api/moments';
import type { RootStackParamList } from '../../navigation/types';
import { uploadFile } from '../../api/upload';
import { setMomentLocationHandler } from '../../utils/momentLocationBridge';

const MAX_PHOTOS = 3;
const MAX_CONTENT = 500;

export function ComposerScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'Composer'>>();
  const edit = route.params?.edit;
  const isEditing = !!edit;
  const queryClient = useQueryClient();
  const [content, setContent] = useState(edit?.content ?? '');
  const [photos, setPhotos] = useState<string[]>(edit?.images ?? []);
  const [tagged, setTagged] = useState<TagPick[]>(edit?.tagged ?? []);
  const [place, setPlace] = useState<MomentPlace | null>(
    edit?.place ? { lat: edit.place.lat, lng: edit.place.lng, label: edit.place.label } : null,
  );
  const [tagOpen, setTagOpen] = useState(false);
  const [locOpen, setLocOpen] = useState(false);
  // iOS: the MapPicker navigate is queued here and fired from the location
  // Sheet's onDismiss (see onChooseMap), so it presents only AFTER the Sheet's
  // Modal is gone — never present-while-dismissing.
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
      if (isEditing && edit) {
        // Edit: PATCH the existing moment. Always send tagged + location so
        // the backend can also CLEAR them (empty list / lat:null,lng:null) if
        // the user removed an @-tag or the place. Ephemeral toggle isn't editable.
        return patchMoment(edit.id, {
          content: content.trim(),
          images: uploadedUrls,
          taggedUserIds: tagged.map((p) => p._id),
          ...(place
            ? { lat: place.lat, lng: place.lng, locationLabel: place.label }
            : { lat: null, lng: null, locationLabel: null }),
        });
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
          {isEditing ? t('moments.composer.editTitle') : t('moments.composer.headerTitle')}
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
            {isEditing ? t('common.save') : t('moments.composer.publish')}
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

          {/* 24h ephemeral toggle (STORY1) — only for NEW posts; editing
              can't change a moment's ephemerality. */}
          {!isEditing && (
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
          )}

        </ScrollView>

        <View style={{ padding: 20 }}>
          <Button
            label={isEditing ? t('common.save') : t('moments.composer.publishCta')}
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
        onDismiss={() => {
          // iOS: the location Sheet's Modal has now fully dismissed, so it's
          // safe to present the MapPicker fullScreenModal. Doing it here (rather
          // than in the same tick as setLocOpen(false)) is what stops the iOS VC
          // chain from tangling — see onChooseMap.
          if (pendingMapRef.current) {
            pendingMapRef.current = false;
            (nav as any).navigate('MapPicker', { mode: 'moment' });
          }
        }}
        current={place}
        onPick={setPlace}
        onChooseMap={() => {
          // One-shot bridge — MapPicker resolves the picked place on Save (HHHHH).
          setMomentLocationHandler(setPlace);
          if (Platform.OS === 'android') {
            // The location Sheet is a RN <Modal> (an Android Dialog). Pushing
            // the MapPicker in the SAME tick we close it made Android drop the
            // push mid-Dialog-teardown — the map opened only after 4–5 taps.
            // (#190's card push fixed the *total* failure but not this timing
            // race.) Defer the navigate until the Sheet's slide-out (~220ms) is
            // done, so the push lands on the now-focused root activity. Mirrors
            // AboutUserSheet's Android sheet→follow-up fix.
            setLocOpen(false);
            // 250ms wasn't always enough on slower devices — the push still landed
            // mid-Dialog-teardown and was dropped (map "needs several taps"). Give
            // the teardown more headroom; a dropped push is the only failure mode
            // here, so erring longer is safe (the map just opens a beat later).
            setTimeout(() => (nav as any).navigate('MapPicker', { mode: 'moment' }), 400);
          } else {
            // iOS: the MapPicker is `presentation: 'fullScreenModal'` (#185, to
            // keep Save → goBack from collapsing the Composer modal group). But
            // the Sheet is itself a RN <Modal>; presenting the fullScreenModal in
            // the SAME tick we close the Sheet presents it while the Sheet's VC
            // is still dismissing. iOS then tangles the presentation chain
            // (Composer → Sheet → MapPicker instead of Composer → MapPicker), so
            // Save's goBack unwinds the WHOLE chain — popping the Composer too
            // and dumping the user on the Moments list with the draft + location
            // lost. (#204 wrongly assumed iOS same-tick "works"; it opens but
            // tangles.) Queue the navigate and fire it from the Sheet's onDismiss
            // once the Modal is gone, so the present is clean and goBack reveals
            // the still-mounted Composer for the bridge. Mirrors ChatDetail's
            // closeActionsThen / onDismiss chaining.
            pendingMapRef.current = true;
            setLocOpen(false);
          }
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
