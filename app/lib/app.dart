import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'config/theme.dart';
import 'config/routes.dart';
import 'core/providers/auth_provider.dart';
import 'core/providers/likes_provider.dart';
import 'core/providers/locale_provider.dart';
import 'core/providers/privacy_provider.dart';
import 'core/providers/promotion_provider.dart';
import 'core/providers/subscription_provider.dart';
import 'core/providers/theme_provider.dart';
import 'core/theme/app_theme.dart';
import 'shared/widgets/promo_popup.dart';

class GayMeetApp extends ConsumerStatefulWidget {
  const GayMeetApp({super.key});

  @override
  ConsumerState<GayMeetApp> createState() => _GayMeetAppState();
}

class _GayMeetAppState extends ConsumerState<GayMeetApp> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() async {
      await ref.read(authStateProvider.notifier).checkAuth();
      final user = ref.read(authStateProvider).user;
      if (user != null) {
        // Sync all user-derived providers
        ref.read(privacyProvider.notifier).syncFromServer(user.preferences);
        ref.read(subscriptionProvider.notifier).syncFromUser(user.isPremium);

        // Pre-fetch likes count (used for social proof in Premium screen
        // and "Who Liked You" section — runs in background)
        ref.read(likesProvider.notifier).fetchLikes();

        // Pre-fetch promotions, then show interstitial after 2 s
        ref.read(promotionProvider.notifier).fetch();
        Future.delayed(const Duration(seconds: 2), () {
          if (mounted) PromoPopup.showIfNeeded(context, ref);
        });

        // Schedule "no new matches" push notification if 24 h pass without
        // a match. Backend picks this up and sends FCM at the right time.
        _scheduleNoMatchNotification();
      }
    });
  }

  /// Asks the backend to schedule a push notification for the user if they
  /// haven't received a new match in 24 hours.
  /// FCM delivery is handled server-side; this just signals intent.
  void _scheduleNoMatchNotification() {
    // Ignore errors — this is best-effort
    ref
        .read(apiClientProvider)
        .dio
        .post('/notifications/schedule', data: {
          'type': 'no_matches_24h',
          'delayHours': 24,
        })
        .catchError((_) {});
  }

  @override
  Widget build(BuildContext context) {
    // Keep privacy settings in sync whenever auth state changes
    // (handles login after being on the login screen, token refresh, etc.)
    ref.listen<AuthState>(authStateProvider, (prev, next) {
      if (next.user != null) {
        ref
            .read(privacyProvider.notifier)
            .syncFromServer(next.user!.preferences);
        ref
            .read(subscriptionProvider.notifier)
            .syncFromUser(next.user!.isPremium);

        // Re-fetch likes when user logs in (prev was null → just signed in)
        if (prev?.user == null) {
          ref.read(likesProvider.notifier).fetchLikes();
          _scheduleNoMatchNotification();
        }
      }
    });

    final authState = ref.watch(authStateProvider);
    final themeMode = ref.watch(themeProvider);
    // localeProvider is watched here so locale changes rebuild the app
    ref.watch(localeProvider);

    final router = createRouter(isLoggedIn: authState.isLoggedIn);

    return MaterialApp.router(
      title: 'GayMeet',
      debugShowCheckedModeBanner: false,
      theme: AppThemeLight.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: themeMode,
      routerConfig: router,
    );
  }
}
