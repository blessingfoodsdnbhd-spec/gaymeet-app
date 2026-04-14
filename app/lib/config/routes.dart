import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/register_screen.dart';
import '../features/onboarding/profile_setup_screen.dart';
import '../features/home/home_screen.dart';
import '../features/discover/discover_screen.dart';
import '../features/nearby/nearby_screen.dart';
import '../features/matches/matches_screen.dart';
import '../features/matches/match_success_screen.dart';
import '../features/chat/chat_list_screen.dart';
import '../features/chat/chat_room_screen.dart';
import '../features/profile/profile_screen.dart';
import '../features/profile/edit_profile_screen.dart';
import '../features/profile/settings_screen.dart';
import '../features/premium/premium_screen.dart';
import '../features/matches/likes_screen.dart';
import '../features/location/location_hub_screen.dart';
import '../features/location/nearby_grid_screen.dart';
import '../features/location/shout_screen.dart';
import '../features/location/popular_screen.dart';
import '../features/location/location_settings_screen.dart';
import '../features/saw_you/saw_you_screen.dart';
import '../features/saw_you/plate_inbox_screen.dart';
import '../features/saw_you/claim_plate_screen.dart';
import '../features/location/teleport_screen.dart';
import '../features/location/stealth_settings_screen.dart';
import '../features/moments/moments_feed_screen.dart';
import '../features/moments/create_moment_screen.dart';
import '../features/moments/moment_detail_screen.dart';
import '../features/gifts/coin_shop_screen.dart';
import '../features/gifts/gift_inbox_screen.dart';
import '../features/events/events_screen.dart';
import '../features/events/event_detail_screen.dart';
import '../features/events/create_event_screen.dart';
import '../features/events/calendar_screen.dart';
import '../core/models/moment.dart';
import '../core/models/event.dart';
import '../features/verification/verification_screen.dart';
import '../features/dm/dm_inbox_screen.dart';
import '../features/call/call_history_screen.dart';
import '../features/stickers/sticker_store_screen.dart';
import '../features/secret_code/secret_code_screen.dart';
import '../features/settings/language_screen.dart';
import '../features/settings/theme_screen.dart';
import '../features/health/health_reminder_screen.dart';
import '../features/referral/referral_screen.dart';
import '../features/referral/wallet_screen.dart';
import '../features/places/places_screen.dart';
import '../features/places/place_detail_screen.dart';
import '../features/places/create_place_screen.dart';
import '../core/models/place.dart';

final GlobalKey<NavigatorState> _rootNavigatorKey = GlobalKey<NavigatorState>();

