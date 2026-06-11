import React from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Switch,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';
import { createChatRoom } from '../../api/worldChat';
import { useAuth } from '../../store/auth';
import { DEFAULT_HEX } from '../../utils/roomColors';
import { RoomColorPicker } from './RoomColorPicker';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'CreateRoom'>;

const TITLE_MAX = 80;
const DESC_MAX = 300;

export function CreateRoomScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const qc = useQueryClient();
  const { channelId, title: channelTitle } = route.params;
  const myLevel = useAuth((s) => s.user?.level ?? 1);

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [cardColor, setCardColor] = React.useState(DEFAULT_HEX);
  const [isPrivate, setIsPrivate] = React.useState(false);
  const [password, setPassword] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const canSubmit = title.trim().length > 0 && (!isPrivate || password.trim().length > 0);

  const onSubmit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      const room = await createChatRoom({
        channelId,
        title: title.trim(),
        description: description.trim() || undefined,
        cardColor,
        isPrivate,
        password: isPrivate ? password.trim() : undefined,
      });
      qc.invalidateQueries({ queryKey: ['worldChat', 'channelRooms', channelId] });
      qc.invalidateQueries({ queryKey: ['worldChat', 'myRooms'] });
      nav.replace('WorldChatRoom', { roomId: room.id, title: room.title, custom: true });
    } catch (e: any) {
      // §7.1 — quota reached returns 429 ROOM_LIMIT with a cap.
      if (e?.response?.data?.code === 'ROOM_LIMIT') {
        Alert.alert(t('worldChat.rooms.createFailed'), t('plaza.create.limitReached', { cap: e.response.data.cap }));
      } else if (e?.response?.data?.code === 'COLOR_LOCKED') {
        Alert.alert(t('worldChat.rooms.createFailed'), t('plaza.color.locked'));
      } else {
        Alert.alert(t('worldChat.rooms.createFailed'), e?.response?.data?.error ?? '');
      }
    } finally {
      setSaving(false);
    }
  };

  const input = {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.line,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.text,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={{ marginRight: 10 }}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.text }}>{t('worldChat.rooms.createTitle')}</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }} keyboardShouldPersistTaps="handled">
          <Text style={{ fontSize: 12.5, color: theme.colors.muted }}>
            {t('worldChat.rooms.inChannel', { channel: channelTitle })}
          </Text>

          <View style={{ gap: 8 }}>
            <Text style={[styles.label, { color: theme.colors.text }]}>{t('worldChat.rooms.fieldTitle')}</Text>
            <TextInput
              value={title}
              onChangeText={(x) => setTitle(x.slice(0, TITLE_MAX))}
              placeholder={t('worldChat.rooms.fieldTitlePh')}
              placeholderTextColor={theme.colors.muted}
              style={input}
            />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={[styles.label, { color: theme.colors.text }]}>{t('worldChat.rooms.fieldDesc')}</Text>
            <TextInput
              value={description}
              onChangeText={(x) => setDescription(x.slice(0, DESC_MAX))}
              placeholder={t('worldChat.rooms.fieldDescPh')}
              placeholderTextColor={theme.colors.muted}
              multiline
              style={[input, { minHeight: 84, textAlignVertical: 'top' }]}
            />
          </View>

          <View style={{ gap: 10 }}>
            <Text style={[styles.label, { color: theme.colors.text }]}>{t('plaza.color.title')}</Text>
            <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: -4 }}>{t('plaza.color.hint')}</Text>
            <RoomColorPicker userLevel={myLevel} value={cardColor} onChange={setCardColor} />
          </View>

          <View style={[styles.row, { borderColor: theme.colors.line }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text }}>{t('worldChat.rooms.private')}</Text>
              <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>{t('worldChat.rooms.privateHint')}</Text>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              trackColor={{ true: theme.colors.primary, false: theme.colors.line }}
            />
          </View>

          {isPrivate && (
            <View style={{ gap: 8 }}>
              <Text style={[styles.label, { color: theme.colors.text }]}>{t('worldChat.rooms.password')}</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={t('worldChat.rooms.passwordPh')}
                placeholderTextColor={theme.colors.muted}
                autoCapitalize="none"
                style={input}
              />
            </View>
          )}

          <Button label={t('worldChat.rooms.createCta')} onPress={onSubmit} loading={saving} disabled={!canSubmit} fullWidth />
        </ScrollView>
      </KeyboardAvoidingView>
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
  label: { fontSize: 13, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
