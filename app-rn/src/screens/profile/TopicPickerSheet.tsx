import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
// RNGH Pressable + ScrollView — inside the Sheet's GestureHandlerRootView the
// RN-core versions eat the first Android touch (a topic row "needs several taps
// unless you scroll the list first"). RNGH's versions respond on first tap (Build 76).
import { Pressable, ScrollView } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react-native';

import { Sheet } from '../../components/Sheet';
import { useTheme } from '../../theme/ThemeProvider';
import { getTopics, type Topic } from '../../api/topics';
import { getMyPersonas } from '../../api/mePersonas';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (topic: Topic) => void;
}

/**
 * "Join a new topic" — sheet listing topics the user hasn't joined yet.
 * Already-joined topics are filtered out (so the picker advertises
 * NEW joins only); to edit an existing persona the user taps the row
 * directly from ProfileScreen.
 */
export function TopicPickerSheet({ open, onClose, onPick }: Props) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const locale: 'en' | 'zh' = i18n.language.startsWith('zh') ? 'zh' : 'en';

  const topicsQ = useQuery({
    queryKey: ['topics', 'list'],
    queryFn: getTopics,
    enabled: open,
    staleTime: 5 * 60_000,
  });

  const minePQ = useQuery({
    queryKey: ['me', 'topic-personas'],
    queryFn: getMyPersonas,
    enabled: open,
    staleTime: 30_000,
  });

  const joinedSlugs = new Set(
    (minePQ.data ?? []).filter((p) => p.isActive).map((p) => p.topicSlug),
  );
  const available = (topicsQ.data ?? []).filter((t) => !joinedSlugs.has(t.slug));

  return (
    <Sheet open={open} onClose={onClose} maxHeight="78%">
      <Text style={[styles.title, { color: theme.colors.text }]}>
        {t('topics.join')}
      </Text>

      {(topicsQ.isLoading || minePQ.isLoading) && (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      )}

      {!topicsQ.isLoading && !minePQ.isLoading && available.length === 0 && (
        <View style={styles.centered}>
          <Text style={{ color: theme.colors.muted, fontSize: 13, textAlign: 'center' }}>
            {t('topics.allJoined')}
          </Text>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        {available.map((tp) => (
          <Pressable
            key={tp.slug}
            onPress={() => onPick(tp)}
            hitSlop={6}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: pressed
                  ? theme.colors.surface2
                  : 'transparent',
              },
            ]}
          >
            <Text style={styles.rowIcon}>{tp.icon || '•'}</Text>
            <Text style={[styles.rowLabel, { color: theme.colors.text }]}>
              {tp.name[locale] ?? tp.name.en}
            </Text>
            <ChevronRight size={16} color={theme.colors.muted} strokeWidth={1.8} />
          </Pressable>
        ))}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  centered: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  rowIcon: { fontSize: 22 },
  rowLabel: { fontSize: 15, flex: 1 },
});