GoRouter createRouter({required bool isLoggedIn}) {
  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: isLoggedIn ? '/home' : '/login',
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, __) => const RegisterScreen()),
      GoRoute(path: '/onboarding', builder: (_, __) => const ProfileSetupScreen()),
      GoRoute(path: '/home', builder: (_, __) => const HomeScreen()),
      GoRoute(path: '/discover', builder: (_, __) => const DiscoverScreen()),
      GoRoute(path: '/nearby', builder: (_, __) => const NearbyScreen()),
      GoRoute(path: '/matches', builder: (_, __) => const MatchesScreen()),
      GoRoute(
        path: '/match-success',
        builder: (_, state) {
          final extra = state.extra as Map<String, dynamic>;
          return MatchSuccessScreen(
              matchedUser: extra['user'], matchId: extra['matchId']);
        },
      ),
      GoRoute(path: '/chats', builder: (_, __) => const ChatListScreen()),
      GoRoute(
        path: '/chat/:matchId',
        builder: (_, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return ChatRoomScreen(
            matchId: state.pathParameters['matchId']!,
            otherUserId: extra?['userId'] ?? '',
            otherUserName: extra?['userName'] ?? 'Chat',
            otherUserAvatar: extra?['userAvatar'],
          );
        },
      ),
      GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
      GoRoute(path: '/profile/edit', builder: (_, __) => const EditProfileScreen()),
      GoRoute(path: '/settings', builder: (_, __) => const SettingsScreen()),
      GoRoute(path: '/premium', builder: (_, __) => const PremiumScreen()),
      GoRoute(path: '/likes', builder: (_, __) => const LikesScreen()),
      GoRoute(path: '/location', builder: (_, __) => const LocationHubScreen()),
      GoRoute(path: '/location/nearby', builder: (_, __) => const NearbyGridScreen()),
      GoRoute(path: '/location/shout', builder: (_, __) => const ShoutScreen()),
      GoRoute(path: '/location/popular', builder: (_, __) => const PopularScreen()),
      GoRoute(path: '/location/settings', builder: (_, __) => const LocationSettingsScreen()),
      GoRoute(path: '/saw-you', builder: (_, __) => const SawYouScreen()),
      GoRoute(path: '/saw-you/inbox', builder: (_, __) => const PlateInboxScreen()),
      GoRoute(path: '/saw-you/claim', builder: (_, __) => const ClaimPlateScreen()),
      GoRoute(path: '/teleport', builder: (_, __) => const TeleportScreen()),
      GoRoute(path: '/stealth', builder: (_, __) => const StealthSettingsScreen()),

      // ── Moments ──────────────────────────────────────────────────────────
      GoRoute(path: '/moments', builder: (_, __) => const MomentsFeedScreen()),
      GoRoute(path: '/moments/create', builder: (_, __) => const CreateMomentScreen()),
      GoRoute(
        path: '/moments/:id',
        builder: (_, state) {
          final moment = state.extra as Moment;
          return MomentDetailScreen(moment: moment);
        },
      ),

      // ── Gifts / Coins ─────────────────────────────────────────────────────
      GoRoute(path: '/coins', builder: (_, __) => const CoinShopScreen()),
      GoRoute(path: '/gifts/inbox', builder: (_, __) => const GiftInboxScreen()),

      // ── Verification ─────────────────────────────────────────────────────
      GoRoute(path: '/verification', builder: (_, __) => const VerificationScreen()),

      // ── Direct Messages ───────────────────────────────────────────────────
      GoRoute(path: '/dm/inbox', builder: (_, __) => const DmInboxScreen()),

      // ── Calls ─────────────────────────────────────────────────────────────
      GoRoute(path: '/call/history', builder: (_, __) => const CallHistoryScreen()),

      // ── Stickers ──────────────────────────────────────────────────────────
      GoRoute(path: '/stickers', builder: (_, __) => const StickerStoreScreen()),

      // ── Secret Code ───────────────────────────────────────────────────────
      GoRoute(path: '/secret-code', builder: (_, __) => const SecretCodeScreen()),

      // ── Settings sub-screens ─────────────────────────────────────────────
      GoRoute(path: '/settings/language', builder: (_, __) => const LanguageScreen()),
      GoRoute(path: '/settings/theme', builder: (_, __) => const ThemeScreen()),
      GoRoute(path: '/health-reminder', builder: (_, __) => const HealthReminderScreen()),

      // ── Referral & Wallet ─────────────────────────────────────────────────
      GoRoute(path: '/referral', builder: (_, __) => const ReferralScreen()),
      GoRoute(path: '/wallet', builder: (_, __) => const WalletScreen()),

      // ── Places ───────────────────────────────────────────────────────────
      GoRoute(path: '/places', builder: (_, __) => const PlacesScreen()),
      GoRoute(path: '/places/create', builder: (_, __) => const CreatePlaceScreen()),
      GoRoute(
        path: '/places/:id',
        builder: (_, state) {
          final place = state.extra as Place?;
          if (place != null) return PlaceDetailScreen(place: place);
          // Fallback: should not happen if navigating correctly
          return const PlacesScreen();
        },
      ),

      // ── Events ───────────────────────────────────────────────────────────
      GoRoute(path: '/events', builder: (_, __) => const EventsScreen()),
      GoRoute(path: '/events/calendar', builder: (_, __) => const EventsCalendarScreen()),
      GoRoute(path: '/events/create', builder: (_, __) => const CreateEventScreen()),
      GoRoute(
        path: '/events/:id',
        builder: (_, state) {
          final event = state.extra as AppEvent;
          return EventDetailScreen(event: event);
        },
      ),
    ],
  );
}
