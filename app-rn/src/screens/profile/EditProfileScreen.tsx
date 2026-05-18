import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';
import { Avatar } from '../../components/Avatar';
import { useAuth } from '../../store/auth';
import { patchMe } from '../../api/me';

export function EditProfileScreen() {
  const theme = useTheme();
  const nav = useNavigation();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);

  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [age, setAge] = useState(user?.age != null ? String(user.age) : '');
  const [busy, setBusy] = useState(false);

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
    } catch {
      // TODO: toast retry
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
            <Avatar
              name={nickname || user?.nickname}
              avatarIdx={0}
              size={88}
            />
            <Pressable style={{ marginTop: 12 }}>
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
