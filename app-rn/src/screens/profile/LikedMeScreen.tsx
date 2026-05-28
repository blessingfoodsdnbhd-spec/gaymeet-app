import React from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Crown, Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { getLikedMe, type LikerUser } from '../../api/me';
import { useAuth } from '../../store/auth';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function idxFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 10;
}

/**
 * "Who Liked You" — list of users who swiped LIKE/SUPER_LIKE on the
 * current user. Premium gets real profiles (tap → UserDetail); free sees
 * a blurred count + an upgrade CTA. Backend handles the gating: free
 * users receive rows with isBlurred=true and nickname '??'.
 */
export function LikedMeScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const me = useAuth((s) => s.user);
  const isPremium = !!(me as any)?.isPremium;

  const likesQ = useQuery({
    queryKey: ['users', 'likedMe'],
    queryFn: getLikedMe,
    staleTime: 30_000,
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ marginLeft: 8, fontSize: 16, fontWeight: '600', color: theme.colors.text }}>
          {t('likedMe.title')}
        </Text>
      </View>

      {likesQ.isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : likesQ.isError ? (
        <View style={styles.centerFill}>
          <Text style={{ color: theme.colors.muted, marginBottom: 12 }}>
            {t('likedMe.loadFailed')}
          </Text>
          <Button label={t('common.retry')} variant="soft" onPress={() => likesQ.refetch()} />
        </View>
      ) : (
        <FlatList
          data={likesQ.data?.users ?? []}
          keyExtractor={(u) => u._id}
          contentContainerStyle={{ paddingVertical: 4 }}
          ListHeaderComponent={
            !isPremium && (likesQ.data?.count ?? 0) > 0 ? (
              <UpgradeBanner count={likesQ.data?.count ?? 0} onPress={() => nav.navigate('Premium')} />
            ) : null
          }
          ItemSeparatorComponent={() => (
            <View
              style={{
                height: StyleSheet.hairlineWidth,
                backgroundColor: theme.colors.line,
                marginLeft: 76,
              }}
            />
          )}
          renderItem={({ item }) => (
            <LikerRow
              user={item}
              onPress={
                isPremium && !item.isBlurred
                  ? () => nav.navigate('UserDetail', { userId: item._id })
                  : () => nav.navigate('Premium')
              }
            />
          )}
          ListEmptyComponent={
            <View style={styles.centerFill}>
              <Text style={{ color: theme.colors.muted, textAlign: 'center' }}>
                {t('likedMe.empty')}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function UpgradeBanner({ count, onPress }: { count: number; onPress: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        marginHorizontal: 20,
        marginVertical: 14,
        padding: 16,
        borderRadius: 18,
        backgroundColor: theme.colors.primarySoft,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: theme.colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Crown size={22} color="#FFFFFF" strokeWidth={1.8} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text }}>
          {count}
        </Text>
        <Text style={{ fontSize: 13, color: theme.colors.text2, marginTop: 2 }}>
          {t('likedMe.upgradeCta')}
        </Text>
      </View>
    </Pressable>
  );
}

function LikerRow({ user, onPress }: { user: LikerUser; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 20,
        paddingVertical: 12,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View>
        <Avatar
          name={user.isBlurred ? '?' : user.nickname}
          uri={user.isBlurred ? null : user.avatarUrl}
          avatarIdx={idxFor(user._id)}
          size={48}
          showOnline={!user.isBlurred && user.isOnline}
        />
        {user.isBlurred && (
          // expo-blur is not installed; a translucent veil + lock icon
          // communicates the same "locked behind Premium" intent without a
          // GPU blur shader. Tint follows surface2 so it reads consistently
          // across light/dark themes.
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                borderRadius: 24,
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(232,227,245,0.78)',
              },
            ]}
          >
            <Lock size={16} color="rgba(60,42,78,0.78)" strokeWidth={1.8} />
          </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.text }}>
          {user.isBlurred ? '••••' : user.nickname}
        </Text>
        {!user.isBlurred && typeof user.age === 'number' && (
          <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>
            {user.age}
          </Text>
        )}
      </View>
    </Pressable>
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
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 28,
  },
});
