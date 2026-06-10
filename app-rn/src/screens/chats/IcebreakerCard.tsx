import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { useTheme } from '../../theme/ThemeProvider';
import { useAuth } from '../../store/auth';
import { getUserById } from '../../api/me';
import { tagById, type InterestTagId } from '../../data/interestTags';

/**
 * Conversation starters (ICE1). Shown above the composer when a chat has no
 * real messages yet. Suggests up to 3 openers — interest-based when the two
 * users share interests, padded with generic openers — that fill the composer
 * on tap so the user can send (or tweak) with one more tap.
 */
export function IcebreakerCard({
  otherUserId,
  onPick,
}: {
  otherUserId: string;
  onPick: (text: string) => void;
}) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const me = useAuth((s) => s.user);

  // Other user's interests — fetched lazily (only mounts on an empty chat).
  const userQ = useQuery({
    queryKey: ['users', 'detail', otherUserId],
    queryFn: () => getUserById(otherUserId),
    staleTime: 5 * 60_000,
    enabled: !!otherUserId,
  });

  const zh = i18n.language?.startsWith('zh');

  const suggestions = useMemo(() => {
    const mine = new Set((me?.interests ?? []) as InterestTagId[]);
    const theirs = (userQ.data?.interests ?? []) as InterestTagId[];
    const shared = theirs.filter((id) => mine.has(id));

    const out: string[] = [];
    for (const id of shared.slice(0, 2)) {
      const tag = tagById(id);
      if (!tag) continue;
      const label = `${tag.emoji} ${zh ? tag.zh : tag.en}`;
      out.push(t('chat.icebreakers.askInterest', { interest: label }));
    }
    const generics = [
      t('chat.icebreakers.generic1'),
      t('chat.icebreakers.generic2'),
      t('chat.icebreakers.generic3'),
    ];
    for (const g of generics) {
      if (out.length >= 3) break;
      out.push(g);
    }
    return out.slice(0, 3);
  }, [me?.interests, userQ.data?.interests, zh, t]);

  if (!suggestions.length) return null;

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.text2, marginBottom: 8 }}>
        {t('chat.icebreakers.header')}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
        {suggestions.map((s, i) => (
          <Pressable
            key={i}
            onPress={() => onPick(s)}
            style={({ pressed }) => ({
              backgroundColor: theme.colors.primarySoft,
              borderRadius: theme.radius.pill,
              paddingHorizontal: 14,
              paddingVertical: 9,
              maxWidth: 260,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ fontSize: 13.5, color: theme.colors.primaryDeep, fontWeight: '600' }} numberOfLines={2}>
              {s}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
