import React from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { ChevronLeft, Plus, CalendarClock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';
import { uploadFile } from '../../api/upload';
import { createVoteEvent, updateVoteEvent, getVoteEvent, type VoteCategory } from '../../api/votes';
import { VOTE_CATEGORIES } from './voteHelpers';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Simplified contest create/edit form. The whole flow is just:
 *   category · title · description · your entry photo.
 * Everything else is a server default — a fixed 15-day window, single round, and
 * one vote per entry. The initiator's entry photo doubles as the initial cover
 * (the feed/card derives the cover from the top-ranked entry). While an event is
 * active only the description stays editable; title/category lock.
 */
export function CreateVoteScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'CreateVote'>>();
  const qc = useQueryClient();
  const editEventId = route.params?.editEventId;
  const isEdit = !!editEventId;

  const editQ = useQuery({
    queryKey: ['votes', 'detail', editEventId],
    queryFn: () => getVoteEvent(editEventId!),
    enabled: isEdit,
  });
  const editStatus = editQ.data?.event.status;
  const locked = isEdit && editStatus === 'active'; // while active, only description is editable

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [category, setCategory] = React.useState<VoteCategory | null>(null);
  // Initiator-as-contestant: the creator's own entry (required on create only).
  const [entryPhoto, setEntryPhoto] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [prefilled, setPrefilled] = React.useState(false);

  // Prefill from the loaded event exactly once (edit only).
  React.useEffect(() => {
    const ev = editQ.data?.event;
    if (!ev || prefilled) return;
    setTitle(ev.title);
    setDescription(ev.description ?? '');
    setCategory(ev.category);
    setPrefilled(true);
  }, [editQ.data, prefilled]);

  const pickEntry = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: Platform.OS === 'android', quality: 0.85 });
    if (res.canceled) return;
    setUploading(true);
    try {
      const url = await uploadFile(res.assets[0].uri);
      setEntryPhoto(url);
    } catch (e: any) {
      Alert.alert(t('votes.uploadFailed'), e?.message ?? '');
    } finally {
      setUploading(false);
    }
  };

  const valid =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    !!category &&
    (isEdit || !!entryPhoto); // creator's own entry required when creating

  const onSubmit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      if (isEdit) {
        // While active only description is supplementable; while pending the
        // full editable set (title/description/category).
        const patch = locked
          ? { description: description.trim() }
          : { title: title.trim(), description: description.trim(), category: category! };
        await updateVoteEvent(editEventId!, patch);
        qc.invalidateQueries({ queryKey: ['votes'] });
        nav.goBack();
        return;
      }
      const ev = await createVoteEvent({
        title: title.trim(),
        description: description.trim(),
        category: category!,
        entryPhotoUrl: entryPhoto!,
      });
      qc.invalidateQueries({ queryKey: ['votes'] });
      nav.replace('VoteDetail', { eventId: ev.id });
    } catch (e: any) {
      Alert.alert(t(isEdit ? 'votes.updateFailed' : 'votes.createFailed'), e?.response?.data?.error ?? '');
    } finally {
      setSaving(false);
    }
  };

  const Label = ({ children }: { children: React.ReactNode }) => (
    <Text style={{ fontSize: 12, letterSpacing: 0.7, textTransform: 'uppercase', color: theme.colors.muted, marginTop: 22, marginBottom: 10 }}>
      {children}
    </Text>
  );
  const input = {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.text,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ marginLeft: 8, fontSize: 18, fontWeight: '700', color: theme.colors.text }}>
          {isEdit ? t('votes.editTitle') : t('votes.createTitle')}
        </Text>
      </View>

      {isEdit && !prefilled ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {locked && (
          <View style={{ marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: theme.colors.primarySoft }}>
            <Text style={{ fontSize: 13, color: theme.colors.primaryDeep, fontWeight: '600' }}>
              {t('votes.editActiveNote')}
            </Text>
          </View>
        )}

        {!locked && (
          <>
            <Label>{t('votes.field.category')}</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {VOTE_CATEGORIES.map((c) => (
                <Pressable
                  key={c.key}
                  onPress={() => setCategory(c.key)}
                  style={{
                    paddingHorizontal: 13,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: category === c.key ? theme.colors.primary : theme.colors.surface,
                    borderWidth: 1,
                    borderColor: category === c.key ? theme.colors.primary : theme.colors.line,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: category === c.key ? '#FFF' : theme.colors.text2 }}>
                    {c.emoji} {t(`votes.category.${c.key}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Label>{t('votes.field.title')}</Label>
        <TextInput
          value={title}
          onChangeText={(v) => setTitle(v.slice(0, 80))}
          editable={!locked}
          placeholder={t('votes.field.titlePlaceholder')}
          placeholderTextColor={theme.colors.muted}
          style={[input, locked && { color: theme.colors.muted, backgroundColor: theme.colors.surface2 }]}
        />

        <Label>{t('votes.field.description')}</Label>
        <TextInput
          value={description}
          onChangeText={(v) => setDescription(v.slice(0, 500))}
          placeholder={t('votes.field.descPlaceholder')}
          placeholderTextColor={theme.colors.muted}
          multiline
          style={[input, { minHeight: 80, textAlignVertical: 'top' }]}
        />

        {/* Initiator's own entry — the creator is a contestant too (create only). */}
        {!isEdit && (
          <>
            <Label>{t('votes.submitYourEntry')}</Label>
            <Pressable
              onPress={pickEntry}
              disabled={uploading}
              style={{
                width: 96,
                height: 96,
                borderRadius: 12,
                borderWidth: 1,
                borderStyle: entryPhoto ? 'solid' : 'dashed',
                borderColor: theme.colors.line,
                backgroundColor: theme.colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {entryPhoto ? (
                <ExpoImage source={{ uri: entryPhoto }} style={{ width: 96, height: 96 }} contentFit="cover" />
              ) : uploading ? (
                <ActivityIndicator color={theme.colors.muted} />
              ) : (
                <Plus size={22} color={theme.colors.muted} />
              )}
            </Pressable>

            {/* Fixed-duration notice replaces the old start/end pickers. */}
            <View style={[styles.durationNote, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.line }]}>
              <CalendarClock size={16} color={theme.colors.text2} strokeWidth={1.8} />
              <Text style={{ fontSize: 13, color: theme.colors.text2, fontWeight: '600' }}>
                {t('votes.fixedDurationLabel')}
              </Text>
            </View>
          </>
        )}

        <View style={{ marginTop: 28 }}>
          <Button
            label={isEdit ? t('votes.updateCta') : t('votes.createCta')}
            onPress={onSubmit}
            disabled={!valid}
            loading={saving}
            fullWidth
          />
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  durationNote: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
});
