import React from 'react';
import { View, Text, FlatList, Pressable, useWindowDimensions } from 'react-native';
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
 * Prominent "🔥 投票活动" feed for the top of Discover — full-width LARGE event
 * cards in a bounded, internally-scrolling list so contests read as the primary
 * content (Apple 4.3(b): community feed, not a swipe stack). The people deck
 * sits below in the remaining space. Renders nothing when no active events.
 */
export function VoteFeed() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const { height } = useWindowDimensions();

  const q = useQuery({
    queryKey: ['votes', 'feed'],
    queryFn: () => listVoteEvents({ status: 'active', limit: 10 }),
    staleTime: 30_000,
  });
  const events = q.data?.events ?? [];
  if (events.length === 0) return null;

  return (
    <View style={{ maxHeight: height * 0.58, paddingTop: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 }}>
        <Text style={{ flex: 1, fontSize: 17, fontWeight: '800', color: theme.colors.text }}>
          🔥 {t('votes.carouselTitle')}
        </Text>
        <Pressable onPress={() => nav.navigate('VotesList')} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 13, color: theme.colors.primary, fontWeight: '600' }}>{t('votes.seeAll')}</Text>
          <ChevronRight size={16} color={theme.colors.primary} />
        </Pressable>
      </View>
      <FlatList
        data={events}
        keyExtractor={(e) => e.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 14 }}
        renderItem={({ item }) => (
          <VoteEventCard event={item} onPress={() => nav.navigate('VoteDetail', { eventId: item.id })} />
        )}
      />
    </View>
  );
}
