import React, { useEffect } from 'react';
import { Text, View, Alert, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createBottomTabNavigator,
  type BottomTabBarButtonProps,
} from '@react-navigation/bottom-tabs';
import { Compass, Globe, MessageCircle, Newspaper, Trophy, User } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { MainTabParamList } from './types';
import { useTheme } from '../theme/ThemeProvider';
import { DiscoverScreen } from '../screens/discover/DiscoverScreen';
import { PlazaScreen } from '../screens/world-chat/PlazaScreen';
import { VotesTabScreen } from '../screens/votes/VotesTabScreen';
import { MomentsScreen } from '../screens/moments/MomentsScreen';
import { ChatsListScreen } from '../screens/chats/ChatsListScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import * as Location from 'expo-location';
import { requestLocation, getCurrentLocation } from '../utils/permissions';
import { updateLocation, patchMe } from '../api/me';
import { useAuth } from '../store/auth';
import { useOnboarding } from '../store/onboarding';
import { SetPasswordPromptModal } from '../components/auth/SetPasswordPromptModal';
import { getConversations } from '../api/chats';
import { getUnreadCount } from '../api/notifications';
import { on as wsOn } from '../api/ws';

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Android-only bottom-tab button. The stock button (@react-navigation/elements'
 * PlatformPressable) wraps an Animated.Pressable + web-hover layer; on the New
 * Architecture (Fabric) + Android that path intermittently DROPS the first tap,
 * so a tab needed 2–4 presses before it switched (most visible on the centre
 * tabs like Moments). A plain RN Pressable filling the whole cell registers the
 * first tap reliably. We forward exactly the props react-navigation hands the
 * button (its flex/layout `style`, a11y role/label/state, onPress, the icon +
 * badge `children`) and drop only the web/hover-only extras. iOS keeps the
 * stock button untouched (it never had the drop) — this is wired up Android-only.
 */
function TabBarButton({
  href: _href,
  pressColor: _pressColor,
  pressOpacity: _pressOpacity,
  hoverEffect: _hoverEffect,
  ref,
  style,
  children,
  ...rest
}: BottomTabBarButtonProps) {
  return (
    <Pressable
      {...rest}
      ref={ref as React.Ref<View>}
      style={({ pressed }) => [style, pressed && { opacity: 0.7 }]}
    >
      {children}
    </Pressable>
  );
}

