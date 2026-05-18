import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Bell,
  ChevronRight,
  Edit2,
  Globe,
  Lock,
  QrCode,
  ShieldCheck,
  Settings as SettingsIcon,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { TopBar, IconButton } from '../../components/TopBar';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { TagChip } from '../../components/TagChip';
import { tagById, type InterestTagId } from '../../data/interestTags';
import { useAuth } from '../../store/auth';
import type { RootStackParamList } from '../../navigation/types';

// Profile sub-pages are presented as modals over MainTabs. They aren't
// declared in RootStackParamList yet — using string literals; once we add
// them we can re-type to NativeStackNavigationProp<ProfileStackParamList>.
type AnyNav = NativeStackNavigationProp<any>;

export function ProfileScreen() {
  const theme = useTheme();
  const nav = useNavigation<AnyNav>();
  const user = useAuth((s) => s.user);

  if (!user) return null;

  const interests = (user.interests ?? []) as InterestTagId[];
  const prompts = user.prompts ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <TopBar
        right={
          <>
            <IconButton>
              <QrCode size={18} color={theme.colors.text} strokeWidth={1.6} />
            </IconButton>
            <IconButton onPress={() => nav.navigate('AccountSettings')}>
              <SettingsIcon size={18} color={theme.colors.text} strokeWidth={1.6} />
            </IconButton>
          </>
        }
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        {/* Hero card */}
        <LinearGradient
          colors={['#E8E3F5', '#FCE3F0', '#FFE0CC']}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, theme.shadows.soft]}
        >
          <Avatar
            name={user.nickname}
            uri={user.avatarUrl}
            avatarIdx={0}
            size={72}
            shape="circle"
          />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#3C2A4E' }}>
              {user.nickname}
            </Text>
            <Text style={{ fontSize: 13, color: 'rgba(60,42,78,0.7)', marginTop: 4 }}>
              {user.age ? `${user.age}` : ''}
            </Text>
            {user.bio ? (
              <Text
                numberOfLines={2}
                style={{ fontSize: 13, color: 'rgba(60,42,78,0.85)', marginTop: 8, lineHeight: 19 }}
              >
                {user.bio}
              </Text>
            ) : null}
          </View>
          <Button
            label="编辑资料"
            variant="soft"
            small
            leadingIcon={<Edit2 size={14} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
            onPress={() => nav.navigate('EditProfile')}
            style={{ alignSelf: 'flex-start' }}
          />
        </LinearGradient>

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <Stat label="同频" value="—" />
          <Stat label="好友" value="—" />
          <Stat label="动态" value="—" />
        </View>

        {/* My interests */}
        <SectionTitle>我的兴趣</SectionTitle>
        <View style={[styles.tagsRow]}>
          {interests.length > 0 ? (
            interests.map((id) => {
              const tag = tagById(id);
              if (!tag) return null;
              return <TagChip key={id} tag={tag} shared />;
            })
          ) : (
            <Text style={{ color: theme.colors.muted, fontSize: 13 }}>还没有兴趣</Text>
          )}
          <Pressable
            onPress={() => nav.navigate('TagsEdit')}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 9,
              borderRadius: 999,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: theme.colors.line,
            }}
          >
            <Text style={{ color: theme.colors.text2, fontSize: 14 }}>+ 管理</Text>
          </Pressable>
        </View>

        {/* My prompts */}
        <SectionTitle>个人答题</SectionTitle>
        {prompts.length > 0 ? (
          prompts.map((p, i) => (
            <Card key={i} surface2 flat style={{ padding: 14, marginBottom: 10 }}>
              <Text style={{ fontSize: 12, color: theme.colors.muted, marginBottom: 6 }}>
                {p.q}
              </Text>
              <Text
                style={{
                  fontFamily: 'Fraunces',
                  fontStyle: 'italic',
                  fontWeight: '500',
                  fontSize: 15,
                  lineHeight: 23,
                  color: theme.colors.text,
                }}
              >
                &ldquo;{p.a}&rdquo;
              </Text>
            </Card>
          ))
        ) : (
          <Text style={{ color: theme.colors.muted, fontSize: 13 }}>
            添加 prompt 让人更了解你
          </Text>
        )}
        <Pressable onPress={() => nav.navigate('PromptsEdit')} style={{ marginTop: 6 }}>
          <Text style={{ color: theme.colors.primary, fontSize: 13.5, fontWeight: '500' }}>
            + 添加问题
          </Text>
        </Pressable>

        {/* Settings rows */}
        <SectionTitle>设置</SectionTitle>
        <Card flat style={{ paddingVertical: 4 }}>
          <SettingsRow
            icon={<Lock size={18} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
            label="隐私"
            onPress={() => nav.navigate('PrivacySettings')}
          />
          <Divider />
          <SettingsRow
            icon={<Bell size={18} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
            label="通知"
            onPress={() => nav.navigate('NotificationSettings')}
          />
          <Divider />
          <SettingsRow
            icon={<Globe size={18} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
            label="语言"
            detail="中文"
            onPress={() => nav.navigate('LanguageSettings')}
          />
          <Divider />
          <SettingsRow
            icon={<ShieldCheck size={18} color={theme.colors.primaryDeep} strokeWidth={1.8} />}
            label="账户与安全"
            onPress={() => nav.navigate('AccountSettings')}
          />
        </Card>

        <Text
          style={{
            textAlign: 'center',
            marginTop: 32,
            color: theme.colors.muted,
            fontSize: 11.5,
          }}
        >
          Meyou · v2.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.l,
        borderWidth: 1,
        borderColor: theme.colors.line,
        paddingVertical: 14,
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: 20, fontWeight: '700', color: theme.colors.text }}>{value}</Text>
      <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 4 }}>{label}</Text>
    </View>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Text
      style={{
        fontSize: 12,
        color: theme.colors.muted,
        letterSpacing: 0.72,
        textTransform: 'uppercase',
        marginTop: 24,
        marginBottom: 12,
      }}
    >
      {children}
    </Text>
  );
}

function SettingsRow({
  icon,
  label,
  detail,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  detail?: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 14,
        gap: 12,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 9,
          backgroundColor: theme.colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </View>
      <Text style={{ flex: 1, fontSize: 15, color: theme.colors.text }}>{label}</Text>
      {detail && (
        <Text style={{ fontSize: 13, color: theme.colors.muted }}>{detail}</Text>
      )}
      <ChevronRight size={16} color={theme.colors.muted} strokeWidth={1.6} />
    </Pressable>
  );
}

function Divider() {
  const theme = useTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.line,
        marginHorizontal: 14,
      }}
    />
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 22,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 0,
  },
});
