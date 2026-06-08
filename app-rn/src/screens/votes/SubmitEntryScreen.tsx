import React from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { ChevronLeft, ImagePlus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';
import { uploadFile } from '../../api/upload';
import { submitVoteEntry } from '../../api/votes';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'SubmitEntry'>;

export function SubmitEntryScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const qc = useQueryClient();
  const eventId = route.params.eventId;

  const [photoUrl, setPhotoUrl] = React.useState<string | null>(null);
  const [caption, setCaption] = React.useState('');
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.85 });
    if (res.canceled) return;
    setUploading(true);
    try {
      setPhotoUrl(await uploadFile(res.assets[0].uri));
    } catch (e: any) {
      Alert.alert(t('votes.uploadFailed'), e?.message ?? '');
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async () => {
    if (!photoUrl || saving) return;
    setSaving(true);
    try {
      await submitVoteEntry(eventId, { photoUrl, caption: caption.trim() });
      qc.invalidateQueries({ queryKey: ['votes', 'detail', eventId] });
      nav.goBack();
    } catch (e: any) {
      Alert.alert(t('votes.entryFailed'), e?.response?.data?.error ?? '');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ marginLeft: 8, fontSize: 18, fontWeight: '700', color: theme.colors.text }}>{t('votes.submitTitle')}</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={{ flex: 1, padding: 20 }}>
            <Pressable
              onPress={pick}
              disabled={uploading}
              style={{
                aspectRatio: 1,
                borderRadius: 16,
                borderWidth: 1,
                borderStyle: photoUrl ? 'solid' : 'dashed',
                borderColor: theme.colors.line,
                backgroundColor: theme.colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {photoUrl ? (
                <ExpoImage source={{ uri: photoUrl }} style={StyleSheet.absoluteFill} contentFit="contain" />
              ) : uploading ? (
                <ActivityIndicator color={theme.colors.primary} />
              ) : (
                <>
                  <ImagePlus size={34} color={theme.colors.muted} />
                  <Text style={{ color: theme.colors.muted, marginTop: 10 }}>{t('votes.pickPhoto')}</Text>
                </>
              )}
            </Pressable>

            <TextInput
              value={caption}
              onChangeText={(v) => setCaption(v.slice(0, 200))}
              placeholder={t('votes.captionPlaceholder')}
              placeholderTextColor={theme.colors.muted}
              multiline
              blurOnSubmit
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              style={{
                marginTop: 16,
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: theme.colors.line,
                borderRadius: 12,
                padding: 14,
                fontSize: 15,
                color: theme.colors.text,
                minHeight: 72,
                textAlignVertical: 'top',
              }}
            />

            <View style={{ marginTop: 24 }}>
              <Button label={t('votes.submitCta')} onPress={onSubmit} disabled={!photoUrl} loading={saving} fullWidth />
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});
