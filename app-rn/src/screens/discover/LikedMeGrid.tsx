import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';

import { useTheme } from '../../theme/ThemeProvider';
import { useAuth } from '../../store/auth';
import { NearbyGrid } from './NearbyGrid';
import { EmptyState } from '../../components/EmptyState';
import { UpgradePremiumSheet } from '../../components/UpgradePremiumSheet';
import { getLikedMe } from '../../api/me';
import type { DiscoverCardUser } from '../../api/discover';

function idxFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 10;
}

/**
 * "想认识你" tab body (JJJJ) — the same 2/3/4-column NearbyGrid as 附近, fed by
 * the who-liked-you data instead of nearby. Free users see blurred tiles + an
 * upgrade CTA; Premium taps through to the profile. Replaces the old 1-column
 * LikedMeBody list on this tab.
 */
export function LikedMeGrid() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<any>();
  const me = useAuth((s) => s.user);
  const isPremium = !!(me as any)?.isPremium;
  const [upsellOpen, setUpsellOpen] = React.useState(false);

  const likesQ = useQuery({ queryKey: ['users', 'likedMe'], queryFn: getLikedMe, staleTime: 30_000 });

  // Map LikerUser → the shape NearbyGrid's Tile renders. isBlurred drives the
  // grid's locked-tile blur (added in JJJJ).
  const users = React.useMemo<DiscoverCardUser[]>(
    () =>
      (likesQ.data?.users ?? []).filter(Boolean).map(
        (u) =>
          ({
            id: u._id,
            nickname: u.isBlurred ? '••••' : u.nickname,
            avatarUrl: u.avatarUrl ?? null,
            isOnline: !u.isBlurred && !!u.isOnline,
            isBlurred: u.isBlurred,
            avatarIdx: idxFor(u._id),
            distance: null,
            distKm: null,
            sharedTags: [],
          }) as any,
      ),
    [likesQ.data],
  );

  if (likesQ.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }
  if (!users.length) {
    return <EmptyState emoji="💗" title={t('likedMe.empty')} />;
  }

  const onOpen = (u: DiscoverCardUser) => {
    if (!isPremium) {
      setUpsellOpen(true);
      return;
    }
    nav.navigate('UserDetail', { userId: u.id });
  };

  const count = likesQ.data?.count ?? users.length;

  return (
    <View style={{ flex: 1 }}>
      {!isPremium && count > 0 && (
        <Pressable
          onPress={() => nav.navigate('Premium')}
          style={({ pressed }) => [
            styles.banner,
            { backgroundColor: theme.colors.primarySoft, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={{ color: theme.colors.primaryDeep, fontSize: 13, fontWeight: '700' }}>
            👀 {t('likedMe.upgradeCta')}
          </Text>
        </Pressable>
      )}
      <NearbyGrid users={users} onOpen={onOpen} countLabel={String(count)} />
      <UpgradePremiumSheet open={upsellOpen} onClose={() => setUpsellOpen(false)} reason={t('premium.upsell.likes')} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  banner: {
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
  },
});
