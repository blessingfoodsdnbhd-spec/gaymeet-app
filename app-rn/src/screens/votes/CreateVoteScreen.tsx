import React from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { ChevronLeft, Plus, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';
import { DateTimeField } from '../../components/DateTimeField';
import { uploadFile } from '../../api/upload';
import { createVoteEvent, type VoteCategory, type VoteMode } from '../../api/votes';
import { VOTE_CATEGORIES } from './voteHelpers';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const MAX_PHOTOS = 5;
const MODES: VoteMode[] = ['one', 'fivePerDay', 'unlimited'];

function PhotoRow({
  photos,
  onAdd,
  onRemove,
  busy,
}: {
  photos: string[];
  onAdd: () => void;
  onRemove: (url: string) => void;
  busy: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {photos.map((url) => (
        <View key={url}>
          <ExpoImage source={{ uri: url }} style={{ width: 72, height: 72, borderRadius: 10 }} contentFit="cover" />
          <Pressable
            onPress={() => onRemove(url)}
            style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#000', borderRadius: 10, padding: 2 }}
          >
            <X size={13} color="#FFF" strokeWidth={2.5} />
          </Pressable>
        </View>
      ))}
      {photos.length < MAX_PHOTOS && (
        <Pressable
          onPress={onAdd}
          disabled={busy}
          style={{
            width: 72,
            height: 72,
            borderRadius: 10,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: theme.colors.line,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {busy ? <ActivityIndicator color={theme.colors.muted} /> : <Plus size={22} color={theme.colors.muted} />}
        </Pressable>
      )}
    </View>
  );
}

export function CreateVoteScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const qc = useQueryClient();

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [category, setCategory] = React.useState<VoteCategory | null>(null);
  const [cover, setCover] = React.useState<string[]>([]);
  const [refs, setRefs] = React.useState<string[]>([]);
  const [externalLink, setExternalLink] = React.useState('');
  const [mode, setMode] = React.useState<VoteMode>('one');
  const now = new Date();
  const [startAt, setStartAt] = React.useState<Date | null>(now);
  const [endAt, setEndAt] = React.useState<Date | null>(new Date(now.getTime() + 7 * 24 * 3600 * 1000));
  const [uploading, setUploading] = React.useState<'cover' | 'ref' | null>(null);
  const [saving, setSaving] = React.useState(false);

  const pick = async (which: 'cover' | 'ref') => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (res.canceled) return;
    setUploading(which);
    try {
      const url = await uploadFile(res.assets[0].uri);
      if (which === 'cover') setCover((p) => [...p, url]);
      else setRefs((p) => [...p, url]);
    } catch (e: any) {
      Alert.alert(t('votes.uploadFailed'), e?.message ?? '');
    } finally {
      setUploading(null);
    }
  };

  const valid =
    title.trim().length > 0 &&
    !!category &&
    cover.length > 0 &&
    startAt &&
    endAt &&
    endAt > startAt;

  const onSubmit = async () => {
    if (!valid || saving) return;
    if (endAt!.getTime() - startAt!.getTime() > 30 * 24 * 3600 * 1000) {
      Alert.alert(t('votes.maxDuration'));
      return;
    }
    if (externalLink.trim() && !/^https?:\/\/.+/i.test(externalLink.trim())) {
      Alert.alert(t('votes.invalidLink'));
      return;
    }
    setSaving(true);
    try {
      const ev = await createVoteEvent({
        title: title.trim(),
        description: description.trim(),
        category: category!,
        coverPhotos: cover,
        referencePhotos: refs,
        externalLink: externalLink.trim() || null,
        startAt: startAt!.toISOString(),
        endAt: endAt!.toISOString(),
        rules: { mode },
      });
      qc.invalidateQueries({ queryKey: ['votes'] });
      nav.replace('VoteDetail', { eventId: ev.id });
    } catch (e: any) {
      Alert.alert(t('votes.createFailed'), e?.response?.data?.error ?? '');
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
        <Text style={{ marginLeft: 8, fontSize: 18, fontWeight: '700', color: theme.colors.text }}>{t('votes.createTitle')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
        <Label>{t('votes.field.title')}</Label>
        <TextInput value={title} onChangeText={(v) => setTitle(v.slice(0, 80))} placeholder={t('votes.field.titlePlaceholder')} placeholderTextColor={theme.colors.muted} style={input} />

        <Label>{t('votes.field.description')}</Label>
        <TextInput value={description} onChangeText={(v) => setDescription(v.slice(0, 500))} placeholder={t('votes.field.descPlaceholder')} placeholderTextColor={theme.colors.muted} multiline style={[input, { minHeight: 80, textAlignVertical: 'top' }]} />

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

        <Label>{t('votes.field.coverPhotos')}</Label>
        <PhotoRow photos={cover} onAdd={() => pick('cover')} onRemove={(u) => setCover((p) => p.filter((x) => x !== u))} busy={uploading === 'cover'} />

        <Label>{t('votes.field.referencePhotos')}</Label>
        <PhotoRow photos={refs} onAdd={() => pick('ref')} onRemove={(u) => setRefs((p) => p.filter((x) => x !== u))} busy={uploading === 'ref'} />

        <Label>{t('votes.field.externalLink')}</Label>
        <TextInput value={externalLink} onChangeText={setExternalLink} placeholder="https://…" autoCapitalize="none" keyboardType="url" placeholderTextColor={theme.colors.muted} style={input} />

        <Label>{t('votes.field.startAt')}</Label>
        <DateTimeField label="" value={startAt} onChange={setStartAt} />
        <Label>{t('votes.field.endAt')}</Label>
        <DateTimeField label="" value={endAt} onChange={setEndAt} />

        <Label>{t('votes.field.rule')}</Label>
        <View style={{ gap: 8 }}>
          {MODES.map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                padding: 13,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: mode === m ? theme.colors.primary : theme.colors.line,
                backgroundColor: mode === m ? theme.colors.primarySoft : theme.colors.surface,
              }}
            >
              <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: mode === m ? theme.colors.primary : theme.colors.line, alignItems: 'center', justifyContent: 'center' }}>
                {mode === m && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: theme.colors.primary }} />}
              </View>
              <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.text }}>{t(`votes.rule.${m}`)}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ marginTop: 28 }}>
          <Button label={t('votes.createCta')} onPress={onSubmit} disabled={!valid} loading={saving} fullWidth />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});
