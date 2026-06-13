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
  Search: undefined;
  AdminReports: undefined;
  AdminStats: undefined;
  AdminVerifications: undefined;
  AdminUserModeration: { userId: string };
  Verification: undefined;
  MyAnalytics: undefined;
  PremiumGift: undefined;
  TagsEdit: undefined;
  PromptsEdit: undefined;
  MyMoments: undefined;
  FriendsList: undefined;
  MomentLikers: { momentId: string };
  /** Full-screen map picker. Default `virtual` edits the Premium virtual
   *  location; `moment` returns the picked place to the composer (AAAAA). */
  MapPicker: { mode?: 'virtual' | 'moment' } | undefined;
  MatchesList: undefined;
  Settings: undefined;
  PrivacySettings: undefined;
  BlockedList: undefined;
  NotificationSettings: undefined;
  LanguageSettings: undefined;
  ChatTranslation: undefined;
  AccountSettings: undefined;
  Comments: { momentId: string; authorId?: string };
  /** New moment, or — when `edit` is passed — edit an existing one (PATCH).
   *  `edit` carries the prefill: id + content + photos + tagged friends +
   *  location, so the composer opens populated and saves instead of posts. */
  Composer:
    | {
        edit?: {
          id: string;
          content: string;
          images: string[];
          tagged: { _id: string; nickname: string }[];
          place: { lat: number; lng: number; label: string } | null;
        };
      }
    | undefined;
  Report: { userId: string; userName?: string };
  UserDetail: { userId: string; previewMode?: boolean };
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
  WorldChatRoom: { roomId?: string; title?: string; custom?: boolean; scrollToMessageId?: string };
  /** Phase 4 room list inside a 二级频道: a country (4 fixed sub-boards + UGC) or
   *  a friend/voice/interest channel (总聊天室 + UGC). `kind` picks the layout. */
  ChannelRooms: {
    channelId: string;
    title: string;
    kind: 'country' | 'friend' | 'voice' | 'interest';
    flag?: string;
  };
  /** Create a user room inside a 二级频道. */
  CreateRoom: { channelId: string; title: string; kind?: 'country' | 'friend' | 'voice' | 'interest' };
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
  RedeemInvite: { code?: string } | undefined;
};
