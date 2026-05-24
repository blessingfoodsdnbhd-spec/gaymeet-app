import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Compass, MessageCircle, Newspaper, User } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import type { MainTabParamList } from './types';
import { useTheme } from '../theme/ThemeProvider';
import { DiscoverScreen } from '../screens/discover/DiscoverScreen';
import { MomentsScreen } from '../screens/moments/MomentsScreen';
import { ChatsListScreen } from '../screens/chats/ChatsListScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { requestLocation, getCurrentLocation } from '../utils/permissions';
import { updateLocation } from '../api/me';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  const theme = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

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
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarStyle: {
          height: theme.layout.tabBarHeight,
          paddingTop: 8,
          paddingBottom: 24,
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
        name="Discover"
        component={DiscoverScreen}
        options={{ tabBarLabel: t('tabs.discover') }}
      />
      <Tab.Screen
        name="Moments"
        component={MomentsScreen}
        options={{ tabBarLabel: t('tabs.moments') }}
      />
      <Tab.Screen
        name="Chats"
        component={ChatsListScreen}
        options={{ tabBarLabel: t('tabs.chats') }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: t('tabs.profile') }}
      />
    </Tab.Navigator>
  );
}
