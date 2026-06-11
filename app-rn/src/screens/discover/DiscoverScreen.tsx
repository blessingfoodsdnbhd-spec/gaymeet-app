import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Crown, Heart, MapPin, Search, SlidersHorizontal, Send, Star, Volume2, VolumeX, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { TopBar, IconButton } from '../../components/TopBar';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';

import { CardStack, type CardStackHandle } from './CardStack';
import { NearbyGrid } from './NearbyGrid';
import { MatchOverlay } from './MatchOverlay';
import { AboutUserSheet } from './AboutUserSheet';
import { FiltersSheet } from './FiltersSheet';
import { BoostButton } from './BoostButton';
import { TopicTabs, type ActiveTab } from './TopicTabs';
import { LikedMeGrid } from './LikedMeGrid';
import { useDiscoverPrefs } from '../../store/discoverPrefs';
import { TopicPersonaList } from './TopicPersonaList';
import { TopicPersonaSheet } from './TopicPersonaSheet';
import { getTopics } from '../../api/topics';
import { TOPICS_ENABLED } from '../../config/featureFlags';
import {
  getDiscoverCards,
  getNearby,
  swipe,
  searchNewFriends,
  type DiscoverCardUser,
  type DiscoverFilters,
} from '../../api/discover';
import { SearchingOverlay } from './SearchingOverlay';
import { openConversation } from '../../api/chats';
import { useAuth } from '../../store/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { brandGradient } from '../../theme/tokens';
import { tagById, type InterestTagId } from '../../data/interestTags';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Tab state is now a discriminated union — system tabs (cards/nearby)
// plus dynamic topic tabs identified by slug. See TopicTabs.tsx for the
// union definition.
type Mode = ActiveTab;

/**
 * Device-scoped persistence key for the Discover/Nearby filter selection.
 * v1 schema = { radiusKm?: number; interests?: string[] } JSON-encoded.
 *
 * Per-device (not per-user) — same pattern as the language preference.
 * Account switching does NOT clear this; if that ever becomes a UX
 * problem we can namespace with userId.
 */
const FILTERS_STORAGE_KEY = 'meyou:discover-filters:v1';

