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
import { NameWithBadge } from '../../components/NameWithBadge';
import { Button } from '../../components/Button';
import { getLikedMe, type LikerUser } from '../../api/me';
import { computeAge, computeZodiac } from '../../utils/zodiac';
import { useAuth } from '../../store/auth';
import { UpgradePremiumSheet } from '../../components/UpgradePremiumSheet';
import { SortChipRow } from '../../components/SortChipRow';
import { sortList } from '../../utils/listSort';
import { useListSortPrefs } from '../../store/listSortPrefs';
import { deferOpen } from '../../utils/deferOpen';
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
      <LikedMeBody />
    </SafeAreaView>
  );
}

/**
 * The "who liked you" list WITHOUT the screen header — so it can be reused both
 * as the standalone LikedMeScreen and inline as the Discover "想认识你" tab body
 * (FFFF). Owns its own query, premium gating, sort, and upsell sheet.
 */
export function LikedMeBody() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const me = useAuth((s) => s.user);
  const isPremium = !!(me as any)?.isPremium;
  const [upsellOpen, setUpsellOpen] = React.useState(false);

  const likesQ = useQuery({
    queryKey: ['users', 'likedMe'],
    queryFn: getLikedMe,
    staleTime: 30_000,
  });

  const sortKey = useListSortPrefs((s) => s.sort.likes);
  const setSort = useListSortPrefs((s) => s.setSort);
  const sortOptions = [
    { key: 'recent', label: t('sort.receivedTime') },
    { key: 'distance', label: t('sort.distance') },
    { key: 'age', label: t('sort.age') },
    { key: 'active', label: t('sort.active') },
  ];
  const data = React.useMemo(() => {
    const users = (likesQ.data?.users ?? []).filter(Boolean);
    return isPremium
      ? sortList(users, sortKey, { distanceM: (u) => u.distanceM, dob: (u) => u.dob, lastActive: (u) => u.lastActiveAt })
      : users;
  }, [likesQ.data, sortKey, isPremium]);

  return (
    <>
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
          // Defense-in-depth: filter out null/undefined entries even though
          // the backend is supposed to do this server-side. populate() on a
          // Swipe whose fromUser was deleted returns null; rendering a null
          // row crashes FlatList via the keyExtractor + LikerRow._id access.
          data={data}
          keyExtractor={(u) => u._id}
          contentContainerStyle={{ paddingVertical: 4 }}
          ListHeaderComponent={
            isPremium ? (
              <SortChipRow options={sortOptions} active={sortKey} onChange={(k) => setSort('likes', k as any)} />
            ) : (likesQ.data?.count ?? 0) > 0 ? (
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
                isPremium
                  ? () => nav.navigate('UserDetail', { userId: item._id })
                  : () => deferOpen(() => setUpsellOpen(true))
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
      <UpgradePremiumSheet open={upsellOpen} onClose={() => setUpsellOpen(false)} reason={t('premium.upsell.likes')} />
    </>
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
          name={user.nickname || '?'}
          uri={user.avatarUrl}
          avatarIdx={idxFor(user._id)}
          size={48}
          blur={user.isBlurred}
          showOnline={!user.isBlurred && user.isOnline}
        />
        {user.isBlurred && (
          // The photo is blurred via expo-image blurRadius; a small lock under a
          // light veil reinforces the "locked behind Premium" intent.
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                borderRadius: 24,
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(60,42,78,0.28)',
              },
            ]}
          >
            <Lock size={16} color="#FFFFFF" strokeWidth={2} />
          </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        {user.isBlurred ? (
          <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.text }}>
            ••••
          </Text>
        ) : (
          <NameWithBadge
            name={user.nickname}
            official={user.isOfficial}
            verified={user.isVerified}
            premium={user.isPremium}
            textStyle={{ fontSize: 15, fontWeight: '600', color: theme.colors.text }}
            numberOfLines={1}
            badgeSize={14}
          />
        )}
        {!user.isBlurred && (() => {
          const a = computeAge(user.dob) ?? user.age;
          if (a == null) return null;
          const z = computeZodiac(user.dob);
          return (
            <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>
              {a}{z ? ` ${z.emoji}` : ''}
            </Text>
          );
        })()}
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
