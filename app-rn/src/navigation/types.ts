import type { NavigatorScreenParams } from '@react-navigation/native';
import type { InboxNote } from '../api/notes';

export type AuthStackParamList = {
  Welcome: undefined;
  EmailEntry: undefined;
  OTPCode: { email: string; devCode?: string };
  InterestTagsPicker: undefined;
};

export type MainTabParamList = {
  Discover: undefined;
  Moments: undefined;
  Chats: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  ChatDetail: { chatId: string };
  // Profile sub-pages — presented as pushes over MainTabs.
  EditProfile: undefined;
  TagsEdit: undefined;
  PromptsEdit: undefined;
  MyMoments: undefined;
  FriendsList: undefined;
  MatchesList: undefined;
  PrivacySettings: undefined;
  NotificationSettings: undefined;
  LanguageSettings: undefined;
  AccountSettings: undefined;
  Comments: { momentId: string };
  Composer: undefined;
  Report: { userId: string; userName?: string };
  UserDetail: { userId: string };
  Premium: undefined;
  LikedMe: undefined;
  Viewers: undefined;
  NotesInbox: undefined;
  NoteDetail: { note: InboxNote };
  PhotoRequests: undefined;
  TopicPersonaEdit: {
    topicSlug: string;
    topicName: string;
    topicIcon?: string;
  };
  UnlockRequests: undefined;
  AnnouncementAdmin: undefined;
};
