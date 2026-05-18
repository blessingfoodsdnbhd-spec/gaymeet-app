import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Welcome: undefined;
  EmailEntry: undefined;
  OTPCode: { email: string };
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
  Call: { userId: string };
  // Profile sub-pages — presented as pushes over MainTabs.
  EditProfile: undefined;
  TagsEdit: undefined;
  PromptsEdit: undefined;
  PrivacySettings: undefined;
  NotificationSettings: undefined;
  LanguageSettings: undefined;
  AccountSettings: undefined;
  Comments: { momentId: string };
  Composer: undefined;
  Report: { userId: string; userName?: string };
};
