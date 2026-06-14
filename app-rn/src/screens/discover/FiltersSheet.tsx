import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from 'react-native';
// IMPORTANT: ScrollView from react-native-gesture-handler, NOT react-native.
// The Sheet renders inside a GestureHandlerRootView/GestureDetector (RNGH) tree.
// On Android, RN-core ScrollView doesn't share RNGH's touch system, so once the
// list is scrolled the Pressables below the fold (the interest chips) stop
// receiving taps ("android 选择不到") — the distance pills work only because
// they sit above the fold. RNGH's ScrollView coordinates with the gesture tree
// so inner touchables fire on Android. Drop-in API-compatible on both platforms.
import { ScrollView } from 'react-native-gesture-handler';
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
  const { height: winH } = useWindowDimensions();
  const [radius, setRadius] = useState<number>(initial.radiusKm ?? DEFAULT_RADIUS);
  const [picked, setPicked] = useState<Set<InterestTagId>>(
    new Set(initial.interests ?? []),
  );

  // Re-sync ONLY when the sheet (re-)opens. Watching `initial.radiusKm` here
  // was previously fine but if the parent ever passed a new `initial` object
  // mid-edit (e.g. from a re-fetch) it'd stomp the user's selection. Gating
  // on just `open` is safer — initial values are only relevant at open time.
  useEffect(() => {
    if (open) {
      setRadius(initial.radiusKm ?? DEFAULT_RADIUS);
      setPicked(new Set(initial.interests ?? []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
      // 100 is the "不限 / unlimited" chip. We send 0 as the explicit
      // no-cap signal (NOT undefined — undefined would get swallowed by
      // every downstream `?? 10` fallback and silently revert to 10 km).
      // Backend treats radiusKm=0 as "no distance filter, sort by
      // distance only".
      radiusKm: radius === 100 ? 0 : radius,
      interests: picked.size > 0 ? Array.from(picked) : undefined,
    });
    onClose();
  };

  // Show user's own tags first, then the rest — they're the most likely
  // filter dimension.
  const sortedTags = [
    ...INTEREST_TAGS.filter((tag) => myInterests.includes(tag.id)),
    ...INTEREST_TAGS.filter((tag) => !myInterests.includes(tag.id)),
  ];

  // Bound the scroll viewport to a definite pixel height. The Sheet card is
  // position:absolute + maxHeight only (no definite height), so a flex:1
  // ScrollView routed through it can't compute a scroll viewport — it balloons
  // to full content height (48 chips) and the card overflows upward, pushing
  // the Distance section off the top with no way to scroll back. A concrete
  // maxHeight makes the ScrollView scroll; the footer is a sticky sibling below.
  // 80% mirrors <Sheet maxHeight="80%">; 140 reserves grabber(18) + card
  // padding(14+28) + footer(button 52 + marginTop 14).
  const scrollMaxH = winH * 0.8 - 140;

  return (
    <Sheet open={open} onClose={onClose} maxHeight="80%">
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        style={{ maxHeight: scrollMaxH }}
      >
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {t('discover.filters.title')}
        </Text>

        <Text style={[styles.section, { color: theme.colors.muted }]}>
          {t('discover.filters.distance')} ·{' '}
          {radius === 100 ? t('discover.filters.unlimited') : `${radius} km`}
        </Text>
        {/* Plain Pressable chips — Button component's internal style
            array + small + fullWidth + style-override combo was
            touch-unreliable in a 6-column flex row on Android. Direct
            Pressable removes the indirection. */}
        <View style={styles.radiusRow}>
          {RADIUS_OPTIONS.map((r) => {
            const active = radius === r;
            const label = r === 100 ? t('discover.filters.unlimited') : String(r);
            return (
              <Pressable
                key={r}
                onPress={() => setRadius(r)}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.radiusPill,
                  {
                    backgroundColor: active
                      ? theme.colors.primarySoft
                      : 'transparent',
                    borderColor: active
                      ? theme.colors.primary
                      : theme.colors.line,
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    color: active ? theme.colors.primaryDeep : theme.colors.text,
                    fontWeight: active ? '600' : '500',
                    fontSize: 13,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.section, { color: theme.colors.muted, marginTop: 22 }]}>
          {t('discover.filters.interests')} ·{' '}
          {picked.size === 0
            ? t('discover.filters.unlimited')
            : t('discover.filters.interestsCount', { n: picked.size })}
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
          <Button
            label={t('discover.filters.reset')}
            variant="ghost"
            onPress={reset}
            fullWidth
          />
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
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
