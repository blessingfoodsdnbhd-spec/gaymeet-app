import React from 'react';
import { Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Compass, MessageCircle, Newspaper, User } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { MainTabParamList } from './types';
import { useTheme } from '../theme/ThemeProvider';
import { DiscoverScreen } from '../screens/discover/DiscoverScreen';
import { MomentsScreen } from '../screens/moments/MomentsScreen';
import { ChatsListScreen } from '../screens/chats/ChatsListScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  const theme = useTheme();
  const { t } = useTranslation();

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
