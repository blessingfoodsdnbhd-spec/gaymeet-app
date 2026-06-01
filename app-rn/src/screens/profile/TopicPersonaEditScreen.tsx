import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Trash2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

import { useTheme } from '../../theme/ThemeProvider';
import { useAuth } from '../../store/auth';
import { Button } from '../../components/Button';
import { PhotoGridEditor } from '../../components/PhotoGridEditor';
import { PremiumGateSheet } from '../../components/PremiumGateSheet';
import { uploadFile } from '../../api/upload';
import {
  createOrUpsertPersona,
  deletePersona,
  getMyPersonas,
} from '../../api/mePersonas';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'TopicPersonaEdit'>;

const NICKNAME_MAX = 30;

/**
 * Create / edit a single topic persona. Routed from ProfileScreen with
 * { topicSlug, topicName, topicIcon }. If a persona exists for that
 * slug we pre-load it; otherwise the user is creating from scratch.
 *
 * Photo cap follows premium state — Free 3, Premium 5. We default to
 * 5 slots in the grid and the backend enforces the actual cap, so
 * free users get a 402 if they try to push >3.
 */
export function TopicPersonaEditScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const queryClient = useQueryClient();
  const me = useAuth((s) => s.user);
  const isPremium = !!(me as any)?.isPremium;
  const photoMax = isPremium ? 5 : 3;

  const { topicSlug, topicName, topicIcon } = route.params;

  const personasQ = useQuery({
    queryKey: ['me', 'topic-personas'],
    queryFn: getMyPersonas,
    staleTime: 30_000,
  });
  const existing = personasQ.data?.find((p) => p.topicSlug === topicSlug);

  const [nickname, setNickname] = useState(existing?.nickname ?? '');
  const [photos, setPhotos] = useState<string[]>(existing?.photos ?? []);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [paywall, setPaywall] = useState<{ title: string; body: string } | null>(null);

  // Hydrate once when the query resolves AFTER the screen mounted with
  // no cached data. (If there was cached data the useState init already
  // got it.)
  React.useEffect(() => {
    if (existing && nickname === '' && photos.length === 0) {
      setNickname(existing.nickname);
      setPhotos(existing.photos);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.topicSlug]);

  const pickAndUpload = async () => {
    if (uploadBusy) return;
    if (photos.length >= photoMax) {
      if (!isPremium) {
        setPaywall({
          title: t('topics.photoCapTitle'),
          body: t('topics.premiumLimit'),
        });
      } else {
        Alert.alert(t('topics.photoCapTitle'), t('topics.photoCapBody', { max: photoMax }));
      }
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert(
        t('profile.edit.photoPermTitle'),
        t('profile.edit.photoPermBody'),
      );
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // Preserve original aspect ratio — skip the square-crop screen. The grid
      // shows a square thumbnail via cover-fit.
      allowsEditing: false,
      quality: 0.85,
    });
    if (res.canceled) return;
    setUploadBusy(true);
    try {
      const b2Url = await uploadFile(res.assets[0].uri);
      setPhotos((prev) => [...prev, b2Url]);
    } catch (e: any) {
      Alert.alert(
        t('profile.photoUploadFailed'),
        e?.response?.data?.error || e?.message || '',
      );
    } finally {
      setUploadBusy(false);
    }
  };

  const removePhoto = (url: string) => {
    setPhotos((prev) => prev.filter((p) => p !== url));
  };

  const saveMut = useMutation({
    mutationFn: () =>
      createOrUpsertPersona({
        topicSlug,
        nickname: nickname.trim().slice(0, NICKNAME_MAX),
        photos,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me', 'topic-personas'] });
      queryClient.invalidateQueries({ queryKey: ['topics', topicSlug, 'personas'] });
      nav.goBack();
    },
    onError: (e: any) => {
      const status = e?.response?.status;
      const body = e?.response?.data;
      if (status === 402 && body?.reason === 'premium_required') {
        setPaywall({
          title: t('topics.personaLimitTitle'),
          body: body?.error || t('topics.premiumLimit'),
        });
      } else {
        Alert.alert(
          t('topics.saveFailed'),
          body?.error || e?.message || '',
        );
      }
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => deletePersona(topicSlug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me', 'topic-personas'] });
      queryClient.invalidateQueries({ queryKey: ['topics', topicSlug, 'personas'] });
      nav.goBack();
    },
    onError: (e: any) =>
      Alert.alert(
        t('topics.deleteFailed'),
        e?.response?.data?.error || e?.message || '',
      ),
  });

  const onDelete = () => {
    Alert.alert(
      t('topics.deleteConfirmTitle'),
      t('topics.deleteConfirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('topics.leave'),
          style: 'destructive',
          onPress: () => deleteMut.mutate(),
        },
      ],
    );
  };

  const canSave = nickname.trim().length > 0 && !saveMut.isPending;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          {topicIcon ? `${topicIcon} ` : ''}
          {topicName}
        </Text>
        {existing ? (
          <Pressable onPress={onDelete} hitSlop={8}>
            <Trash2 size={20} color={theme.colors.muted} strokeWidth={1.8} />
          </Pressable>
        ) : (
          <View style={{ width: 20 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={[styles.label, { color: theme.colors.muted }]}>
          {t('topics.personaNickname')}
        </Text>
        <TextInput
          value={nickname}
          onChangeText={setNickname}
          maxLength={NICKNAME_MAX}
          placeholder={t('topics.personaNicknamePlaceholder')}
          placeholderTextColor={theme.colors.muted}
          style={[
            styles.input,
            {
              color: theme.colors.text,
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.line,
            },
          ]}
        />
        <Text style={{ color: theme.colors.muted, fontSize: 12, marginTop: 6 }}>
          {t('topics.personaNicknameHint')}
        </Text>

        <Text style={[styles.label, { color: theme.colors.muted, marginTop: 22 }]}>
          {t('topics.uploadPhotos', { count: photos.length, max: photoMax })}
        </Text>
        <PhotoGridEditor
          photos={photos}
          max={photoMax}
          busy={uploadBusy}
          onAdd={pickAndUpload}
          onRemove={removePhoto}
        />

        {!isPremium && (
          <Text style={{ color: theme.colors.muted, fontSize: 12, marginTop: 10 }}>
            {t('topics.premiumLimit')}
          </Text>
        )}

        <View style={{ marginTop: 28 }}>
          <Button
            label={
              saveMut.isPending
                ? '…'
                : existing
                ? t('common.save')
                : t('topics.join')
            }
            onPress={() => saveMut.mutate()}
            disabled={!canSave}
            fullWidth
          />
        </View>

        {personasQ.isLoading && (
          <View style={{ marginTop: 16, alignItems: 'center' }}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        )}
      </ScrollView>

      <PremiumGateSheet
        open={paywall != null}
        title={paywall?.title ?? ''}
        body={paywall?.body ?? ''}
        onClose={() => setPaywall(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  label: {
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
});
