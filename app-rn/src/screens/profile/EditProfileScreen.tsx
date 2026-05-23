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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';
import { Avatar } from '../../components/Avatar';
import { useAuth } from '../../store/auth';
import { patchMe } from '../../api/me';
import { uploadProfilePhoto } from '../../api/upload';

export function EditProfileScreen() {
  const theme = useTheme();
  const nav = useNavigation();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);

  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [age, setAge] = useState(user?.age != null ? String(user.age) : '');
  const [busy, setBusy] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const pickAvatar = async () => {
    if (uploadingAvatar) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('需要照片权限', '在系统设置中允许 Meyou 访问你的照片。');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;
    setUploadingAvatar(true);
    try {
      // Server response already has the fresh avatarUrl + photos[] —
      // use it directly instead of a second getMe() round-trip that
      // could fail and stall the UI update.
      const result2 = await uploadProfilePhoto(result.assets[0].uri);
      if (user) {
        setUser({
          ...user,
          avatarUrl: result2.avatarUrl ?? user.avatarUrl,
          photos: result2.photos ?? user.photos,
        });
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const body = e?.response?.data;
      const detail = body?.error || body?.message || e?.message || 'unknown';
      Alert.alert('上传失败', `${detail}${status ? ` (HTTP ${status})` : ''}`);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const onSave = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await patchMe({
        nickname: nickname.trim() || undefined,
        bio: bio.trim(),
        age: age ? parseInt(age, 10) : undefined,
      });
      setUser(updated);
      nav.goBack();
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.error || e?.response?.data?.message || e?.message || 'unknown';
      Alert.alert('保存失败', `${detail}${status ? ` (HTTP ${status})` : ''}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 10,
        }}
      >
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ marginLeft: 8, fontSize: 18, fontWeight: '600', color: theme.colors.text }}>
          编辑资料
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          <View style={{ alignItems: 'center', marginTop: 12, marginBottom: 24 }}>
            <Pressable onPress={pickAvatar} disabled={uploadingAvatar}>
              <Avatar
                name={nickname || user?.nickname}
                uri={user?.avatarUrl}
                avatarIdx={0}
                size={88}
              />
              {uploadingAvatar && (
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: 88,
                    height: 88,
                    borderRadius: 44,
                    backgroundColor: 'rgba(0,0,0,0.45)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ActivityIndicator color="#FFFFFF" />
                </View>
              )}
            </Pressable>
            <Pressable onPress={pickAvatar} disabled={uploadingAvatar} style={{ marginTop: 12 }}>
              <Text style={{ color: theme.colors.primary, fontSize: 14, fontWeight: '500' }}>
                更换头像
              </Text>
            </Pressable>
          </View>

          <Label>昵称</Label>
          <Field value={nickname} onChangeText={setNickname} maxLength={30} />

          <Label>简介</Label>
          <Field
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={140}
            minHeight={88}
            placeholder="一两句介绍自己"
          />
          <Text style={{ marginTop: 4, fontSize: 11, color: theme.colors.muted, textAlign: 'right' }}>
            {bio.length} / 140
          </Text>

          <Label>年龄</Label>
          <Field
            value={age}
            onChangeText={(v) => setAge(v.replace(/\D/g, '').slice(0, 2))}
            keyboardType="number-pad"
            maxLength={2}
          />
        </ScrollView>

        <View style={{ padding: 20 }}>
          <Button label="保存" loading={busy} onPress={onSave} fullWidth />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Text
      style={{
        fontSize: 13,
        color: theme.colors.muted,
        marginBottom: 8,
        marginTop: 14,
      }}
    >
      {children}
    </Text>
  );
}

function Field({
  multiline,
  minHeight,
  ...rest
}: React.ComponentProps<typeof TextInput> & { minHeight?: number }) {
  const theme = useTheme();
  return (
    <TextInput
      multiline={multiline}
      placeholderTextColor={theme.colors.muted}
      style={{
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.line,
        borderRadius: theme.radius.m,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 15,
        color: theme.colors.text,
        minHeight: multiline ? minHeight ?? 88 : undefined,
        textAlignVertical: multiline ? 'top' : 'auto',
      }}
      {...rest}
    />
  );
}
