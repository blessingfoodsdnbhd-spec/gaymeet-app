import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:home_widget/home_widget.dart';
import 'config/routes.dart';
import 'core/providers/auth_provider.dart';
import 'core/providers/conversations_provider.dart';
import 'core/providers/likes_provider.dart';
import 'core/providers/locale_provider.dart';
import 'core/providers/privacy_provider.dart';
import 'core/providers/promotion_provider.dart';
import 'core/providers/subscription_provider.dart';
import 'core/providers/theme_provider.dart';
import 'core/providers/widget_data_provider.dart';
import 'core/theme/app_theme.dart';
import 'features/maintenance/maintenance_screen.dart';
import 'shared/widgets/promo_popup.dart';

class MeetupNearbyApp extends ConsumerStatefulWidget {
  const MeetupNearbyApp({super.key});

  @override
  ConsumerState<MeetupNearbyApp> createState() => _MeetupNearbyAppState();
}

class _MeetupNearbyAppState extends ConsumerState<MeetupNearbyApp>
    with WidgetsBindingObserver {
  bool _maintenance = false;
  String _maintenanceMsg = '';
  late GoRouter _router;
  StreamSubscription<Uri?>? _widgetClickSub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
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

        // Refresh widget data on first launch
        ref.read(widgetDataProvider).refresh();
      }

      // Handle widget tap that cold-launched the app
      final launchUri = await HomeWidget.initiallyLaunchedFromHomeWidget();
      if (launchUri != null) _handleWidgetUri(launchUri);

      // Listen for widget taps when app is already running
      _widgetClickSub = HomeWidget.widgetClicked.listen((uri) {
        if (uri != null) _handleWidgetUri(uri);
      });
    });
  }

  void _handleWidgetUri(Uri uri) {
    if (!mounted) return;
    if (uri.host == 'nearby') {
      _router.go('/nearby');
    } else if (uri.host == 'chat' && uri.pathSegments.isNotEmpty) {
      _router.go('/chats');
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      final user = ref.read(authStateProvider).user;
      if (user != null) ref.read(widgetDataProvider).refresh();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _widgetClickSub?.cancel();
    super.dispose();
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

        // Re-fetch likes and conversations when user logs in
        if (prev?.user == null) {
          ref.read(likesProvider.notifier).fetchLikes();
          ref.read(conversationsProvider.notifier).fetchConversations();
          _scheduleNoMatchNotification();
        }
      }
    });

    final authState = ref.watch(authStateProvider);
    final themeMode = ref.watch(themeProvider);
    // localeProvider is watched here so locale changes rebuild the app
    ref.watch(localeProvider);

    _router = createRouter(isLoggedIn: authState.isLoggedIn);

    return MaterialApp.router(
      title: 'Meyou - Social Media',
      debugShowCheckedModeBanner: false,
      theme: AppThemeLight.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: themeMode,
      routerConfig: _router,
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
