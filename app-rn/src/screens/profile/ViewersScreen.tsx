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
import { getViewers, type ViewerUser } from '../../api/me';
import { computeAge, computeZodiac } from '../../utils/zodiac';
import { shortTime } from '../../utils/time';
import { useAuth } from '../../store/auth';
import { EmptyState } from '../../components/EmptyState';
import { UpgradePremiumSheet } from '../../components/UpgradePremiumSheet';
import { SortChipRow } from '../../components/SortChipRow';
import { sortList } from '../../utils/listSort';
import { useListSortPrefs } from '../../store/listSortPrefs';
import { shareProfile } from '../../utils/shareProfile';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function idxFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 10;
}

/**
 * "谁在看你" — users who recently opened your profile. Premium gets real
 * profiles (tap → UserDetail); free sees a blurred count + an upgrade CTA.
 * Backend gates: free users receive rows with isBlurred=true / nickname '??'.
 */
export function ViewersScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const me = useAuth((s) => s.user);
  const isPremium = !!(me as any)?.isPremium;
  const [upsellOpen, setUpsellOpen] = React.useState(false);

  const viewersQ = useQuery({
    queryKey: ['users', 'viewers'],
    queryFn: getViewers,
    staleTime: 30_000,
  });

  const sortKey = useListSortPrefs((s) => s.sort.viewers);
  const setSort = useListSortPrefs((s) => s.setSort);
  const sortOptions = [
    { key: 'recent', label: t('sort.viewedTime') },
    { key: 'distance', label: t('sort.distance') },
    { key: 'age', label: t('sort.age') },
    { key: 'active', label: t('sort.active') },
  ];
  const data = React.useMemo(() => {
    const viewers = (viewersQ.data?.viewers ?? []).filter(Boolean);
    return isPremium
      ? sortList(viewers, sortKey, { distanceM: (u) => u.distanceM, dob: (u) => u.dob, lastActive: (u) => u.lastActiveAt })
      : viewers;
  }, [viewersQ.data, sortKey, isPremium]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ marginLeft: 8, fontSize: 16, fontWeight: '600', color: theme.colors.text }}>
          {t('viewers.title')}
        </Text>
      </View>

      {viewersQ.isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : viewersQ.isError ? (
        <View style={styles.centerFill}>
          <Text style={{ color: theme.colors.muted, marginBottom: 12 }}>
            {t('viewers.loadFailed')}
          </Text>
          <Button label={t('common.retry')} variant="soft" onPress={() => viewersQ.refetch()} />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(u) => u._id}
          contentContainerStyle={{ paddingVertical: 4 }}
          ListHeaderComponent={
            isPremium ? (
              <SortChipRow options={sortOptions} active={sortKey} onChange={(k) => setSort('viewers', k as any)} />
            ) : (viewersQ.data?.count ?? 0) > 0 ? (
              <UpgradeBanner count={viewersQ.data?.count ?? 0} onPress={() => nav.navigate('Premium')} />
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
            <ViewerRow
              user={item}
              onPress={
                isPremium
                  ? () => nav.navigate('UserDetail', { userId: item._id })
                  : () => setUpsellOpen(true)
              }
            />
          )}
          ListEmptyComponent={
            <EmptyState
              emoji="👀"
              title={t('viewers.empty')}
              subtitle={t('empty.viewers.subtitle')}
              primaryLabel={t('empty.viewers.cta')}
              onPrimary={() => me && shareProfile(me.id, me.nickname, t)}
            />
          }
        />
      )}
      <UpgradePremiumSheet open={upsellOpen} onClose={() => setUpsellOpen(false)} reason={t('premium.upsell.viewers')} />
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
          {t('viewers.upgradeCta')}
        </Text>
      </View>
    </Pressable>
  );
}

function ViewerRow({ user, onPress }: { user: ViewerUser; onPress: () => void }) {
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
            official={(user as any).isOfficial}
            verified={(user as any).isVerified}
            premium={(user as any).isPremium}
            textStyle={{ fontSize: 15, fontWeight: '600', color: theme.colors.text }}
            numberOfLines={1}
            badgeSize={14}
          />
        )}
        <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>
          {user.isBlurred
            ? shortTime(user.viewedAt)
            : (() => {
                const a = computeAge(user.dob);
                const z = computeZodiac(user.dob);
                const parts = [shortTime(user.viewedAt)];
                if (a != null) parts.unshift(`${a}${z ? ` ${z.emoji}` : ''}`);
                return parts.join(' · ');
              })()}
        </Text>
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