export function MainTabs() {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // Only Android needs the gesture-bar clearance (see tabBarStyle below); on
  // iOS this stays 0 so the bar keeps its original 84 / 24 metrics exactly.
  const androidInset = Platform.OS === 'android' ? insets.bottom : 0;
  const queryClient = useQueryClient();

  // After onboarding finishes we mount fresh here — land on Profile once so the
  // completion card greets the new user, then clear the one-shot.
  const landProfile = useOnboarding((s) => s.landProfile);
  const clearLandProfile = useOnboarding((s) => s.clearLandProfile);
  useEffect(() => {
    if (landProfile) clearLandProfile();
  }, [landProfile, clearLandProfile]);

  // PUSH1 — deferred push permission. MainTabs only mounts once the user is in
  // the app proper (signed in AND past onboarding), so this is the right place
  // to ask. If permission is already granted we just refresh the token
  // silently; if it's undetermined we show a one-time priming explainer before
  // the real OS prompt (asking in context lifts opt-in vs. a cold launch
  // prompt). If they declined, we don't nag — NotificationSettings re-enables.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { getPushPermissionStatus, registerPushToken } = await import('../utils/push');
      const status = await getPushPermissionStatus();
      if (cancelled) return;
      if (status === 'granted') {
        registerPushToken().catch(() => {});
        return;
      }
      if (status !== 'undetermined') return; // denied → leave it to Settings
      const PRIMED_KEY = 'meyou.pushPrimed.v1';
      const primed = await AsyncStorage.getItem(PRIMED_KEY);
      if (cancelled || primed) return;
      Alert.alert(t('push.primeTitle'), t('push.primeBody'), [
        {
          text: t('push.primeLater'),
          style: 'cancel',
          onPress: () => AsyncStorage.setItem(PRIMED_KEY, '1').catch(() => {}),
        },
        {
          text: t('push.primeAllow'),
          onPress: () => {
            AsyncStorage.setItem(PRIMED_KEY, '1').catch(() => {});
            registerPushToken().catch(() => {});
          },
        },
      ]);
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  // Total unread for the Messages tab badge. Reuses the SAME ['chats','list']
  // query as ChatsListScreen (React Query dedupes by key) — ChatDetailScreen
  // already zeroes a thread's unreadCount in that cache on open, and new
  // messages invalidate it, so the sum stays correct. We add our own
  // chat:receive listener here too so the badge updates in real time even when
  // the Messages tab has never been opened (its listener wouldn't be mounted).
  const chatsQ = useQuery({
    queryKey: ['chats', 'list'],
    queryFn: getConversations,
    staleTime: 30_000,
  });
  const unreadTotal = (chatsQ.data ?? []).reduce(
    (sum, c) => sum + (c.unreadCount || 0),
    0,
  );

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;
    (async () => {
      const u = await wsOn('chat:receive', () => {
        if (!cancelled) queryClient.invalidateQueries({ queryKey: ['chats', 'list'] });
      });
      if (cancelled) {
        u();
        return;
      }
      unsub = u;
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [queryClient]);

  // Unread notification count for the Profile ("我") tab badge. Shares the
  // ['notifications','unread-count'] key with ProfileScreen (React Query
  // dedupes), so opening the Notification Center — which marks-all-read and
  // invalidates this key — clears the badge instantly. A 60 s poll is the
  // offline fallback; the notification:new socket event below refreshes it in
  // real time while connected.
  const unreadNotifQ = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: getUnreadCount,
    staleTime: 30_000,
    refetchInterval: 60_000,
    select: (d) => d.count,
  });
  const unreadNotif = unreadNotifQ.data ?? 0;

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;
    (async () => {
      const u = await wsOn('notification:new', () => {
        if (!cancelled)
          queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      });
      if (cancelled) {
        u();
        return;
      }
      unsub = u;
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [queryClient]);

  // Get the user's real GPS once per app session and push it to the
  // backend. Without this, the server falls back to whatever location is
  // stored on the user document (a stale default — often KL Bangsar from
  // seed data), so Discover/Nearby distances and the city label are all
  // computed against the wrong point.
  // Best-effort: silently no-op on permission denial or location failure.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const perm = await requestLocation();
        if (cancelled || perm !== 'granted') return;
        const pos = await getCurrentLocation();
        if (cancelled || !pos?.coords) return;
        await updateLocation(pos.coords.latitude, pos.coords.longitude);
        // Refresh Discover/Nearby cache so the new server-computed
        // distances appear without the user pulling-to-refresh.
        queryClient.invalidateQueries({ queryKey: ['discover'] });
        queryClient.invalidateQueries({ queryKey: ['nearby'] });

        // Reverse-geocode → auto-fill countryCode + city (powers the 广场
        // location prefix). OS-native, no API key. Best-effort: skip silently
        // on failure, and only PATCH when it actually changed to avoid churn.
        try {
          const geo = await Location.reverseGeocodeAsync({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          const g = geo?.[0];
          if (!cancelled && g) {
            const countryCode = g.isoCountryCode || undefined;
            const city = g.city || g.subregion || g.region || undefined;
            const cur = useAuth.getState().user;
            const changed =
              (countryCode && countryCode !== cur?.countryCode) ||
              (city && city !== cur?.city);
            if (changed) {
              const updated = await patchMe({ countryCode, city });
              if (!cancelled) useAuth.getState().setUser(updated);
            }
          }
        } catch {
          // reverse-geocode unavailable (offline, throttled) — non-fatal.
        }
      } catch {
        // Best-effort — permission denial, no GPS, network blip, etc.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  return (
    <>
    <Tab.Navigator
      initialRouteName={landProfile ? 'Profile' : 'Votes'}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.muted,
        // Android-only: swap the stock PlatformPressable for a plain Pressable
        // that doesn't drop the first Fabric tap. iOS uses the default button
        // (undefined) so nothing changes there.
        ...(Platform.OS === 'android'
          ? { tabBarButton: (props: BottomTabBarButtonProps) => <TabBarButton {...props} /> }
          : null),
        tabBarStyle: {
          // We target Android 15 (targetSdk 35), where edge-to-edge is enforced
          // by the OS: the tab bar draws UNDER the system gesture nav bar. The
          // old hardcoded paddingBottom:24 left the lower band of the centre
          // tabs sitting inside the gesture strip, where the OS swallows taps —
          // the "Moments needs 2-4 taps" report. Pad by the real bottom inset on
          // Android so every button clears the gesture zone, and grow the height
          // by the same overflow so the icons aren't squished. iOS is untouched:
          // androidInset is 0 there, so this resolves to the original 84 / 24.
          height: theme.layout.tabBarHeight + Math.max(androidInset - 24, 0),
          paddingTop: 8,
          paddingBottom: Math.max(androidInset, 24),
          backgroundColor: theme.colors.bg,
          borderTopColor: theme.colors.line,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 10.5,
          letterSpacing: 0.4,
        },
        tabBarIcon: ({ color, focused }) => {
          const size = 24;
          const strokeWidth = focused ? 2 : 1.6;
          switch (route.name) {
            case 'Discover':
              return <Compass color={color} size={size} strokeWidth={strokeWidth} />;
            case 'Votes':
              return <Trophy color={color} size={size} strokeWidth={strokeWidth} />;
            case 'WorldChat':
              return <Globe color={color} size={size} strokeWidth={strokeWidth} />;
            case 'Moments':
              return <Newspaper color={color} size={size} strokeWidth={strokeWidth} />;
            case 'Chats':
              return <MessageCircle color={color} size={size} strokeWidth={strokeWidth} />;
            case 'Profile':
              return <User color={color} size={size} strokeWidth={strokeWidth} />;
          }
          return null;
        },
      })}
    >
      <Tab.Screen
        name="Votes"
        component={VotesTabScreen}
        options={{ tabBarLabel: t('tabs.vote') }}
      />
      <Tab.Screen
        name="Discover"
        component={DiscoverScreen}
        options={{ tabBarLabel: t('tabs.discover') }}
      />
      <Tab.Screen
        name="WorldChat"
        component={PlazaScreen}
        options={{ tabBarLabel: t('tabs.worldChat') }}
      />
      <Tab.Screen
        name="Moments"
        component={MomentsScreen}
        options={{ tabBarLabel: t('tabs.moments') }}
      />
      <Tab.Screen
        name="Chats"
        component={ChatsListScreen}
        options={{
          tabBarLabel: t('tabs.chats'),
          // Badge appears with the count when there are unread messages, and
          // disappears (undefined) when the total drops to 0. Capped at 99+.
          tabBarBadge:
            unreadTotal > 0 ? (unreadTotal > 99 ? '99+' : unreadTotal) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: theme.colors.primary,
            color: '#FFFFFF',
            fontSize: 11,
          },
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: t('tabs.profile'),
          // Red unread-notification badge (WeChat/IG style). Shows the count,
          // caps at 99+, and clears (undefined) once everything's read — the
          // Notification Center marks-all-read on open and invalidates the
          // shared query key.
          tabBarBadge:
            unreadNotif > 0 ? (unreadNotif > 99 ? '99+' : unreadNotif) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: theme.colors.error,
            color: '#FFFFFF',
            fontSize: 11,
          },
        }}
      />
    </Tab.Navigator>
    {/* One-time post-login prompt for OTP-only accounts to set a password. */}
    <SetPasswordPromptModal />
    </>
  );
}
