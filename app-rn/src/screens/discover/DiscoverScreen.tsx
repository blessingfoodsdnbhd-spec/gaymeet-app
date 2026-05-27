import React, { useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heart, SlidersHorizontal, Send, Star, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { TopBar, IconButton } from '../../components/TopBar';
import { Button } from '../../components/Button';

import { CardStack, type CardStackHandle } from './CardStack';
import { NearbyGrid } from './NearbyGrid';
import { MatchOverlay } from './MatchOverlay';
import { AboutUserSheet } from './AboutUserSheet';
import { FiltersSheet } from './FiltersSheet';
import {
  getDiscoverCards,
  getNearby,
  swipe,
  type DiscoverCardUser,
  type DiscoverFilters,
} from '../../api/discover';
import { openConversation } from '../../api/chats';
import { useAuth } from '../../store/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { brandGradient } from '../../theme/tokens';
import type { InterestTagId } from '../../data/interestTags';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Mode = 'cards' | 'nearby';

export function DiscoverScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const me = useAuth((s) => s.user);
  const queryClient = useQueryClient();
  const nav = useNavigation<Nav>();

  const [mode, setMode] = useState<Mode>('cards');
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
  const stackRef = useRef<CardStackHandle>(null);

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

  // Cards query — key includes filters so changing them refetches cleanly.
  const cardsQ = useQuery({
    queryKey: ['discover', 'cards', filters.radiusKm ?? null, filters.interests ?? null],
    queryFn: () => getDiscoverCards(10, filters),
    staleTime: 30_000,
  });

  // Nearby query — keyed on the same filter dimensions as cardsQ so that
  // applying a new radius or interest set in the FiltersSheet actually
  // triggers a refetch. (Previously the key was static ['discover','nearby']
  // and the queryFn hardcoded 10km, so Filters silently did nothing on the
  // Nearby tab — only Cards reflected filter changes.)
  const nearbyQ = useQuery({
    queryKey: ['discover', 'nearby', filters.radiusKm ?? null, filters.interests ?? null],
    queryFn: () => getNearby(filters.radiusKm ?? 10, filters),
    enabled: mode === 'nearby',
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
          // Roll back the optimistic removal so the user can retry.
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <TopBar
        center={
          <View
            style={{
              flexDirection: 'row',
              padding: 3,
              borderRadius: 999,
              backgroundColor: theme.colors.surface2,
              borderWidth: 1,
              borderColor: theme.colors.line,
            }}
          >
            {([
              { id: 'cards', label: t('discover.modeCards') },
              { id: 'nearby', label: t('discover.modeNearby') },
            ] as { id: Mode; label: string }[]).map((tab) => {
              const active = mode === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => setMode(tab.id)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 7,
                    borderRadius: 999,
                    backgroundColor: active ? theme.colors.surface : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      // muted (#8E8DA0) was too washed out for an
                      // interactive segmented control — use text2 so the
                      // inactive label still reads clearly.
                      color: active ? theme.colors.text : theme.colors.text2,
                    }}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        }
        left={null}
        right={
          <>
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

      {mode === 'cards' ? (
        <CardsBody
          cardsQ={cardsQ}
          stackRef={stackRef}
          onOpenAbout={(u) => setAboutUser(u)}
          onSwiped={handleSwiped}
          onSendIntro={openIntroChat}
        />
      ) : (
        <NearbyBody nearbyQ={nearbyQ} onOpen={(u) => setAboutUser(u)} />
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
        <Text
          style={{
            color: theme.colors.text,
            fontSize: 18,
            fontWeight: '600',
            marginBottom: 6,
          }}
        >
          {t('discover.emptyTitle')}
        </Text>
        <Text style={{ color: theme.colors.muted, fontSize: 14, textAlign: 'center' }}>
          {t('discover.emptySubtitle')}
        </Text>
        <Button
          label={t('discover.redo')}
          variant="soft"
          onPress={() => cardsQ.refetch()}
          style={{ marginTop: 24 }}
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
        <CircleBtn
          icon={<Send size={18} color="#B14B59" strokeWidth={2} />}
          bg={theme.colors.accentRoseSoft}
          small
          onPress={() => onSendIntro(top)}
        />
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
  return <NearbyGrid users={nearbyQ.data ?? []} onOpen={onOpen} />;
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
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 18,
    paddingTop: 4,
    paddingBottom: 14,
    paddingHorizontal: 20,
  },
});
