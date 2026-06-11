import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { useAuth } from '../store/auth';
import { useOnboarding } from '../store/onboarding';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';
import { OnboardingFlow } from '../screens/onboarding/OnboardingFlow';
import { ChatDetailScreen } from '../screens/chats/ChatDetailScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { TagsEditScreen } from '../screens/profile/TagsEditScreen';
import { PromptsEditScreen } from '../screens/profile/PromptsEditScreen';
import { MyMomentsScreen } from '../screens/profile/MyMomentsScreen';
import { FriendsListScreen } from '../screens/profile/FriendsListScreen';
import { MapPickerScreen } from '../screens/discover/MapPickerScreen';
import { SearchScreen } from '../screens/discover/SearchScreen';
import { MomentLikersScreen } from '../screens/moments/MomentLikersScreen';
import { MatchesListScreen } from '../screens/profile/MatchesListScreen';
import { SettingsScreen } from '../screens/profile/settings/SettingsScreen';
import { PrivacySettings } from '../screens/profile/settings/PrivacySettings';
import { BlockedListScreen } from '../screens/profile/settings/BlockedListScreen';
import { NotificationSettings } from '../screens/profile/settings/NotificationSettings';
import { LanguageSettings } from '../screens/profile/settings/LanguageSettings';
import { AccountSettings } from '../screens/profile/settings/AccountSettings';
import { AnnouncementAdminScreen } from '../screens/admin/AnnouncementAdminScreen';
import { AdminReportsScreen } from '../screens/admin/AdminReportsScreen';
import { AdminStatsScreen } from '../screens/admin/AdminStatsScreen';
import { AdminVerificationsScreen } from '../screens/admin/AdminVerificationsScreen';
import { VerificationScreen } from '../screens/profile/VerificationScreen';
import { MyAnalyticsScreen } from '../screens/profile/MyAnalyticsScreen';
import { PremiumGiftScreen } from '../screens/profile/PremiumGiftScreen';
import { CommentsScreen } from '../screens/moments/CommentsScreen';
import { ComposerScreen } from '../screens/moments/ComposerScreen';
import { ReportScreen } from '../screens/safety/ReportScreen';
import { PremiumScreen } from '../screens/premium/PremiumScreen';
import { UserDetailScreen } from '../screens/profile/UserDetailScreen';
import { LikedMeScreen } from '../screens/profile/LikedMeScreen';
import { ViewersScreen } from '../screens/profile/ViewersScreen';
import { NotesInboxScreen } from '../screens/chat/NotesInboxScreen';
import { WorldChatScreen } from '../screens/world-chat/WorldChatScreen';
import { CountryRoomsScreen } from '../screens/world-chat/CountryRoomsScreen';
import { LeaderboardScreen } from '../screens/world-chat/LeaderboardScreen';
import { CreateRoomScreen } from '../screens/world-chat/CreateRoomScreen';
import { NoteDetailScreen } from '../screens/chat/NoteDetailScreen';
import { VotesListScreen } from '../screens/votes/VotesListScreen';
import { VoteDetailScreen } from '../screens/votes/VoteDetailScreen';
import { CreateVoteScreen } from '../screens/votes/CreateVoteScreen';
import { SubmitEntryScreen } from '../screens/votes/SubmitEntryScreen';
import { EventUpdatesScreen } from '../screens/votes/EventUpdatesScreen';
import { PhotoRequestsScreen } from '../screens/profile/PhotoRequestsScreen';
import { TopicPersonaEditScreen } from '../screens/profile/TopicPersonaEditScreen';
import { UnlockRequestsScreen } from '../screens/profile/UnlockRequestsScreen';
import { NotificationCenter } from '../screens/notifications/NotificationCenter';
import { InviteFriendsScreen } from '../screens/invite/InviteFriendsScreen';
import { RedeemInviteScreen } from '../screens/invite/RedeemInviteScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const user = useAuth((s) => s.user);
  const onbDone = useOnboarding((s) => s.done);
  const onbHydrated = useOnboarding((s) => s.hydrated);
  const needsTags = !!user && !user.interestsOnboardedAt;
  const signedIn = !!user && !needsTags;
  // Only genuinely-new accounts (no photos, no prompts) see the intro, and only
  // once we've hydrated the persisted flag and confirmed it's not done. Gating on
  // `onbHydrated` is essential: before the AsyncStorage read resolves `onbDone`
  // is still its default `false`, so deciding on the unhydrated value would flash
  // the intro on EVERY cold launch for any fresh-but-already-onboarded user.
  const fresh = !!user && (user.photos?.length ?? 0) === 0 && (user.prompts?.length ?? 0) === 0;
  const showOnboarding = signedIn && fresh && onbHydrated && !onbDone;

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
      ) : showOnboarding ? (
        <Stack.Screen name="Onboarding" component={OnboardingFlow} />
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
          <Stack.Screen name="MapPicker" component={MapPickerScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="Search" component={SearchScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="MomentLikers" component={MomentLikersScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="MatchesList" component={MatchesListScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="PrivacySettings" component={PrivacySettings} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="BlockedList" component={BlockedListScreen} options={{ animation: 'slide_from_right' }} />
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
            name="Viewers"
            component={ViewersScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="NotificationCenter"
            component={NotificationCenter}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="InviteFriends"
            component={InviteFriendsScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="RedeemInvite"
            component={RedeemInviteScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="NotesInbox"
            component={NotesInboxScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="CountryRooms"
            component={CountryRoomsScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="WorldChatRoom"
            component={WorldChatScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="Leaderboard"
            component={LeaderboardScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="CreateRoom"
            component={CreateRoomScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="NoteDetail"
            component={NoteDetailScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen name="VotesList" component={VotesListScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="VoteDetail" component={VoteDetailScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="CreateVote" component={CreateVoteScreen} options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="SubmitEntry" component={SubmitEntryScreen} options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="EventUpdates" component={EventUpdatesScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen
            name="TopicPersonaEdit"
            component={TopicPersonaEditScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="UnlockRequests"
            component={UnlockRequestsScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="PhotoRequests"
            component={PhotoRequestsScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="AnnouncementAdmin"
            component={AnnouncementAdminScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen name="AdminReports" component={AdminReportsScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="AdminStats" component={AdminStatsScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="AdminVerifications" component={AdminVerificationsScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="Verification" component={VerificationScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="MyAnalytics" component={MyAnalyticsScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="PremiumGift" component={PremiumGiftScreen} options={{ animation: 'slide_from_right' }} />
        </>
      )}
    </Stack.Navigator>
  );
}
