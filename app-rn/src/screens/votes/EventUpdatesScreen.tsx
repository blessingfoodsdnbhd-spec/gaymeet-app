import React from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { ChevronLeft, Plus, X, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';
import { usePhotoViewer } from '../../components/usePhotoViewer';
import { uploadFile } from '../../api/upload';
import { getEventUpdates, postEventUpdate, deleteEventUpdate, type VoteEventUpdate } from '../../api/votes';
import { shortTime } from '../../utils/time';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'EventUpdates'>;
const MAX_PHOTOS = 3;

export function EventUpdatesScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const qc = useQueryClient();
  const photoViewer = usePhotoViewer();
  const { eventId, isCreator } = route.params;

  const [draft, setDraft] = React.useState('');
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [posting, setPosting] = React.useState(false);

  const q = useQuery({
    queryKey: ['votes', 'updates', eventId, 'full'],
    queryFn: () => getEventUpdates(eventId, undefined, 50),
    staleTime: 15_000,
  });
  const updates = q.data?.updates ?? [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['votes', 'updates', eventId] });
    qc.invalidateQueries({ queryKey: ['votes', 'detail', eventId] });
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: Platform.OS === 'android', quality: 0.85 });
    if (res.canceled) return;
    setUploading(true);
    try {
      const url = await uploadFile(res.assets[0].uri);
      setPhotos((p) => [...p, url]);
    } catch (e: any) {
      Alert.alert(t('votes.uploadFailed'), e?.message ?? '');
    } finally {
      setUploading(false);
    }
  };

  const onPost = async () => {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      await postEventUpdate(eventId, { body, photos });
      setDraft('');
      setPhotos([]);
      invalidate();
    } catch (e: any) {
      Alert.alert(t('votes.updates.postFailed'), e?.response?.data?.error ?? '');
    } finally {
      setPosting(false);
    }
  };

  const onDelete = (u: VoteEventUpdate) =>
    Alert.alert(t('votes.updates.deleteConfirm'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('notes.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteEventUpdate(eventId, u.id);
            invalidate();
          } catch {
            Alert.alert(t('votes.actionFailed'));
          }
        },
      },
    ]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ marginLeft: 8, fontSize: 18, fontWeight: '700', color: theme.colors.text }}>
          {t('votes.updates.title')}
        </Text>
      </View>

      {/* Android: undefined — root KeyboardProvider emulates adjustResize (no double-shift). */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <FlatList
          data={updates}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 14 }}
          ListHeaderComponent={
            isCreator ? (
              <View style={[styles.composer, { borderColor: theme.colors.line, backgroundColor: theme.colors.surface }]}>
                <TextInput
                  value={draft}
                  onChangeText={(v) => setDraft(v.slice(0, 500))}
                  placeholder={t('votes.updates.placeholder')}
                  placeholderTextColor={theme.colors.muted}
                  multiline
                  style={{ fontSize: 15, color: theme.colors.text, minHeight: 60, textAlignVertical: 'top' }}
                />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {photos.map((url) => (
                    <View key={url}>
                      <ExpoImage source={{ uri: url }} style={{ width: 56, height: 56, borderRadius: 8 }} contentFit="cover" />
                      <Pressable
                        onPress={() => setPhotos((p) => p.filter((x) => x !== url))}
                        style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#000', borderRadius: 9, padding: 2 }}
                      >
                        <X size={12} color="#FFF" strokeWidth={2.5} />
                      </Pressable>
                    </View>
                  ))}
                  {photos.length < MAX_PHOTOS && (
                    <Pressable
                      onPress={pickPhoto}
                      disabled={uploading}
                      style={{ width: 56, height: 56, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.colors.line, alignItems: 'center', justifyContent: 'center' }}
                    >
                      {uploading ? <ActivityIndicator color={theme.colors.muted} /> : <Plus size={18} color={theme.colors.muted} />}
                    </Pressable>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end', marginTop: 10 }}>
                  <Button label={t('votes.updates.post')} onPress={onPost} disabled={!draft.trim()} loading={posting} />
                </View>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.line }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ flex: 1, fontSize: 12, color: theme.colors.muted }}>{shortTime(item.createdAt)}</Text>
                {isCreator && (
                  <Pressable onPress={() => onDelete(item)} hitSlop={8}>
                    <Trash2 size={16} color={theme.colors.muted} />
                  </Pressable>
                )}
              </View>
              <Text style={{ fontSize: 15, lineHeight: 22, color: theme.colors.text, marginTop: 6 }}>{item.body}</Text>
              {item.photos.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  {item.photos.map((url, i) => (
                    <Pressable key={i} onPress={() => photoViewer.open(item.photos, i)}>
                      <ExpoImage source={{ uri: url }} style={{ width: 92, height: 92, borderRadius: 10, backgroundColor: theme.colors.surface2 }} contentFit="cover" />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            q.isLoading ? (
              <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
            ) : (
              <Text style={{ color: theme.colors.muted, textAlign: 'center', marginTop: 40 }}>
                {t('votes.updates.empty')}
              </Text>
            )
          }
        />
      </KeyboardAvoidingView>
      {photoViewer.node}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  composer: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 4 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14 },
});
