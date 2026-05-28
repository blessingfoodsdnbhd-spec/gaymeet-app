import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { useAuth } from '../store/auth';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';
import { ChatDetailScreen } from '../screens/chats/ChatDetailScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { TagsEditScreen } from '../screens/profile/TagsEditScreen';
import { PromptsEditScreen } from '../screens/profile/PromptsEditScreen';
import { MyMomentsScreen } from '../screens/profile/MyMomentsScreen';
import { FriendsListScreen } from '../screens/profile/FriendsListScreen';
import { MatchesListScreen } from '../screens/profile/MatchesListScreen';
import { PrivacySettings } from '../screens/profile/settings/PrivacySettings';
import { NotificationSettings } from '../screens/profile/settings/NotificationSettings';
import { LanguageSettings } from '../screens/profile/settings/LanguageSettings';
import { AccountSettings } from '../screens/profile/settings/AccountSettings';
import { CommentsScreen } from '../screens/moments/CommentsScreen';
import { ComposerScreen } from '../screens/moments/ComposerScreen';
import { ReportScreen } from '../screens/safety/ReportScreen';
import { PremiumScreen } from '../screens/premium/PremiumScreen';
import { UserDetailScreen } from '../screens/profile/UserDetailScreen';
import { LikedMeScreen } from '../screens/profile/LikedMeScreen';
import { PhotoRequestsScreen } from '../screens/profile/PhotoRequestsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const user = useAuth((s) => s.user);
  const needsTags = !!user && !user.interestsOnboardedAt;
  const signedIn = !!user && !needsTags;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!signedIn ? (
        <Stack.Screen name="Auth">
          {/* The `key` forces AuthStack to fully remount when needsTags
              toggles. Without it, the inner navigator's initialRouteName
              (which is only consulted at mount) is ignored — a new user
              who just signed in via Google / email / Apple would stay
              stuck on the Welcome screen instead of being routed to
              InterestTagsPicker. That was the "Google sign-in completes
              but app stays on Welcome with no error" bug from build #11. */}
          {() => (
            <AuthStack
              key={needsTags ? 'auth-needs-tags' : 'auth-welcome'}
              needsTags={needsTags}
            />
          )}
        </Stack.Screen>
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="ChatDetail"
            component={ChatDetailScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="TagsEdit" component={TagsEditScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="PromptsEdit" component={PromptsEditScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="MyMoments" component={MyMomentsScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="FriendsList" component={FriendsListScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="MatchesList" component={MatchesListScreen} options={{ animation: 'slide_from_right' }} />
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
          <Stack.Screen
            name="Report"
            component={ReportScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="Premium"
            component={PremiumScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="UserDetail"
            component={UserDetailScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="LikedMe"
            component={LikedMeScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="PhotoRequests"
            component={PhotoRequestsScreen}
            options={{ animation: 'slide_from_right' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
