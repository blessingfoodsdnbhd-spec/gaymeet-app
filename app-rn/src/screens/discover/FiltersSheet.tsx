import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { TagChip } from '../../components/TagChip';
import { useTheme } from '../../theme/ThemeProvider';
import { INTEREST_TAGS, type InterestTagId } from '../../data/interestTags';
import type { DiscoverFilters } from '../../api/discover';

interface Props {
  open: boolean;
  initial: DiscoverFilters;
  /** User's own interests — pre-checked options. */
  myInterests: InterestTagId[];
  onApply: (filters: DiscoverFilters) => void;
  onClose: () => void;
}

const RADIUS_OPTIONS = [2, 5, 10, 25, 50, 100];
const DEFAULT_RADIUS = 10;

export function FiltersSheet({ open, initial, myInterests, onApply, onClose }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [radius, setRadius] = useState<number>(initial.radiusKm ?? DEFAULT_RADIUS);
  const [picked, setPicked] = useState<Set<InterestTagId>>(
    new Set(initial.interests ?? []),
  );

  // Re-sync when the sheet (re-)opens with new initial values
  useEffect(() => {
    if (open) {
      setRadius(initial.radiusKm ?? DEFAULT_RADIUS);
      setPicked(new Set(initial.interests ?? []));
    }
  }, [open, initial.radiusKm, initial.interests]);

  const toggle = (id: InterestTagId) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  const reset = () => {
    setRadius(DEFAULT_RADIUS);
    setPicked(new Set());
  };

  const apply = () => {
    onApply({
      radiusKm: radius === 100 ? undefined : radius,
      interests: picked.size > 0 ? Array.from(picked) : undefined,
    });
    onClose();
  };

  // Show user's own tags first, then the rest — they're the most likely
  // filter dimension.
  const sortedTags = [
    ...INTEREST_TAGS.filter((t) => myInterests.includes(t.id)),
    ...INTEREST_TAGS.filter((t) => !myInterests.includes(t.id)),
  ];

  return (
    <Sheet open={open} onClose={onClose} maxHeight="80%">
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{t('discover.filters.title')}</Text>

        <Text style={[styles.section, { color: theme.colors.muted }]}>
          {t('discover.filters.distance')} · {radius === 100 ? t('discover.filters.unlimited') : `${radius} km`}
        </Text>
        <View style={styles.radiusRow}>
          {RADIUS_OPTIONS.map((r) => {
            const active = radius === r;
            return (
              <View key={r} style={{ flex: 1 }}>
                <Button
                  label={r === 100 ? t('discover.filters.unlimited') : `${r}`}
                  variant={active ? 'soft' : 'ghost'}
                  onPress={() => setRadius(r)}
                  small
                  fullWidth
                  // Button's default `paddingHorizontal: 22` (44px total)
                  // leaves only ~6px of inner Text width when 6 pills
                  // share a single flex:1 row on a ~335px sheet. That
                  // forced "10" / "25" / "All" to wrap character-by-
                  // character. Override to a tight padding here.
                  style={styles.radiusPill}
                />
              </View>
            );
          })}
        </View>

        <Text style={[styles.section, { color: theme.colors.muted, marginTop: 22 }]}>
          {t('discover.filters.interests')} · {picked.size === 0 ? t('discover.filters.unlimited') : t('discover.filters.interestsCount', { n: picked.size })}
        </Text>
        <View style={styles.tagsRow}>
          {sortedTags.map((tag) => (
            <TagChip
              key={tag.id}
              tag={tag}
              selected={picked.has(tag.id)}
              onPress={() => toggle(tag.id)}
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <Button label={t('discover.filters.reset')} variant="ghost" onPress={reset} fullWidth />
        </View>
        <View style={{ flex: 2 }}>
          <Button label={t('discover.filters.apply')} onPress={apply} fullWidth />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  section: {
    fontSize: 12,
    letterSpacing: 0.72,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  radiusRow: {
    flexDirection: 'row',
    gap: 6,
  },
  radiusPill: {
    paddingHorizontal: 4,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
});
