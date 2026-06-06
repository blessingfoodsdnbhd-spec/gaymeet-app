import type { NavigatorScreenParams } from '@react-navigation/native';
import type { InboxNote, SentNote } from '../api/notes';

export type AuthStackParamList = {
  Welcome: undefined;
  EmailEntry: undefined;
  OTPCode: { email: string; devCode?: string; inviteCode?: string };
  InterestTagsPicker: undefined;
};

export type MainTabParamList = {
  Discover: undefined;
  Votes: undefined;
  WorldChat: undefined;
  Moments: undefined;
  Chats: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  /** First-run intro for new accounts, shown before Main. */
  Onboarding: undefined;
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
  VotesList: undefined;
  VoteDetail: { eventId: string };
  CreateVote: { editEventId?: string } | undefined;
  SubmitEntry: { eventId: string };
  EventUpdates: { eventId: string; isCreator?: boolean };
  NotesInbox: undefined;
  /** A World Chat room (广场). roomId 'world' = global; a country code; or a
   *  24-hex custom ChatRoom id. `custom` flags a user-created room. */
  WorldChatRoom: { roomId?: string; title?: string; custom?: boolean };
  /** Room list inside one country (general + user-created rooms). */
  CountryRooms: { countryCode: string; title: string };
  /** Create a user room inside a country. */
  CreateRoom: { countryCode: string; title: string };
  /** Inbox mode passes `note`; outbox (已发出) mode passes `sent`. */
  NoteDetail: { note?: InboxNote; sent?: SentNote };
  PhotoRequests: undefined;
  TopicPersonaEdit: {
    topicSlug: string;
    topicName: string;
    topicIcon?: string;
  };
  UnlockRequests: undefined;
  AnnouncementAdmin: undefined;
  NotificationCenter: undefined;
  InviteFriends: undefined;
  RedeemInvite: undefined;
};
