import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'config/routes.dart';
import 'core/providers/auth_provider.dart';
import 'core/providers/likes_provider.dart';
import 'core/providers/locale_provider.dart';
import 'core/providers/privacy_provider.dart';
import 'core/providers/promotion_provider.dart';
import 'core/providers/subscription_provider.dart';
import 'core/providers/theme_provider.dart';
import 'core/theme/app_theme.dart';
import 'features/maintenance/maintenance_screen.dart';
import 'shared/widgets/promo_popup.dart';

class MeetupNearbyApp extends ConsumerStatefulWidget {
  const MeetupNearbyApp({super.key});

  @override
  ConsumerState<MeetupNearbyApp> createState() => _MeetupNearbyAppState();
}

class _MeetupNearbyAppState extends ConsumerState<MeetupNearbyApp> {
  bool _maintenance = false;
  String _maintenanceMsg = '';

  @override
  void initState() {
    super.initState();
    Future.microtask(() async {
      // Check maintenance status before doing anything else
      await _checkStatus();

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

  Future<void> _checkStatus() async {
    try {
      final res = await ref.read(apiClientProvider).dio.get('/status');
      final data = res.data as Map<String, dynamic>;
      final maintenance = data['maintenance'] as bool? ?? false;
      final message = data['message'] as String? ?? '';
      if (mounted) {
        setState(() {
          _maintenance = maintenance;
          _maintenanceMsg = message;
        });
      }
    } catch (_) {
      // If status check fails, allow the app to proceed normally
    }
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
        .then((_) {}, onError: (_) {});
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
      title: 'Meetup Nearby',
      debugShowCheckedModeBanner: false,
      theme: AppThemeLight.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: themeMode,
      routerConfig: router,
      builder: (context, child) {
        // Maintenance overlay — shown before routing if status says so
        if (_maintenance) {
          return MaintenanceScreen(
            message: _maintenanceMsg,
            onRetry: () => _checkStatus(),
          );
        }
        return child ?? const SizedBox.shrink();
      },
    );
  }
}
