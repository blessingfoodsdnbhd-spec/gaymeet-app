import React, { useEffect } from 'react';
import { Text, View, Alert, Pressable, type GestureResponderEvent } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createBottomTabNavigator,
  type BottomTabBarButtonProps,
} from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { getConversations } from '../api/chats';
import { on as wsOn } from '../api/ws';

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Custom bottom-tab button. The stock button (@react-navigation/elements'
 * PlatformPressable) wraps an Animated.Pressable + web-hover layer. On the New
 * Architecture (Fabric) + Android that path intermittently DROPS the first tap
 * on the tab bar — you had to tap a tab 2–4 times before it switched (most
 * noticeable on Moments, but it was bar-wide, not Moments-specific). A plain RN
 * Pressable filling the whole cell registers every first tap. We forward the
 * exact props react-navigation hands the button (its flex/layout `style`, a11y
 * role/label, android_ripple, and the icon+badge `children`) and only drop the
 * web/hover-only extras the stock button adds. iOS never had the drop and keeps
 * a pressed-opacity cue so the tap still feels responsive there.
 */
function TabBarButton({
  onPress,
  onLongPress,
  testID,
  style,
  children,
  'aria-label': ariaLabel,
  'aria-selected': ariaSelected,
}: BottomTabBarButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      aria-label={ariaLabel}
      aria-selected={ariaSelected}
      testID={testID}
      onPress={onPress as ((e: GestureResponderEvent) => void) | undefined}
      onLongPress={onLongPress as ((e: GestureResponderEvent) => void) | undefined}
      android_ripple={{ borderless: true }}
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
    <Tab.Navigator
      initialRouteName={landProfile ? 'Profile' : 'Votes'}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.muted,
        // Plain-Pressable button — fixes the Android/Fabric first-tap drop.
        tabBarButton: (props) => <TabBarButton {...props} />,
        tabBarStyle: {
          // Respect the real bottom inset instead of a hardcoded 24. On Android
          // gesture-nav devices the system inset can exceed 24, so a fixed pad
          // let the lower edge of each tab button sit inside the OS gesture
          // strip — taps there were swallowed by the system, compounding the
          // "had to tap a few times" feel. max(inset,24) keeps the existing
          // look where inset ≤ 24 and lifts the buttons clear of the gesture
          // zone otherwise; the height grows by the same amount so the bar
          // isn't squished. iOS home-indicator devices get a touch more bottom
          // room too (never worse).
          height: theme.layout.tabBarHeight + Math.max(insets.bottom - 24, 0),
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 24),
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
        options={{ tabBarLabel: t('tabs.profile') }}
      />
    </Tab.Navigator>
  );
}
