import React from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Gift, Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation } from '@tanstack/react-query';

import { useTheme } from '../../theme/ThemeProvider';
import { useAuth } from '../../store/auth';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { getFollowing, giftPremium, type FollowedUser } from '../../api/me';

/** Gift 7 days of Premium to a friend (item 8). Pick from your follows. */
export function PremiumGiftScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<any>();
  const c = theme.colors;
  const me = useAuth((s) => s.user);
  const myId = String((me as any)?.id ?? (me as any)?._id ?? '');
  const isPremium = !!me?.isPremium;

  const followingQ = useQuery({
    queryKey: ['users', 'following', myId],
    queryFn: () => getFollowing(myId),
    enabled: !!myId,
  });

  const giftMut = useMutation({
    mutationFn: (recipientId: string) => giftPremium(recipientId),
    onSuccess: (r) => Alert.alert(t('premiumGift.sentTitle'), t('premiumGift.sentBody', { days: r.days })),
    onError: (e: any) => {
      const code = e?.response?.status;
      const msg =
        code === 402 ? t('premiumGift.needPremium')
        : code === 429 ? t('premiumGift.rateLimited')
        : e?.response?.data?.error || t('premiumGift.failed');
      Alert.alert(t('premiumGift.failed'), msg);
    },
  });

  const confirm = (u: FollowedUser) => {
    if (!isPremium) {
      nav.navigate('Premium');
      return;
    }
    Alert.alert(
      t('premiumGift.confirmTitle', { name: u.nickname }),
      t('premiumGift.confirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('premiumGift.send'), onPress: () => giftMut.mutate(u._id) },
      ],
    );
  };

  const list = followingQ.data ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: c.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={theme.iconSize.l} color={c.text} />
        </Pressable>
        <Text style={[styles.title, { color: c.text }]}>{t('premiumGift.title')}</Text>
      </View>

      {!isPremium && (
        <Pressable
          onPress={() => nav.navigate('Premium')}
          style={({ pressed }) => [styles.banner, { backgroundColor: c.primarySoft, opacity: pressed ? 0.85 : 1 }]}
        >
          <Lock size={16} color={c.primaryDeep} strokeWidth={2} />
          <Text style={{ flex: 1, fontSize: 13, color: c.primaryDeep, fontWeight: '600' }}>{t('premiumGift.needPremium')}</Text>
        </Pressable>
      )}

      {followingQ.isLoading ? (
        <View style={styles.center}><ActivityIndicator color={c.primary} /></View>
      ) : list.length === 0 ? (
        <EmptyState emoji="🎁" title={t('premiumGift.emptyTitle')} subtitle={t('premiumGift.emptySubtitle')} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(u) => u._id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item }) => (
            <View style={[styles.row, { backgroundColor: c.surface, borderColor: c.line }]}>
              <Avatar uri={item.avatarUrl} name={item.nickname} size={44} />
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: c.text }} numberOfLines={1}>
                {item.nickname}
              </Text>
              <Pressable
                onPress={() => confirm(item)}
                disabled={giftMut.isPending}
                style={({ pressed }) => [styles.giftBtn, { backgroundColor: c.primary, opacity: pressed || giftMut.isPending ? 0.7 : 1 }]}
              >
                <Gift size={15} color="#FFFFFF" strokeWidth={2} />
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>{t('premiumGift.send')}</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 16, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, marginBottom: 0, borderRadius: 12, padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 10 },
  giftBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
});