export function DiscoverScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const locale: 'en' | 'zh' = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const me = useAuth((s) => s.user);
  // Virtual-location active = coords set (drives the header MapPin color, QQQQ).
  const virtualActive =
    me?.preferences?.virtualLat != null && me?.preferences?.virtualLng != null;
  const queryClient = useQueryClient();
  const nav = useNavigation<Nav>();
  const introVoice = useDiscoverPrefs((s) => s.introVoice);
  const setIntroVoice = useDiscoverPrefs((s) => s.setIntroVoice);

  const [mode, setMode] = useState<Mode>({ kind: 'cards' });
  // Currently-open topic persona, identified by (slug, userId). Null when
  // the persona sheet is closed. Keyed independently of `mode` so closing
  // the sheet doesn't switch tabs.
  const [openPersona, setOpenPersona] = useState<{
    slug: string;
    userId: string;
  } | null>(null);

  // Topic strip — loaded once and reused. Falls back to empty so the
  // user always sees at least 推薦 + 附近 even if the topics endpoint
  // is unreachable.
  const topicsQ = useQuery({
    queryKey: ['topics', 'list'],
    queryFn: getTopics,
    staleTime: 5 * 60_000,
    enabled: TOPICS_ENABLED,
  });
  // When topics are flag-disabled, the strip falls back to just 推荐 / 附近 and
  // `mode` can never become a topic mode, so TopicPersonaList/Sheet never render.
  const topics = TOPICS_ENABLED ? topicsQ.data ?? [] : [];
  const [aboutUser, setAboutUser] = useState<DiscoverCardUser | null>(null);
  // matchId is the freshly-created Match document id from the mutual-like
  // backend response. We need it to navigate the user from the celebration
  // overlay into the chat thread — previously we only kept the user object
  // and dropped match.id, so "Send a message" had nothing to navigate to.
  const [matched, setMatched] = useState<
    { user: DiscoverCardUser; matchId: string } | null
  >(null);
  const [filters, setFilters] = useState<DiscoverFilters>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [foundToast, setFoundToast] = useState<string | null>(null);
  // Gate persistence-back-to-storage until the initial load resolves —
  // without it, the empty useState({}) would clobber stored values on
  // every cold start before AsyncStorage.getItem returns.
  const [filtersHydrated, setFiltersHydrated] = useState(false);
  const stackRef = useRef<CardStackHandle>(null);

  // Load persisted filters once on mount. Stale interest IDs (tags
  // retired since the user set them) are dropped silently — they'd
  // otherwise render as missing chips in the FiltersSheet picker.
  useEffect(() => {
    AsyncStorage.getItem(FILTERS_STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw) as {
            radiusKm?: unknown;
            interests?: unknown;
          };
          const validInterests = (
            Array.isArray(parsed.interests) ? parsed.interests : []
          ).filter(
            (id): id is InterestTagId =>
              typeof id === 'string' && !!tagById(id as InterestTagId),
          );
          setFilters({
            radiusKm:
              typeof parsed.radiusKm === 'number' ? parsed.radiusKm : undefined,
            interests: validInterests.length > 0 ? validInterests : undefined,
          });
        } catch {
          // Corrupt storage — fall back to defaults
        }
      })
      .catch(() => {})
      .finally(() => setFiltersHydrated(true));
  }, []);

  // Persist whenever filters change, but only after the initial load
  // has completed (see comment on filtersHydrated). Errors swallowed —
  // a failed write just means next cold start sees the prior value.
  useEffect(() => {
    if (!filtersHydrated) return;
    AsyncStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters)).catch(
      () => {},
    );
  }, [filters, filtersHydrated]);

  const openIntroChat = async (user: DiscoverCardUser) => {
    try {
      const res = await openConversation(user.id);
      queryClient.invalidateQueries({ queryKey: ['chats', 'list'] });
      nav.navigate('ChatDetail', { chatId: res.matchId });
    } catch (e: any) {
      const status = e?.response?.status;
      const body = e?.response?.data;
      if (status === 402 && body?.reason === 'premium_required') {
        const monthly = body?.pricing?.monthly?.price ?? 39.9;
        const annual = body?.pricing?.annual?.price ?? 399.9;
        Alert.alert(
          t('discover.premiumTitle'),
          t('discover.premiumBody', { monthly, annual }),
          [{ text: t('discover.premiumOk') }],
        );
      } else {
        Alert.alert(
          t('discover.openFailedTitle'),
          body?.error || e?.message || t('discover.openFailedFallback'),
        );
      }
    }
  };
  // Use `!== undefined` (not `!!`) so radiusKm=0 (the "不限/unlimited"
  // sentinel) registers as an active filter and the filter-dot shows.
  const hasActiveFilters =
    filters.radiusKm !== undefined || (filters.interests?.length ?? 0) > 0;

  // Ids swiped this session. A background deck refetch (triggered when the deck
  // runs low, or by the post-match cache invalidation) can race the swipe POST
  // and return the just-swiped user again before the server has recorded the
  // swipe — which made cards "come back" (a matched card reappearing after the
  // overlay, or a swipe appearing to need a second try). Filtering the deck
  // through this set guarantees a swiped user never reappears regardless of
  // refetch timing.
  const swipedIds = useRef<Set<string>>(new Set());

  // Cards query — key includes filters so changing them refetches cleanly.
  const cardsQ = useQuery({
    queryKey: ['discover', 'cards', filters.radiusKm ?? null, filters.interests ?? null],
    queryFn: () => getDiscoverCards(10, filters),
    staleTime: 30_000,
    select: (data: DiscoverCardUser[]) => data.filter((u) => !swipedIds.current.has(u.id)),
  });

  // Nearby query — keyed on the same filter dimensions as cardsQ so that
  // applying a new radius or interest set in the FiltersSheet actually
  // triggers a refetch. (Previously the key was static ['discover','nearby']
  // and the queryFn hardcoded 10km, so Filters silently did nothing on the
  // Nearby tab — only Cards reflected filter changes.)
  const nearbyQ = useQuery({
    queryKey: ['discover', 'nearby', filters.radiusKm ?? null, filters.interests ?? null],
    queryFn: () => getNearby(filters.radiusKm ?? 10, filters),
    enabled: mode.kind === 'nearby',
    staleTime: 60_000,
  });

  const swipeMut = useMutation({
    mutationFn: ({ userId, action }: { userId: string; action: 'like' | 'pass' }) =>
      swipe(userId, action),
  });

  const handleSwiped = (user: DiscoverCardUser, liked: boolean) => {
    const cardsKey = [
      'discover',
      'cards',
      filters.radiusKm ?? null,
      filters.interests ?? null,
    ];

    // Mark swiped so a racy refetch can't bring this user back (see swipedIds).
    swipedIds.current.add(user.id);

    // Optimistically remove the top card from the cache
    queryClient.setQueryData<DiscoverCardUser[]>(cardsKey, (prev) =>
      (prev ?? []).filter((u) => u.id !== user.id),
    );

    // Background-prefetch when the deck gets low
    const remaining = (cardsQ.data ?? []).length - 1;
    if (remaining < 3) {
      queryClient.invalidateQueries({ queryKey: ['discover', 'cards'] });
    }

    swipeMut.mutate(
      { userId: user.id, action: liked ? 'like' : 'pass' },
      {
        onSuccess: (res) => {
          if (res.match) {
            // Capture the matchId — needed by the overlay's "Send a
            // message" CTA to navigate into the new chat thread.
            setMatched({ user, matchId: res.match.id });
            // Freshen the chats list cache so when the user lands in
            // ChatDetail, the new thread is also present in the list.
            queryClient.invalidateQueries({ queryKey: ['chats', 'list'] });
          }
        },
        onError: (e: any) => {
          // Roll back the optimistic removal so the user can retry. Drop from
          // swipedIds too, otherwise the select() filter would hide the
          // rolled-back card.
          swipedIds.current.delete(user.id);
          queryClient.setQueryData<DiscoverCardUser[]>(cardsKey, (prev) =>
            prev?.some((u) => u.id === user.id) ? prev : [user, ...(prev ?? [])],
          );
          const status = e?.response?.status;
          const detail =
            e?.response?.data?.error || e?.response?.data?.message || e?.message || 'unknown';
          Alert.alert(t('discover.swipeFailed'), `${detail}${status ? ` (HTTP ${status})` : ''}`);
        },
      },
    );
  };

  // Radar search — run the backend search, keep the animation up for at least
  // ~2.4s for the effect, then inject the fresh (not-already-present, not-swiped)
  // candidates into the deck and toast the count.
  const runSearch = async () => {
    if (searching) return;
    setSearching(true);
    const startedAt = Date.now();
    try {
      const found = await searchNewFriends(filters);
      const elapsed = Date.now() - startedAt;
      if (elapsed < 2400) await new Promise((r) => setTimeout(r, 2400 - elapsed));

      const cardsKey = [
        'discover',
        'cards',
        filters.radiusKm ?? null,
        filters.interests ?? null,
      ];
      let added = 0;
      queryClient.setQueryData<DiscoverCardUser[]>(cardsKey, (prev) => {
        const existing = new Set((prev ?? []).map((u) => u.id));
        const fresh = found.filter(
          (u) => !existing.has(u.id) && !swipedIds.current.has(u.id),
        );
        added = fresh.length;
        return [...(prev ?? []), ...fresh];
      });

      setSearching(false);
      // Make sure the user lands on the 推荐 deck where the new cards now sit.
      setMode({ kind: 'cards' });
      setFoundToast(t('discover.searching.found', { n: added }));
      setTimeout(() => setFoundToast(null), 2400);
    } catch (e: any) {
      setSearching(false);
      const detail = e?.response?.data?.error || e?.message || '';
      Alert.alert(t('discover.searching.failed'), detail);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <SearchingOverlay open={searching} />
      {foundToast && (
        <View style={styles.foundToast} pointerEvents="none">
          <Text style={styles.foundToastText}>{foundToast}</Text>
        </View>
      )}
      <TopBar
        title={t('tabs.discover')}
        right={
          <>
            {/* SEARCH1 — the header magnifier now opens unified search
                (users / votes / rooms). The "find new nearby friends" radar
                (runSearch / searchNewFriends) is kept for re-use as a
                pull-to-refresh; see follow-up note in the SEARCH1 commit. */}
            <IconButton onPress={() => nav.navigate('Search')}>
              <Search size={18} color={theme.colors.text} strokeWidth={1.6} />
            </IconButton>
            {/* QQQQ — virtual location: pink/filled when active, gray when off.
                Tap → MapPicker for everyone (Save is premium-gated there). */}
            <IconButton onPress={() => nav.navigate('MapPicker')}>
              <MapPin
                size={18}
                color={virtualActive ? theme.colors.primary : theme.colors.muted}
                fill={virtualActive ? theme.colors.primary : 'transparent'}
                strokeWidth={virtualActive ? 2 : 1.6}
              />
            </IconButton>
            {/* 🔊 介绍声音 — when on, opening a profile auto-plays their voice intro. */}
            <IconButton onPress={() => setIntroVoice(!introVoice)}>
              {introVoice ? (
                <Volume2 size={18} color={theme.colors.primary} strokeWidth={2} />
              ) : (
                <VolumeX size={18} color={theme.colors.text} strokeWidth={1.6} />
              )}
            </IconButton>
            <BoostButton />
            <IconButton onPress={() => setFiltersOpen(true)}>
              <View>
                <SlidersHorizontal size={18} color={theme.colors.text} strokeWidth={1.6} />
                {hasActiveFilters && (
                  <View
                    style={{
                      position: 'absolute',
                      top: -3,
                      right: -3,
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: theme.colors.primary,
                    }}
                  />
                )}
              </View>
            </IconButton>
          </>
        }
      />

      {/* Horizontal pill-tab strip below the TopBar. 推薦/附近 first,
          then dynamic topics from /api/topics. */}
      <TopicTabs
        topics={topics}
        active={mode}
        onChange={setMode}
        locale={locale}
      />

      {mode.kind === 'cards' ? (
        <CardsBody
          cardsQ={cardsQ}
          stackRef={stackRef}
          onOpenAbout={(u) => setAboutUser(u)}
          onSwiped={handleSwiped}
          onSendIntro={openIntroChat}
        />
      ) : mode.kind === 'nearby' ? (
        <NearbyBody nearbyQ={nearbyQ} onOpen={(u) => setAboutUser(u)} />
      ) : mode.kind === 'likedme' ? (
        // FFFF + JJJJ — "想认识你" as the same 2/3/4-col grid as 附近, fed by
        // who-liked-you data. Premium gating / blur handled inside.
        <LikedMeGrid />
      ) : (
        <TopicPersonaList
          slug={mode.slug}
          topic={topics.find((tp) => tp.slug === mode.slug)}
          locale={locale}
          onOpenPersona={(it) =>
            setOpenPersona({ slug: mode.slug, userId: it.userId })
          }
        />
      )}

      <AboutUserSheet
        open={aboutUser != null}
        user={aboutUser}
        onClose={() => setAboutUser(null)}
        onLike={() => {
          const u = aboutUser;
          setAboutUser(null);
          if (u) handleSwiped(u, true);
        }}
      />

      <MatchOverlay
        open={matched != null}
        matchedUser={matched?.user ?? null}
        me={me}
        onMessage={() => {
          // Capture both before clearing so the navigate target survives
          // the state update.
          const matchId = matched?.matchId;
          setMatched(null);
          if (matchId) nav.navigate('ChatDetail', { chatId: matchId });
        }}
        onLater={() => setMatched(null)}
      />

      <FiltersSheet
        open={filtersOpen}
        initial={filters}
        myInterests={(me?.interests ?? []) as InterestTagId[]}
        onApply={(f) => setFilters(f)}
        onClose={() => setFiltersOpen(false)}
      />

      {/* Topic persona detail sheet — keyed on (slug, userId). Closing
          clears the state so the next tap mounts fresh. */}
      <TopicPersonaSheet
        open={openPersona != null}
        slug={openPersona?.slug ?? null}
        userId={openPersona?.userId ?? null}
        topicName={(() => {
          const tp = topics.find((t) => t.slug === openPersona?.slug);
          return tp ? tp.name[locale] ?? tp.name.en ?? tp.slug : undefined;
        })()}
        topicIcon={topics.find((t) => t.slug === openPersona?.slug)?.icon}
        onClose={() => setOpenPersona(null)}
      />
    </SafeAreaView>
  );
}

