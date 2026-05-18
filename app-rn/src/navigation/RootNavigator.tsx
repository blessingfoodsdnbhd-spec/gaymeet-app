import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { useAuth } from '../store/auth';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';
import { ChatDetailScreen } from '../screens/chats/ChatDetailScreen';
import { CallScreen } from '../screens/call/CallScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { TagsEditScreen } from '../screens/profile/TagsEditScreen';
import { PromptsEditScreen } from '../screens/profile/PromptsEditScreen';
import { PrivacySettings } from '../screens/profile/settings/PrivacySettings';
import { NotificationSettings } from '../screens/profile/settings/NotificationSettings';
import { LanguageSettings } from '../screens/profile/settings/LanguageSettings';
import { AccountSettings } from '../screens/profile/settings/AccountSettings';
import { CommentsScreen } from '../screens/moments/CommentsScreen';
import { ComposerScreen } from '../screens/moments/ComposerScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const user = useAuth((s) => s.user);
  const needsTags = !!user && !user.interestsOnboardedAt;
  const signedIn = !!user && !needsTags;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!signedIn ? (
        <Stack.Screen name="Auth">
          {() => <AuthStack needsTags={needsTags} />}
        </Stack.Screen>
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="ChatDetail"
            component={ChatDetailScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="Call"
            component={CallScreen}
            options={{ presentation: 'fullScreenModal', animation: 'fade' }}
          />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="TagsEdit" component={TagsEditScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="PromptsEdit" component={PromptsEditScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="PrivacySettings" component={PrivacySettings} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="NotificationSettings" component={NotificationSettings} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="LanguageSettings" component={LanguageSettings} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="AccountSettings" component={AccountSettings} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="Comments" component={CommentsScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen
            name="Composer"
            component={ComposerScreen}
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
