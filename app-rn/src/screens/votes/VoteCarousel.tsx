import React from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { listVoteEvents } from '../../api/votes';
import { VoteEventCard } from './VoteEventCard';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * "🔥 投票活动" horizontal strip of active contests for the Discover tab — the
 * prominent, default-visible entry point that reframes Meyou as a community
 * app (Apple 4.3(b)). Renders nothing when there are no active events.
 */
export function VoteCarousel() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();

  const q = useQuery({
    queryKey: ['votes', 'carousel'],
    queryFn: () => listVoteEvents({ status: 'active', limit: 10 }),
    staleTime: 30_000,
  });
  const events = q.data?.events ?? [];
  if (events.length === 0) return null;

  return (
    <View style={{ paddingTop: 8, paddingBottom: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 }}>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: theme.colors.text }}>
          🔥 {t('votes.carouselTitle')}
        </Text>
        <Pressable onPress={() => nav.navigate('VotesList')} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 13, color: theme.colors.primary, fontWeight: '600' }}>{t('votes.seeAll')}</Text>
          <ChevronRight size={16} color={theme.colors.primary} />
        </Pressable>
      </View>
      <FlatList
        data={events}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        renderItem={({ item }) => (
          <VoteEventCard event={item} width={210} onPress={() => nav.navigate('VoteDetail', { eventId: item.id })} />
        )}
      />
    </View>
  );
}
