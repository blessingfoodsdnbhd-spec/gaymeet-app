import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { getUserHighlights } from '../../api/votes';
import { medalFor } from './voteHelpers';
import { shortTime } from '../../utils/time';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * 高光时刻 / Highlights — a user's permanent top-3 contest placements. Renders
 * nothing when the user has none. Used on own Profile + others' UserDetail.
 */
export function HighlightsSection({ userId }: { userId: string }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();

  const q = useQuery({
    queryKey: ['votes', 'highlights', userId],
    queryFn: () => getUserHighlights(userId),
    staleTime: 60_000,
    enabled: !!userId,
  });
  const items = q.data?.highlights ?? [];
  if (items.length === 0) return null;
  const shown = items.slice(0, 5);
  const overflow = items.length - shown.length;

  return (
    <View style={{ marginTop: 8 }}>
      <Text style={{ fontSize: 12, letterSpacing: 0.7, textTransform: 'uppercase', color: theme.colors.muted, marginBottom: 12 }}>
        {t('votes.highlightsTitle')}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
        {shown.map((h) => (
          <Pressable
            key={h.id}
            disabled={!h.eventId}
            onPress={() => h.eventId && nav.navigate('VoteDetail', { eventId: h.eventId })}
            style={{ width: 116 }}
          >
            <View>
              <ExpoImage
                source={{ uri: h.entryPhotoUrl }}
                style={{ width: 116, height: 116, borderRadius: 14, backgroundColor: theme.colors.surface2 }}
                contentFit="cover"
              />
              <Text style={{ position: 'absolute', top: 4, left: 6, fontSize: 26 }}>{medalFor(h.rank)}</Text>
            </View>
            <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: theme.colors.text, marginTop: 6 }}>
              {h.eventTitle}
            </Text>
            <Text style={{ fontSize: 11, color: theme.colors.muted, marginTop: 1 }}>{shortTime(h.endedAt)}</Text>
          </Pressable>
        ))}
        {overflow > 0 && (
          <Pressable
            onPress={() => nav.navigate('VotesList')}
            style={{ width: 80, height: 116, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text2 }}>+{overflow}</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}