function CardsBody({
  cardsQ,
  stackRef,
  onOpenAbout,
  onSwiped,
  onSendIntro,
}: {
  cardsQ: ReturnType<typeof useQuery<DiscoverCardUser[]>>;
  stackRef: React.RefObject<CardStackHandle>;
  onOpenAbout: (u: DiscoverCardUser) => void;
  onSwiped: (u: DiscoverCardUser, liked: boolean) => void;
  onSendIntro: (u: DiscoverCardUser) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const me = useAuth((s) => s.user);
  // The direct-intro (✈️) badge is an upgrade nudge — only show it to users who
  // don't already have Premium. Mirrors the `!!isPremium` check used elsewhere
  // in Discover (LikedMeGrid, BoostButton); vipLevel covers the legacy flag.
  const isPremium = !!(me as any)?.isPremium || ((me as any)?.vipLevel ?? 0) > 0;

  if (cardsQ.isLoading) {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }
  if (cardsQ.isError) {
    return (
      <View style={styles.centerFill}>
        <Text style={{ color: theme.colors.muted, fontSize: 14, marginBottom: 12 }}>
          {t('discover.networkError')}
        </Text>
        <Button label={t('common.retry')} onPress={() => cardsQ.refetch()} variant="soft" />
      </View>
    );
  }
  const cards = cardsQ.data ?? [];
  const top = cards[0];

  if (!top) {
    return (
      <View style={styles.centerFill}>
        <EmptyState
          emoji="🍵"
          title={t('discover.emptyTitle')}
          subtitle={t('discover.emptySubtitle')}
          primaryLabel={t('discover.redo')}
          onPrimary={() => cardsQ.refetch()}
          secondaryLabel={t('empty.discoverEnd.cta')}
          onSecondary={() => nav.navigate('Main', { screen: 'WorldChat' })}
        />
      </View>
    );
  }

  return (
    <>
      <View style={{ flex: 1 }}>
        <CardStack ref={stackRef} cards={cards} onSwiped={onSwiped} />
      </View>
      <View style={styles.actionBar}>
        <CircleBtn
          icon={<X size={22} color="#9F8675" strokeWidth={2.4} />}
          bg="#FFFFFF"
          border
          onPress={() => stackRef.current?.swipe(false)}
        />
        <CircleBtn
          icon={<Star size={18} color={theme.colors.primaryDeep} strokeWidth={2} fill={theme.colors.primaryDeep} />}
          bg={theme.colors.primarySoft}
          small
          onPress={() => onOpenAbout(top)}
        />
        <CircleBtnPrimary onPress={() => stackRef.current?.swipe(true)} />
        {/* Direct-intro button — DMing unmatched profiles is Premium-gated
            (server enforces it; a Free tap surfaces the paywall). The corner
            badge is an upgrade nudge, so it's shown to Free users only;
            Premium users get the clean icon with no label. */}
        <View>
          <CircleBtn
            icon={<Send size={18} color="#B14B59" strokeWidth={2} />}
            bg={theme.colors.accentRoseSoft}
            small
            onPress={() => onSendIntro(top)}
          />
          {!isPremium && (
            <View pointerEvents="none" style={styles.proCorner}>
              <Crown size={9} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={styles.proCornerText}>{t('discover.premiumLabel')}</Text>
            </View>
          )}
        </View>
      </View>
    </>
  );
}

function NearbyBody({
  nearbyQ,
  onOpen,
}: {
  nearbyQ: ReturnType<typeof useQuery<DiscoverCardUser[]>>;
  onOpen: (u: DiscoverCardUser) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  if (nearbyQ.isLoading) {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }
  if (nearbyQ.isError) {
    return (
      <View style={styles.centerFill}>
        <Text style={{ color: theme.colors.muted, fontSize: 14 }}>{t('discover.loadNearbyFailed')}</Text>
        <Button label={t('common.retry')} onPress={() => nearbyQ.refetch()} variant="soft" style={{ marginTop: 12 }} />
      </View>
    );
  }
  const users = nearbyQ.data ?? [];
  return (
    <View style={{ flex: 1 }}>
      {/* DDDDD — map view removed; 附近 is grid-only now. */}
      <NearbyGrid users={users} onOpen={onOpen} />
    </View>
  );
}

function CircleBtn({
  icon,
  bg,
  border,
  small,
  onPress,
}: {
  icon: React.ReactNode;
  bg: string;
  border?: boolean;
  small?: boolean;
  onPress?: () => void;
}) {
  const size = small ? 46 : 56;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        borderWidth: border ? 1 : 0,
        borderColor: 'rgba(0,0,0,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.85 : 1,
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 12,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      {icon}
    </Pressable>
  );
}

function CircleBtnPrimary({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <LinearGradient
        colors={[...brandGradient.colors] as [string, string, ...string[]]}
        locations={[...brandGradient.locations] as [number, number, ...number[]]}
        start={brandGradient.start}
        end={brandGradient.end}
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 8,
          shadowColor: '#4F8FE8',
          shadowOpacity: 0.35,
          shadowOffset: { width: 0, height: 8 },
          shadowRadius: 24,
        }}
      >
        <Heart size={26} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2} />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  foundToast: {
    position: 'absolute',
    top: 96,
    alignSelf: 'center',
    zIndex: 50,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.82)',
  },
  foundToastText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 18,
    paddingTop: 4,
    paddingBottom: 14,
    paddingHorizontal: 20,
  },
  proCorner: {
    position: 'absolute',
    top: -6,
    right: -10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#6B4FE0',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  proCornerText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
